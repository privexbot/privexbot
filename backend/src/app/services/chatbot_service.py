"""
Chatbot Service - Execute simple form-based chatbots.

WHY:
- Simple chatbots = linear execution (one AI call per message)
- No branching logic or complex workflows
- Used by website widget, Telegram, Discord, WhatsApp, API

HOW:
- Get chat history from session
- Retrieve context from knowledge bases (if configured)
- Build prompt with system prompt + context + history
- Single AI call via inference_service
- Save message to history
- Return response

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.chatbot import Chatbot
from app.services.inference_service import inference_service
from app.services.session_service import session_service
from app.services.draft_service import DraftType


class ChatbotService:
    """
    Core chatbot processing logic.
    Used by ALL channels (website, Discord, Telegram, API, etc.)
    """

    def __init__(self):
        """
        Initialize chatbot service with dependencies.

        WHY: Inject services for testing
        HOW: Use global service instances
        """
        self.inference_service = inference_service
        self.session_service = session_service


    async def process_message(
        self,
        db: Session,
        chatbot: Chatbot,
        user_message: str,
        session_id: str,
        channel_context: Optional[dict] = None
    ) -> dict:
        """
        Process user message through chatbot.

        FLOW:
        1. Get or create session
        2. Save user message
        3. Retrieve context from KB (if configured)
        4. Get chat history
        5. Build prompt
        6. Call AI (inference_service)
        7. Save assistant message
        8. Return response

        ARGS:
            db: Database session
            chatbot: Chatbot model instance
            user_message: User's input text
            session_id: Conversation session ID
            channel_context: Channel-specific data (e.g., Telegram user_id)

        RETURNS:
            {
                "response": "AI response text",
                "sources": [...],  # RAG sources (if KB used)
                "session_id": "uuid",
                "message_id": "uuid"
            }
        """

        # 1. Get or create session
        session = self.session_service.get_or_create_session(
            db=db,
            bot_type="chatbot",
            bot_id=chatbot.id,
            session_id=session_id,
            workspace_id=chatbot.workspace_id,
            channel_context=channel_context
        )

        # 2. Save user message
        user_msg = self.session_service.save_message(
            db=db,
            session_id=session.id,
            role="user",
            content=user_message
        )

        # 3. Retrieve context from knowledge bases (RAG)
        context = ""
        sources = []

        if chatbot.config.get("knowledge_bases"):
            retrieval_result = await self._retrieve_context(
                db=db,
                chatbot=chatbot,
                query=user_message
            )
            context = retrieval_result["context"]
            sources = retrieval_result["sources"]

        # 4. Get chat history for memory
        history = self.session_service.get_context_messages(
            db=db,
            session_id=session.id,
            max_messages=chatbot.config.get("memory", {}).get("max_messages", 10)
        )

        # 5. Build prompt
        prompt = self._build_prompt(
            chatbot=chatbot,
            user_message=user_message,
            context=context,
            history=history
        )

        # 6. Call AI
        try:
            ai_response = await self.inference_service.generate(
                prompt=prompt,
                model=chatbot.config.get("model", "secret-ai-v1"),
                temperature=chatbot.config.get("temperature", 0.7),
                max_tokens=chatbot.config.get("max_tokens", 2000)
            )

            response_text = ai_response["text"]
            tokens_used = ai_response["usage"]

            # 7. Save assistant message
            assistant_msg = self.session_service.save_message(
                db=db,
                session_id=session.id,
                role="assistant",
                content=response_text,
                response_metadata={
                    "type": "chatbot",
                    "chatbot_id": str(chatbot.id),
                    "model": chatbot.config.get("model"),
                    "temperature": chatbot.config.get("temperature"),
                    "tokens_used": tokens_used,
                    "sources": sources,
                    "has_citations": len(sources) > 0,
                    "citation_count": len(sources)
                },
                prompt_tokens=tokens_used.get("prompt_tokens"),
                completion_tokens=tokens_used.get("completion_tokens")
            )

            return {
                "response": response_text,
                "sources": sources,
                "session_id": str(session.id),
                "message_id": str(assistant_msg.id)
            }

        except Exception as e:
            # Save error message
            error_msg = self.session_service.save_message(
                db=db,
                session_id=session.id,
                role="assistant",
                content="I'm sorry, I encountered an error processing your message.",
                error=str(e),
                error_code="generation_error"
            )

            raise


    async def _retrieve_context(
        self,
        db: Session,
        chatbot: Chatbot,
        query: str
    ) -> dict:
        """
        Retrieve context from configured knowledge bases.

        WHY: RAG - augment AI with relevant information
        HOW: Query each KB, combine results

        RETURNS:
            {
                "context": "Combined text from all chunks",
                "sources": [...]
            }
        """

        all_sources = []
        context_parts = []

        for kb_config in chatbot.config.get("knowledge_bases", []):
            if not kb_config.get("enabled"):
                continue

            kb_id = kb_config["kb_id"]

            # Get retrieval settings (KB-level or chatbot override)
            retrieval_settings = kb_config.get("override_retrieval", {})
            top_k = retrieval_settings.get("top_k", 5)
            search_method = retrieval_settings.get("search_method", "hybrid")
            threshold = retrieval_settings.get("similarity_threshold", 0.7)

            # Retrieve from this KB (placeholder - requires retrieval_service)
            # results = await self.retrieval_service.search(
            #     kb_id=kb_id,
            #     query=query,
            #     top_k=top_k,
            #     search_method=search_method,
            #     threshold=threshold
            # )

            # Placeholder for now
            results = []

            # Add to sources
            all_sources.extend(results)

            # Add to context
            for result in results:
                context_parts.append(result["content"])

        # Combine context
        context = "\n\n".join(context_parts)

        return {
            "context": context,
            "sources": all_sources
        }


    def _build_prompt(
        self,
        chatbot: Chatbot,
        user_message: str,
        context: str,
        history: list
    ) -> str:
        """
        Build prompt for AI model.

        WHY: Structure input for optimal AI response
        HOW: System prompt + KB context + history + user message

        TEMPLATE:
            System: {system_prompt}

            Context from knowledge base:
            {context}

            Chat history:
            {history}

            User: {user_message}
            Assistant:
        """

        parts = []

        # System prompt
        system_prompt = chatbot.config.get("system_prompt", "You are a helpful assistant.")
        parts.append(f"System: {system_prompt}")

        # Knowledge base context
        if context:
            parts.append("\nContext from knowledge base:")
            parts.append(context)

        # Chat history
        if history:
            parts.append("\nChat history:")
            for msg in history:
                role = "User" if msg.role.value == "user" else "Assistant"
                parts.append(f"{role}: {msg.content}")

        # Current user message
        parts.append(f"\nUser: {user_message}")
        parts.append("Assistant:")

        return "\n".join(parts)


    async def preview_response(
        self,
        db: Session,
        draft_id: str,
        user_message: str,
        session_id: Optional[str] = None
    ) -> dict:
        """
        Preview chatbot response (DRAFT MODE).

        WHY: Test chatbot before deploying
        HOW: Load draft from Redis, execute same logic

        NOTE: Uses draft config, not database
        """

        from app.services.draft_service import draft_service

        # Get draft
        draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)
        if not draft:
            raise ValueError("Draft not found")

        # Create temporary chatbot-like object
        class TempChatbot:
            def __init__(self, draft_data):
                self.id = uuid4()  # Temporary ID
                self.workspace_id = UUID(draft_data["workspace_id"])
                self.config = draft_data["data"]

        temp_chatbot = TempChatbot(draft)

        # Process message (same logic)
        if not session_id:
            session_id = f"preview_{uuid4().hex[:8]}"

        response = await self.process_message(
            db=db,
            chatbot=temp_chatbot,
            user_message=user_message,
            session_id=session_id
        )

        # Update draft preview state
        draft_service.update_draft(
            draft_type=DraftType.CHATBOT,
            draft_id=draft_id,
            updates={
                "preview": {
                    "session_id": session_id,
                    "last_message": user_message,
                    "last_response": response["response"],
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        )

        return response


    def get_chatbot_stats(
        self,
        db: Session,
        chatbot_id: UUID
    ) -> dict:
        """
        Get chatbot usage statistics.

        WHY: Analytics dashboard
        HOW: Aggregate session and message data

        RETURNS:
            {
                "total_sessions": 100,
                "total_messages": 500,
                "avg_messages_per_session": 5.0
            }
        """

        from app.models.chatbot import Chatbot

        chatbot = db.query(Chatbot).get(chatbot_id)
        if not chatbot:
            raise ValueError("Chatbot not found")

        stats = self.session_service.get_session_stats(
            db=db,
            workspace_id=chatbot.workspace_id,
            bot_type="chatbot",
            bot_id=chatbot_id
        )

        return stats


# Global instance
chatbot_service = ChatbotService()
