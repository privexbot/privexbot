"""
Base Node - Abstract base class for all chatflow nodes.

WHY:
- Consistent interface for all nodes
- Common execution pattern
- Error handling framework
- Extensibility

HOW:
- Abstract execute() method
- Context management
- Input/output handling
- Validation framework

PSEUDOCODE follows the existing codebase patterns.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional, Dict
from sqlalchemy.orm import Session


class BaseNode(ABC):
    """
    Abstract base class for chatflow nodes.

    WHY: Consistent interface for all node types
    HOW: Inherit and implement execute()
    """

    def __init__(self, node_id: str, config: dict):
        """
        Initialize base node.

        ARGS:
            node_id: Unique node identifier
            config: Node configuration from chatflow
        """
        self.node_id = node_id
        self.config = config
        self.node_type = self.__class__.__name__


    @abstractmethod
    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute node logic.

        WHY: Process inputs and return outputs
        HOW: Implement in subclass

        ARGS:
            db: Database session
            context: Execution context (variables, session, etc.)
            inputs: Input data from previous nodes

        RETURNS:
            {
                "output": Any,  # Primary output
                "success": bool,
                "error": Optional[str],
                "metadata": dict  # Additional data
            }
        """
        pass


    def validate_config(self) -> tuple[bool, Optional[str]]:
        """
        Validate node configuration.

        WHY: Catch configuration errors before execution
        HOW: Check required fields

        RETURNS:
            (is_valid, error_message)
        """
        # Override in subclass for specific validation
        return True, None


    def get_input(self, inputs: dict, key: str, default: Any = None) -> Any:
        """
        Get input value with fallback.

        WHY: Safe input retrieval
        HOW: Check inputs dict with default
        """
        return inputs.get(key, default)


    def resolve_variable(self, value: str, context: dict) -> str:
        """
        Resolve variable placeholders in string.

        WHY: Support {{variable}} syntax
        HOW: Replace with context values

        EXAMPLE:
            "Hello {{user_name}}" -> "Hello John"
        """
        from app.chatflow.utils.variable_resolver import variable_resolver

        return variable_resolver.resolve(value, context)


    def handle_error(self, error: Exception) -> dict:
        """
        Handle execution error.

        WHY: Consistent error format
        HOW: Return error dict
        """
        return {
            "output": None,
            "success": False,
            "error": str(error),
            "metadata": {
                "node_id": self.node_id,
                "node_type": self.node_type
            }
        }
