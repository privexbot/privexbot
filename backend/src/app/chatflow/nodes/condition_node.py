"""
Condition Node - Branching logic node.

WHY:
- Enable if/else workflows
- Data validation
- Route based on conditions
- Complex decision trees

HOW:
- Evaluate expressions
- Support comparisons
- Boolean logic
- Safe evaluation

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class ConditionNode(BaseNode):
    """
    Conditional branching node.

    WHY: Control flow in workflows
    HOW: Evaluate conditions and return boolean
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute condition evaluation.

        CONFIG:
            {
                "condition": "{{input}} contains 'help'",
                "operator": "contains",  # contains, equals, gt, lt, regex
                "value": "help",
                "variable": "{{input}}"
            }

        INPUTS:
            {
                "input": "User message"
            }

        RETURNS:
            {
                "output": True/False,
                "success": True,
                "metadata": {
                    "condition_met": True/False
                }
            }
        """

        try:
            operator = self.config.get("operator", "equals")
            variable_template = self.config.get("variable", "{{input}}")
            compare_value = self.config.get("value", "")

            # Resolve variable
            variable_value = self.resolve_variable(variable_template, {
                **context.get("variables", {}),
                **inputs
            })

            # Evaluate condition
            result = self._evaluate(operator, variable_value, compare_value)

            return {
                "output": result,
                "success": True,
                "error": None,
                "metadata": {
                    "condition_met": result,
                    "operator": operator,
                    "variable_value": str(variable_value)[:100]  # Truncate for logging
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def _evaluate(self, operator: str, left: Any, right: Any) -> bool:
        """
        Evaluate condition.

        WHY: Compare values based on operator
        HOW: Type-safe comparison
        """

        if operator == "equals":
            return str(left).lower() == str(right).lower()

        elif operator == "not_equals":
            return str(left).lower() != str(right).lower()

        elif operator == "contains":
            return str(right).lower() in str(left).lower()

        elif operator == "not_contains":
            return str(right).lower() not in str(left).lower()

        elif operator == "starts_with":
            return str(left).lower().startswith(str(right).lower())

        elif operator == "ends_with":
            return str(left).lower().endswith(str(right).lower())

        elif operator == "gt":  # greater than
            try:
                return float(left) > float(right)
            except ValueError:
                return False

        elif operator == "lt":  # less than
            try:
                return float(left) < float(right)
            except ValueError:
                return False

        elif operator == "gte":  # greater than or equal
            try:
                return float(left) >= float(right)
            except ValueError:
                return False

        elif operator == "lte":  # less than or equal
            try:
                return float(left) <= float(right)
            except ValueError:
                return False

        elif operator == "is_empty":
            return not left or str(left).strip() == ""

        elif operator == "is_not_empty":
            return bool(left and str(left).strip())

        elif operator == "regex":
            import re
            try:
                return bool(re.search(right, str(left)))
            except re.error:
                return False

        else:
            raise ValueError(f"Unknown operator: {operator}")


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate condition node configuration."""

        if not self.config.get("operator"):
            return False, "Operator is required"

        if not self.config.get("variable"):
            return False, "Variable is required"

        return True, None
