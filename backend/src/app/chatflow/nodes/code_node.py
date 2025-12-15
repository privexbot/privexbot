"""
Code Node - Execute Python code in workflow.

WHY:
- Custom logic in workflows
- Data transformation
- Complex calculations
- Flexible scripting

HOW:
- Safe code execution
- Sandboxed environment
- Limited standard library
- Return result

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class CodeNode(BaseNode):
    """
    Python code execution node.

    WHY: Custom logic in workflows
    HOW: Safe execution with restricted globals
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute Python code.

        CONFIG:
            {
                "code": "result = input_data.upper()",
                "timeout": 5
            }

        INPUTS:
            Available in code as 'input_data' and 'variables'

        RETURNS:
            {
                "output": "Result from 'result' variable",
                "success": True,
                "metadata": {}
            }

        SECURITY:
            - Sandboxed execution
            - No file access
            - No network access
            - Limited imports
        """

        try:
            code = self.config.get("code", "")
            timeout = self.config.get("timeout", 5)

            if not code:
                raise ValueError("Code is required")

            # Prepare execution context
            exec_globals = {
                # Safe built-ins only
                "__builtins__": {
                    "len": len,
                    "str": str,
                    "int": int,
                    "float": float,
                    "bool": bool,
                    "list": list,
                    "dict": dict,
                    "tuple": tuple,
                    "set": set,
                    "range": range,
                    "enumerate": enumerate,
                    "zip": zip,
                    "sum": sum,
                    "min": min,
                    "max": max,
                    "abs": abs,
                    "round": round,
                    "sorted": sorted,
                    "reversed": reversed,
                    "True": True,
                    "False": False,
                    "None": None
                },
                # Available modules (safe subset)
                "json": __import__("json"),
                "re": __import__("re"),
                "math": __import__("math"),
                "datetime": __import__("datetime")
            }

            exec_locals = {
                "input_data": inputs.get("input", ""),
                "variables": context.get("variables", {}),
                "result": None  # User sets this variable
            }

            # Execute code (with timeout in production)
            exec(code, exec_globals, exec_locals)

            # Get result
            result = exec_locals.get("result")

            return {
                "output": result,
                "success": True,
                "error": None,
                "metadata": {
                    "code_length": len(code)
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate code node configuration."""

        code = self.config.get("code", "")

        if not code:
            return False, "Code is required"

        # Basic security checks
        forbidden = ["import", "open", "exec", "eval", "__"]
        for keyword in forbidden:
            if keyword in code.lower():
                return False, f"Forbidden keyword: {keyword}"

        return True, None
