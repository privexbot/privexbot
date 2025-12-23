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
from app.services.retrieval_service import retrieval_service
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
        self.retrieval_service = retrieval_service


    async def process_message(
        self,
        db: Session,
        chatbot: Chatbot,
        user_message: str,
        session_id: str,
        channel_context: Optional[dict] = None,
        collected_variables: Optional[dict] = None
    ) -> dict:
        """
        Process user message through chatbot.

        FLOW:
        1. Get or create session
        2. Save user message
        3. Retrieve context from KB (if configured)
        4. Get chat history
        5. Build prompt (with variable substitution)
        6. Call AI (inference_service)
        7. Save assistant message
        8. Return response

        ARGS:
            db: Database session
            chatbot: Chatbot model instance
            user_message: User's input text
            session_id: Conversation session ID
            channel_context: Channel-specific data (e.g., Telegram user_id)
            collected_variables: User-collected variables for {{variable}} substitution

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

        # 5. Build structured messages for AI (with variable substitution)
        messages = self._build_messages(
            chatbot=chatbot,
            user_message=user_message,
            context=context,
            history=history,
            collected_variables=collected_variables
        )

        # 6. Call AI with structured messages
        # This automatically routes to the correct provider based on model prefix
        # e.g., "gemini-2.0-flash" -> Gemini, "gpt-4o" -> OpenAI, etc.
        try:
            ai_response = await self.inference_service.generate_chat(
                messages=messages,
                model=chatbot.config.get("model"),  # None = use default
                temperature=chatbot.config.get("temperature"),  # None = use provider default
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

            # 8. Update cached metrics for dashboard consistency
            self._update_cached_metrics(db, chatbot)

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

        CONFIG PRIORITY:
            1. Chatbot Override (override_retrieval in kb_config) - highest
            2. KB-Level Config (kb.context_settings.retrieval_config)
            3. Service Defaults - lowest

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

            # Get chatbot-level override settings (if any)
            # If override is specified, use it; otherwise pass None to use KB config
            override_settings = kb_config.get("override_retrieval", {})

            # Determine what to pass to retrieval service
            # None = let retrieval service use KB config or defaults
            caller_top_k = override_settings.get("top_k") if override_settings else None
            caller_search_method = override_settings.get("search_method") if override_settings else None
            caller_threshold = override_settings.get("similarity_threshold") if override_settings else None

            try:
                # Call retrieval service with KB config wiring
                # If caller values are None, retrieval service will use KB's context_settings.retrieval_config
                results = await self.retrieval_service.search(
                    db=db,
                    kb_id=UUID(kb_id) if isinstance(kb_id, str) else kb_id,
                    query=query,
                    top_k=caller_top_k,  # None = use KB config
                    search_method=caller_search_method,  # None = use KB config
                    threshold=caller_threshold  # None = use KB config
                )

                # Add to sources
                all_sources.extend(results)

                # Add to context
                for result in results:
                    context_parts.append(result["content"])

            except Exception as e:
                # Log error but continue with other KBs
                print(f"[ChatbotService] Error retrieving from KB {kb_id}: {e}")
                continue

        # Combine context
        context = "\n\n".join(context_parts)

        return {
            "context": context,
            "sources": all_sources
        }


    def _substitute_variables(self, text: str, variables: Optional[dict]) -> str:
        """
        Substitute {{variable_name}} placeholders with collected values.

        WHY: Allow dynamic prompt customization based on user-provided data
        HOW: Simple regex replacement of {{variable}} patterns

        ARGS:
            text: Text containing {{variable}} placeholders
            variables: Dict of variable_name -> value mappings

        RETURNS:
            Text with placeholders replaced by values
        """
        import re

        if not variables or not text:
            return text

        def replace_var(match):
            var_name = match.group(1).strip()
            # Return the value if exists, otherwise keep the placeholder
            return str(variables.get(var_name, match.group(0)))

        # Match {{variable_name}} patterns (with optional whitespace)
        pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
        return re.sub(pattern, replace_var, text)

    def _build_messages(
        self,
        chatbot: Chatbot,
        user_message: str,
        context: str,
        history: list,
        collected_variables: Optional[dict] = None
    ) -> list:
        """
        Build structured messages for AI model.

        WHY: Modern LLMs (OpenAI, Gemini, etc.) work better with structured messages
        HOW: Build list of role/content dicts with system, history, and user messages

        RETURNS:
            [
                {"role": "system", "content": "You are a helpful assistant..."},
                {"role": "user", "content": "Previous user message"},
                {"role": "assistant", "content": "Previous response"},
                {"role": "user", "content": "Current user message"}
            ]
        """
        messages = []

        # 1. System prompt (with optional KB context embedded)
        system_prompt = chatbot.config.get("system_prompt", "You are a helpful assistant.")

        # Substitute variables in system prompt if provided
        # Example: "You are helping {{user_name}} from {{company}}."
        # becomes: "You are helping John from Acme Inc."
        if collected_variables:
            system_prompt = self._substitute_variables(system_prompt, collected_variables)

        # If we have KB context, add it to system prompt
        if context:
            system_content = f"""{system_prompt}

Use the following context from the knowledge base to answer questions. If the context doesn't contain relevant information, say so honestly.

Context:
{context}"""
        else:
            system_content = system_prompt

        messages.append({"role": "system", "content": system_content})

        # 2. Chat history (previous messages)
        if history:
            for msg in history:
                role = "user" if msg.role.value == "user" else "assistant"
                messages.append({"role": role, "content": msg.content})

        # 3. Current user message
        messages.append({"role": "user", "content": user_message})

        return messages

    def _build_prompt(
        self,
        chatbot: Chatbot,
        user_message: str,
        context: str,
        history: list
    ) -> str:
        """
        DEPRECATED: Use _build_messages() instead.

        Kept for backward compatibility with any code that might still use it.
        Converts structured messages to a single prompt string.
        """
        messages = self._build_messages(chatbot, user_message, context, history)

        parts = []
        for msg in messages:
            role = msg["role"].capitalize()
            parts.append(f"{role}: {msg['content']}")

        parts.append("Assistant:")
        return "\n\n".join(parts)


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


    def _update_cached_metrics(self, db: Session, chatbot: Chatbot) -> None:
        """
        Update cached metrics for dashboard display.

        WHY: Keep cached_metrics in sync with actual data for list/detail pages
        HOW: Query session stats and update chatbot.cached_metrics

        Called after each message is processed.
        """
        from datetime import datetime

        try:
            # Get real-time stats from session service
            stats = self.session_service.get_session_stats(
                db=db,
                workspace_id=chatbot.workspace_id,
                bot_type="chatbot",
                bot_id=chatbot.id
            )

            # Update cached_metrics
            chatbot.cached_metrics = {
                "total_conversations": stats.get("total_sessions", 0),
                "total_messages": stats.get("total_messages", 0),
                "avg_messages_per_session": stats.get("avg_messages_per_session", 0),
                "active_sessions": stats.get("active_sessions", 0),
                "last_updated": datetime.utcnow().isoformat()
            }

            db.commit()

        except Exception as e:
            # Log error but don't fail the request
            print(f"[ChatbotService] Error updating cached_metrics: {e}")


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
