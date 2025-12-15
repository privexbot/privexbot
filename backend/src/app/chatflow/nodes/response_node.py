"""
Response Node - Format final output to user.

WHY:
- Return response from workflow
- Format message templates
- Support multiple formats
- End workflow execution

HOW:
- Template resolution
- Variable interpolation
- Format as text/JSON/HTML
- Return to user

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class ResponseNode(BaseNode):
    """
    Response formatting node.

    WHY: Return formatted output to user
    HOW: Resolve template and return
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute response formatting.

        CONFIG:
            {
                "message": "Hello {{user_name}}, the answer is: {{llm_output}}",
                "format": "text",  # text, json, markdown
                "include_sources": True
            }

        RETURNS:
            {
                "output": "Formatted response text",
                "success": True,
                "metadata": {
                    "format": "text"
                }
            }
        """

        try:
            message_template = self.config.get("message", "{{input}}")
            format_type = self.config.get("format", "text")
            include_sources = self.config.get("include_sources", False)

            # Resolve message template
            message = self.resolve_variable(message_template, {
                **context.get("variables", {}),
                **inputs
            })

            # Format based on type
            if format_type == "json":
                import json
                output = json.dumps({
                    "response": message,
                    "timestamp": context.get("timestamp")
                })

            elif format_type == "markdown":
                # Add markdown formatting if needed
                output = message

            else:  # text
                output = message

            # Add sources if requested and available
            metadata = {"format": format_type}

            if include_sources and "sources" in context.get("variables", {}):
                metadata["sources"] = context["variables"]["sources"]

            return {
                "output": output,
                "success": True,
                "error": None,
                "metadata": metadata
            }

        except Exception as e:
            return self.handle_error(e)


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate response node configuration."""

        if not self.config.get("message"):
            return False, "Message template is required"

        return True, None
