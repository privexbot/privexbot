"""
Variable Node - Set and manipulate variables.

WHY:
- Store intermediate results
- Transform data
- Set context variables
- Data manipulation

HOW:
- Set variable values
- String operations
- Type conversions
- JSON parsing

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from sqlalchemy.orm import Session
import json

from app.chatflow.nodes.base_node import BaseNode


class VariableNode(BaseNode):
    """
    Variable manipulation node.

    WHY: Store and transform data in workflows
    HOW: Set variables in context
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute variable operation.

        CONFIG:
            {
                "operation": "set",  # set, append, json_parse, extract
                "variable_name": "my_var",
                "value": "{{input}}",
                "transform": "uppercase"  # Optional: uppercase, lowercase, trim
            }

        RETURNS:
            {
                "output": "Variable value",
                "success": True,
                "metadata": {
                    "variable_name": "my_var"
                }
            }
        """

        try:
            operation = self.config.get("operation", "set")
            variable_name = self.config.get("variable_name")
            value_template = self.config.get("value", "")

            if not variable_name:
                raise ValueError("Variable name is required")

            # Resolve value
            value = self.resolve_variable(value_template, {
                **context.get("variables", {}),
                **inputs
            })

            # Apply transform
            transform = self.config.get("transform")
            if transform:
                value = self._apply_transform(value, transform)

            # Perform operation
            if operation == "set":
                context["variables"][variable_name] = value
                output = value

            elif operation == "append":
                # Append to existing variable
                existing = context["variables"].get(variable_name, "")
                context["variables"][variable_name] = str(existing) + str(value)
                output = context["variables"][variable_name]

            elif operation == "json_parse":
                # Parse JSON string
                parsed = json.loads(value)
                context["variables"][variable_name] = parsed
                output = parsed

            elif operation == "extract":
                # Extract field from JSON/dict
                field = self.config.get("field")
                if isinstance(value, dict) and field:
                    extracted = value.get(field)
                    context["variables"][variable_name] = extracted
                    output = extracted
                else:
                    output = value

            else:
                raise ValueError(f"Unknown operation: {operation}")

            return {
                "output": output,
                "success": True,
                "error": None,
                "metadata": {
                    "variable_name": variable_name,
                    "operation": operation
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def _apply_transform(self, value: Any, transform: str) -> Any:
        """Apply transformation to value."""

        value_str = str(value)

        if transform == "uppercase":
            return value_str.upper()
        elif transform == "lowercase":
            return value_str.lower()
        elif transform == "trim":
            return value_str.strip()
        elif transform == "length":
            return len(value_str)
        else:
            return value


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate variable node configuration."""

        if not self.config.get("variable_name"):
            return False, "Variable name is required"

        return True, None
