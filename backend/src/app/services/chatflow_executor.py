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

from typing import Any

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
    HOW: Delegate to LLMNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.llm_node import LLMNode
            node = LLMNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class HTTPRequestNodeExecutor(BaseNodeExecutor):
    """
    HTTP Request node - Make API calls.

    WHY: Integrate external APIs
    HOW: Delegate to HTTPNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.http_node import HTTPNode
            node = HTTPNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
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
    HOW: Delegate to ConditionNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.condition_node import ConditionNode
            node = ConditionNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": False,
                "success": False,
                "error": str(e)
            }


class ResponseNodeExecutor(BaseNodeExecutor):
    """
    Response node - Format final output.

    WHY: Return result to user
    HOW: Delegate to ResponseNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.response_node import ResponseNode
            node = ResponseNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": "Error generating response",
                "success": False,
                "error": str(e)
            }


class KBNodeExecutor(BaseNodeExecutor):
    """
    Knowledge Base retrieval node executor.

    WHY: Retrieve context from vector store
    HOW: Delegate to KBNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.kb_node import KBNode
            node = KBNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class VariableNodeExecutor(BaseNodeExecutor):
    """
    Variable manipulation node executor.

    WHY: Set, transform, or extract variables
    HOW: Delegate to VariableNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.variable_node import VariableNode
            node = VariableNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class CodeNodeExecutor(BaseNodeExecutor):
    """
    Python code execution node executor.

    WHY: Execute custom Python code safely
    HOW: Delegate to CodeNode implementation (sandboxed)
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.code_node import CodeNode
            node = CodeNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class MemoryNodeExecutor(BaseNodeExecutor):
    """
    Chat history/memory node executor.

    WHY: Retrieve conversation history for context
    HOW: Delegate to MemoryNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.memory_node import MemoryNode
            node = MemoryNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class DatabaseNodeExecutor(BaseNodeExecutor):
    """
    SQL database query node executor.

    WHY: Execute SQL queries against external databases
    HOW: Delegate to DatabaseNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.database_node import DatabaseNode
            node = DatabaseNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class LoopNodeExecutor(BaseNodeExecutor):
    """
    Array iteration loop node executor.

    WHY: Iterate over arrays and execute sub-workflows
    HOW: Delegate to LoopNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.loop_node import LoopNode
            node = LoopNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class WebhookNodeExecutor(BaseNodeExecutor):
    """
    Outbound webhook node executor.

    WHY: Push data to external systems (Zapier, Make, n8n, custom)
    HOW: Delegate to WebhookNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.webhook_node import WebhookNode
            node = WebhookNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class EmailNodeExecutor(BaseNodeExecutor):
    """
    Email sending node executor.

    WHY: Send emails via SMTP as part of chatflow automation
    HOW: Delegate to EmailNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.email_node import EmailNode
            node = EmailNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class NotificationNodeExecutor(BaseNodeExecutor):
    """
    Team notification node executor.

    WHY: Post messages to Slack, Discord, or Teams channels
    HOW: Delegate to NotificationNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.notification_node import NotificationNode
            node = NotificationNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class HandoffNodeExecutor(BaseNodeExecutor):
    """
    Human handoff node executor.

    WHY: Escalate conversation to human agent with full context
    HOW: Delegate to HandoffNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.handoff_node import HandoffNode
            node = HandoffNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class LeadCaptureNodeExecutor(BaseNodeExecutor):
    """
    Lead capture node executor.

    WHY: Collect, validate, and store lead data from conversations
    HOW: Delegate to LeadCaptureNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.lead_capture_node import LeadCaptureNode
            node = LeadCaptureNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
                "success": False,
                "error": str(e)
            }


class CalendlyNodeExecutor(BaseNodeExecutor):
    """
    Calendly scheduling node executor.

    WHY: Share booking links and manage scheduling in chatflows
    HOW: Delegate to CalendlyNode implementation
    """

    async def execute(self, db: Session, node_config: dict, context: dict) -> dict:
        try:
            from app.chatflow.nodes.calendly_node import CalendlyNode
            node = CalendlyNode(node_id="temp", config=node_config)
            return await node.execute(
                db=db,
                context=context,
                inputs={"input": context.get("user_message", "")}
            )
        except Exception as e:
            return {
                "output": None,
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
            # Core flow nodes
            "trigger": TriggerNodeExecutor(),
            "response": ResponseNodeExecutor(),
            "condition": ConditionNodeExecutor(),
            # AI & Knowledge nodes
            "llm": LLMNodeExecutor(),
            "kb": KBNodeExecutor(),
            "memory": MemoryNodeExecutor(),
            # Integration nodes
            "http_request": HTTPRequestNodeExecutor(),
            "http": HTTPRequestNodeExecutor(),  # Alias for frontend compatibility
            "database": DatabaseNodeExecutor(),
            # Action nodes
            "webhook": WebhookNodeExecutor(),
            "email": EmailNodeExecutor(),
            "notification": NotificationNodeExecutor(),
            "handoff": HandoffNodeExecutor(),
            "lead_capture": LeadCaptureNodeExecutor(),
            "calendly": CalendlyNodeExecutor(),
            # Data manipulation nodes
            "variable": VariableNodeExecutor(),
            "code": CodeNodeExecutor(),
            "loop": LoopNodeExecutor(),
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
