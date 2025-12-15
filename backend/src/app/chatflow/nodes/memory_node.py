"""
Memory Node - Access conversation history.

WHY:
- Get chat history in workflows
- Summarize conversations
- Context awareness
- Memory management

HOW:
- Query session messages
- Format for LLM
- Return history
- Support limits

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from uuid import UUID
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode
from app.services.session_service import session_service


class MemoryNode(BaseNode):
    """
    Conversation memory node.

    WHY: Access chat history in workflows
    HOW: Query session messages
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute memory retrieval.

        CONFIG:
            {
                "max_messages": 10,
                "format": "text",  # text, json, summary
                "include_system": False
            }

        RETURNS:
            {
                "output": "Formatted conversation history",
                "success": True,
                "metadata": {
                    "message_count": 10
                }
            }
        """

        try:
            session_id = context.get("session_id")
            if not session_id:
                raise ValueError("Session ID required in context")

            max_messages = self.config.get("max_messages", 10)
            format_type = self.config.get("format", "text")
            include_system = self.config.get("include_system", False)

            # Get conversation history
            messages = session_service.get_context_messages(
                db=db,
                session_id=UUID(session_id),
                max_messages=max_messages
            )

            # Filter system messages if needed
            if not include_system:
                messages = [m for m in messages if m.role.value != "system"]

            # Format based on type
            if format_type == "text":
                output = self._format_as_text(messages)
            elif format_type == "json":
                output = self._format_as_json(messages)
            elif format_type == "summary":
                output = self._format_as_summary(messages)
            else:
                output = str(messages)

            return {
                "output": output,
                "success": True,
                "error": None,
                "metadata": {
                    "message_count": len(messages),
                    "format": format_type
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def _format_as_text(self, messages: list) -> str:
        """Format messages as readable text."""

        lines = []
        for msg in messages:
            role = msg.role.value.capitalize()
            lines.append(f"{role}: {msg.content}")

        return "\n\n".join(lines)


    def _format_as_json(self, messages: list) -> list:
        """Format messages as JSON array."""

        return [
            {
                "role": msg.role.value,
                "content": msg.content,
                "timestamp": msg.created_at.isoformat()
            }
            for msg in messages
        ]


    def _format_as_summary(self, messages: list) -> str:
        """Format as brief summary."""

        if not messages:
            return "No conversation history"

        user_msgs = [m for m in messages if m.role.value == "user"]
        assistant_msgs = [m for m in messages if m.role.value == "assistant"]

        return f"Conversation: {len(user_msgs)} user messages, {len(assistant_msgs)} assistant responses"


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate memory node configuration."""
        return True, None
