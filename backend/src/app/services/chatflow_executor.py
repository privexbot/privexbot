"""
Chatflow Executor - Execute individual chatflow nodes.

WHY:
- Separate node execution logic from flow orchestration
- Support different node types (LLM, HTTP, condition, etc.)
- Extensible for new node types
- Reusable node implementations

HOW:
- Registry pattern for node executors
- Each node type has dedicated executor
- Context passing between nodes
- Error handling per node

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session


class BaseNodeExecutor:
    """
    Base class for node executors.

    WHY: Common interface for all nodes
    HOW: Inherit and implement execute()
    """

    async def execute(
        self,
        db: Session,
        node_config: dict,
        context: dict
    ) -> dict:
        """
        Execute node logic.

        ARGS:
            db: Database session
            node_config: Node configuration
            context: Execution context

        RETURNS:
            {
                "output": Any,  # Node output
                "success": bool,
                "error": str | None
            }
        """
        raise NotImplementedError


class TriggerNodeExecutor(BaseNodeExecutor):
    """
    Trigger node - Entry point for chatflow.

    WHY: Start execution
    HOW: Pass user input to context
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        return {
            "output": context.get("user_message"),
            "success": True,
            "error": None
        }


class LLMNodeExecutor(BaseNodeExecutor):
    """
    LLM node - AI text generation.

    WHY: Generate AI responses
    HOW: Call inference_service
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        from app.services.inference_service import inference_service

        try:
            # Get prompt template
            prompt_template = node_config.get("prompt", "{{input}}")

            # Replace variables
            prompt = self._render_template(prompt_template, context)

            # Call LLM
            result = await inference_service.generate(
                prompt=prompt,
                model=node_config.get("model", "secret-ai-v1"),
                temperature=node_config.get("temperature", 0.7),
                max_tokens=node_config.get("max_tokens", 2000)
            )

            return {
                "output": result["text"],
                "success": True,
                "error": None,
                "metadata": {
                    "tokens_used": result["usage"]
                }
            }

        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }

    def _render_template(self, template: str, context: dict) -> str:
        """Replace {{variable}} placeholders in template."""

        result = template

        # Replace user_message
        result = result.replace("{{input}}", context.get("user_message", ""))
        result = result.replace("{{user_message}}", context.get("user_message", ""))

        # Replace context variables
        for key, value in context.get("variables", {}).items():
            result = result.replace(f"{{{{{key}}}}}", str(value))

        return result


class HTTPRequestNodeExecutor(BaseNodeExecutor):
    """
    HTTP Request node - Make API calls.

    WHY: Integrate external APIs
    HOW: Execute HTTP request with credentials
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        import requests

        try:
            # Get request config
            method = node_config.get("method", "GET")
            url = node_config.get("url")
            headers = node_config.get("headers", {})
            body = node_config.get("body", {})

            # Get credentials if specified
            credential_id = node_config.get("credential_id")
            if credential_id:
                from app.services.credential_service import credential_service
                from app.models.credential import Credential

                credential = db.query(Credential).get(UUID(credential_id))
                if credential:
                    cred_data = credential_service.get_decrypted_data(db, credential)

                    # Add auth to headers
                    if "api_key" in cred_data:
                        headers["Authorization"] = f"Bearer {cred_data['api_key']}"

            # Make request
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=body,
                timeout=30
            )

            response.raise_for_status()

            return {
                "output": response.json(),
                "success": True,
                "error": None,
                "metadata": {
                    "status_code": response.status_code
                }
            }

        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class ConditionNodeExecutor(BaseNodeExecutor):
    """
    Condition node - Branching logic.

    WHY: Control flow based on conditions
    HOW: Evaluate expression, return boolean
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            condition = node_config.get("condition", "true")

            # Simple condition evaluation (placeholder)
            # Production would use safe expression evaluator
            result = self._evaluate_condition(condition, context)

            return {
                "output": result,
                "success": True,
                "error": None,
                "condition_result": result
            }

        except Exception as e:
            return {
                "output": False,
                "success": False,
                "error": str(e)
            }

    def _evaluate_condition(self, condition: str, context: dict) -> bool:
        """Evaluate condition (simplified)."""

        # Placeholder - production would use safe evaluator
        # Examples:
        # - "{{variable}} > 10"
        # - "{{input}} contains 'help'"

        return True  # Always true for placeholder


class ResponseNodeExecutor(BaseNodeExecutor):
    """
    Response node - Format final output.

    WHY: Return result to user
    HOW: Format response template
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            # Get response template
            response_template = node_config.get("message", "{{input}}")

            # Replace variables
            response = response_template

            # Replace user_message
            response = response.replace("{{input}}", context.get("user_message", ""))
            response = response.replace("{{user_message}}", context.get("user_message", ""))

            # Replace context variables
            for key, value in context.get("variables", {}).items():
                response = response.replace(f"{{{{{key}}}}}", str(value))

            return {
                "output": response,
                "success": True,
                "error": None
            }

        except Exception as e:
            return {
                "output": "Error generating response",
                "success": False,
                "error": str(e)
            }


class ChatflowExecutor:
    """
    Chatflow node executor registry.

    WHY: Centralized node execution
    HOW: Registry pattern with node type mapping
    """

    def __init__(self):
        """
        Initialize executor registry.

        WHY: Map node types to executors
        HOW: Dictionary of executors
        """
        self.executors = {
            "trigger": TriggerNodeExecutor(),
            "llm": LLMNodeExecutor(),
            "http_request": HTTPRequestNodeExecutor(),
            "condition": ConditionNodeExecutor(),
            "response": ResponseNodeExecutor()
        }

    async def execute_node(
        self,
        db: Session,
        node: dict,
        context: dict
    ) -> dict:
        """
        Execute node using appropriate executor.

        WHY: Route to correct node executor
        HOW: Lookup in registry

        ARGS:
            db: Database session
            node: Node configuration
            context: Execution context

        RETURNS:
            Node execution result
        """

        node_type = node.get("type")
        executor = self.executors.get(node_type)

        if not executor:
            return {
                "output": None,
                "success": False,
                "error": f"Unknown node type: {node_type}"
            }

        # Execute node
        result = await executor.execute(
            db=db,
            node_config=node.get("config", {}),
            context=context
        )

        return result

    def register_executor(self, node_type: str, executor: BaseNodeExecutor):
        """
        Register custom node executor.

        WHY: Extensibility
        HOW: Add to registry
        """
        self.executors[node_type] = executor


# Global instance
chatflow_executor = ChatflowExecutor()
