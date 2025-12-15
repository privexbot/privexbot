"""
Chatflow Service - Execute chatflow workflows (node-based).

WHY:
- Complex workflows with branching logic
- Node-based execution (trigger → nodes → response)
- Support for HTTP requests, conditions, loops, database queries
- More powerful than simple chatbots

HOW:
- Parse chatflow graph (nodes + edges)
- Execute nodes in order (topological sort)
- Track execution state and context
- Handle errors and fallbacks

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, Any

from sqlalchemy.orm import Session

from app.models.chatflow import Chatflow
from app.services.session_service import session_service


class ChatflowService:
    """
    Chatflow execution orchestration.

    WHY: Execute complex node-based workflows
    HOW: Graph traversal with context passing
    """

    def __init__(self):
        """
        Initialize chatflow service.

        WHY: Load dependencies
        HOW: Use global service instances
        """
        self.session_service = session_service


    async def execute(
        self,
        db: Session,
        chatflow: Chatflow,
        user_message: str,
        session_id: str,
        channel_context: Optional[dict] = None
    ) -> dict:
        """
        Execute chatflow workflow.

        FLOW:
        1. Get or create session
        2. Save user message
        3. Initialize execution context
        4. Find start node (trigger)
        5. Execute nodes in sequence
        6. Save assistant response
        7. Return result

        ARGS:
            db: Database session
            chatflow: Chatflow model instance
            user_message: User's input text
            session_id: Conversation session ID
            channel_context: Channel-specific data

        RETURNS:
            {
                "response": "AI response text",
                "session_id": "uuid",
                "message_id": "uuid",
                "nodes_executed": ["start", "llm1", "condition1", "response"],
                "execution_time_ms": 1250
            }
        """

        start_time = datetime.utcnow()

        # 1. Get or create session
        session = self.session_service.get_or_create_session(
            db=db,
            bot_type="chatflow",
            bot_id=chatflow.id,
            session_id=session_id,
            workspace_id=chatflow.workspace_id,
            channel_context=channel_context
        )

        # 2. Save user message
        user_msg = self.session_service.save_message(
            db=db,
            session_id=session.id,
            role="user",
            content=user_message
        )

        # 3. Initialize execution context
        context = {
            "user_message": user_message,
            "session_id": str(session.id),
            "workspace_id": str(chatflow.workspace_id),
            "variables": {},
            "history": self.session_service.get_context_messages(
                db=db,
                session_id=session.id,
                max_messages=10
            )
        }

        # 4. Execute chatflow graph
        try:
            execution_result = await self._execute_graph(
                db=db,
                chatflow=chatflow,
                context=context
            )

            response_text = execution_result["output"]
            nodes_executed = execution_result["nodes_executed"]

            # 5. Calculate execution time
            end_time = datetime.utcnow()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)

            # 6. Save assistant message
            assistant_msg = self.session_service.save_message(
                db=db,
                session_id=session.id,
                role="assistant",
                content=response_text,
                response_metadata={
                    "type": "chatflow",
                    "chatflow_id": str(chatflow.id),
                    "nodes_executed": nodes_executed,
                    "execution_time_ms": execution_time_ms
                }
            )

            return {
                "response": response_text,
                "session_id": str(session.id),
                "message_id": str(assistant_msg.id),
                "nodes_executed": nodes_executed,
                "execution_time_ms": execution_time_ms
            }

        except Exception as e:
            # Save error message
            error_msg = self.session_service.save_message(
                db=db,
                session_id=session.id,
                role="assistant",
                content="I'm sorry, I encountered an error processing your request.",
                error=str(e),
                error_code="execution_error"
            )

            raise


    async def _execute_graph(
        self,
        db: Session,
        chatflow: Chatflow,
        context: dict
    ) -> dict:
        """
        Execute chatflow graph (nodes + edges).

        WHY: Core execution logic
        HOW: Traverse graph, execute nodes, track state

        RETURNS:
            {
                "output": "Final response text",
                "nodes_executed": ["start", "llm1", "response"]
            }
        """

        nodes = chatflow.config.get("nodes", [])
        edges = chatflow.config.get("edges", [])

        # Find start node (trigger)
        start_node = None
        for node in nodes:
            if node["type"] == "trigger":
                start_node = node
                break

        if not start_node:
            raise ValueError("No trigger node found in chatflow")

        # Execute nodes starting from trigger
        current_node = start_node
        nodes_executed = []
        output = ""

        while current_node:
            # Execute current node
            node_result = await self._execute_node(
                db=db,
                node=current_node,
                context=context
            )

            nodes_executed.append(current_node["id"])

            # Update context with node output
            if node_result.get("output"):
                context["variables"][current_node["id"]] = node_result["output"]

            # Check if this is response node
            if current_node["type"] == "response":
                output = node_result.get("output", "")
                break

            # Find next node
            current_node = self._get_next_node(
                current_node_id=current_node["id"],
                edges=edges,
                nodes=nodes,
                context=context
            )

        return {
            "output": output,
            "nodes_executed": nodes_executed
        }


    async def _execute_node(
        self,
        db: Session,
        node: dict,
        context: dict
    ) -> dict:
        """
        Execute single node.

        WHY: Node-specific logic
        HOW: Delegate to node executor (placeholder for now)

        NODE TYPES:
        - trigger: Entry point
        - llm: AI generation
        - http_request: API call
        - condition: Branching logic
        - response: Output node
        """

        node_type = node["type"]

        # Placeholder implementation - full node executor would be separate service
        if node_type == "trigger":
            return {"output": context["user_message"]}

        elif node_type == "llm":
            # Placeholder - would call inference_service
            from app.services.inference_service import inference_service

            prompt = node["config"].get("prompt", "").replace(
                "{{input}}",
                context["user_message"]
            )

            result = await inference_service.generate(
                prompt=prompt,
                model=node["config"].get("model", "secret-ai-v1"),
                temperature=node["config"].get("temperature", 0.7)
            )

            return {"output": result["text"]}

        elif node_type == "response":
            # Format response template
            response_template = node["config"].get("message", "{{input}}")
            response = response_template.replace("{{input}}", context["user_message"])

            # Replace variables
            for var_name, var_value in context["variables"].items():
                response = response.replace(f"{{{{{var_name}}}}}", str(var_value))

            return {"output": response}

        elif node_type == "condition":
            # Evaluate condition (simplified)
            condition = node["config"].get("condition", "")
            result = self._evaluate_condition(condition, context)

            return {"output": result, "condition_result": result}

        elif node_type == "http_request":
            # Make HTTP request (placeholder)
            return {"output": "HTTP request result"}

        else:
            # Unknown node type
            return {"output": None}


    def _evaluate_condition(self, condition: str, context: dict) -> bool:
        """
        Evaluate conditional expression.

        WHY: Branching logic in workflows
        HOW: Parse and evaluate condition (simplified)

        EXAMPLE CONDITIONS:
        - "{{user_message}} contains 'help'"
        - "{{variable1}} > 10"
        """

        # Simplified condition evaluation (production would use safe expression parser)
        return True  # Placeholder


    def _get_next_node(
        self,
        current_node_id: str,
        edges: list,
        nodes: list,
        context: dict
    ) -> Optional[dict]:
        """
        Find next node to execute.

        WHY: Graph traversal
        HOW: Follow edges from current node

        HANDLES:
        - Linear flow (single edge)
        - Branching (conditional edges)
        """

        # Find outgoing edges
        outgoing_edges = [e for e in edges if e["source"] == current_node_id]

        if not outgoing_edges:
            return None

        # If multiple edges (branching), choose based on conditions
        # For now, just take first edge
        next_edge = outgoing_edges[0]
        next_node_id = next_edge["target"]

        # Find node by ID
        for node in nodes:
            if node["id"] == next_node_id:
                return node

        return None


    async def preview_execution(
        self,
        db: Session,
        draft_id: str,
        user_message: str,
        session_id: Optional[str] = None
    ) -> dict:
        """
        Preview chatflow execution (DRAFT MODE).

        WHY: Test chatflow before deploying
        HOW: Load draft from Redis, execute same logic
        """

        from app.services.draft_service import draft_service, DraftType

        # Get draft
        draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)
        if not draft:
            raise ValueError("Draft not found")

        # Create temporary chatflow-like object
        class TempChatflow:
            def __init__(self, draft_data):
                self.id = uuid4()
                self.workspace_id = UUID(draft_data["workspace_id"])
                self.config = draft_data["data"]

        temp_chatflow = TempChatflow(draft)

        # Execute
        if not session_id:
            session_id = f"preview_{uuid4().hex[:8]}"

        response = await self.execute(
            db=db,
            chatflow=temp_chatflow,
            user_message=user_message,
            session_id=session_id
        )

        # Update draft preview state
        draft_service.update_draft(
            draft_type=DraftType.CHATFLOW,
            draft_id=draft_id,
            updates={
                "preview": {
                    "session_id": session_id,
                    "last_message": user_message,
                    "last_response": response["response"],
                    "nodes_executed": response["nodes_executed"],
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        )

        return response


# Global instance
chatflow_service = ChatflowService()
