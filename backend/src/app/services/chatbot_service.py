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

import time
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

    def _update_session_metadata(self, db: Session, session, updates: dict):
        """
        Atomically update session metadata using PostgreSQL JSONB merge.

        WHY: Prevents race conditions when multiple requests update metadata concurrently.
        The || operator atomically merges JSONB objects at the database level,
        ensuring no data is lost from concurrent updates.

        HOW: Uses PostgreSQL's native JSONB || operator which:
        1. Takes existing metadata (or {} if null)
        2. Merges with new updates (new values win on key collision)
        3. All in a single atomic operation
        """
        import json
        from sqlalchemy import text

        db.execute(text("""
            UPDATE chat_sessions
            SET session_metadata = COALESCE(session_metadata, '{}')::jsonb || CAST(:updates AS jsonb)
            WHERE id = :session_id
        """), {"session_id": str(session.id), "updates": json.dumps(updates)})
        db.commit()
        db.refresh(session)


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

        # 1.5. Check if this is a consent response (early processing)
        metadata = session.session_metadata or {}
        if metadata.get("consent_prompted") and metadata.get("consent_given") is None:
            consent_response = self._parse_consent_response(user_message)
            if consent_response is not None:
                # Use atomic update to prevent race conditions
                self._update_session_metadata(db, session, {
                    "consent_given": consent_response,
                    "consent_timestamp": datetime.utcnow().isoformat()
                })

                if consent_response:
                    # Trigger lead capture now that consent is given
                    await self._trigger_lead_capture_after_consent(db, session, chatbot)

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

        # 4. Get chat history for memory (only if enabled)
        memory_config = chatbot.config.get("memory", {})
        if memory_config.get("enabled", True):
            history = self.session_service.get_context_messages(
                db=db,
                session_id=session.id,
                max_messages=memory_config.get("max_messages", 10)
            )
        else:
            history = []  # Memory disabled - stateless conversation

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
            start_time = time.time()
            ai_response = await self.inference_service.generate_chat(
                messages=messages,
                model=chatbot.config.get("model"),  # None = use default
                temperature=chatbot.config.get("temperature"),  # None = use provider default
                max_tokens=chatbot.config.get("max_tokens", 2000)
            )
            latency_ms = int((time.time() - start_time) * 1000)

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
                    "citation_count": len(sources),
                    "latency_ms": latency_ms
                },
                prompt_tokens=tokens_used.get("prompt_tokens"),
                completion_tokens=tokens_used.get("completion_tokens")
            )

            # 8. Update cached metrics for dashboard consistency
            self._update_cached_metrics(db, chatbot)

            # Note: Consent and email prompts are now handled by the LeadCaptureForm UI
            # No longer appended to chat responses

            return {
                "response": response_text,
                "sources": sources,
                "session_id": str(session.id),
                "message_id": str(assistant_msg.id)
            }

        except Exception as e:
            # Rollback any uncommitted changes to ensure clean state
            db.rollback()

            try:
                # Save error message in a clean transaction
                error_msg = self.session_service.save_message(
                    db=db,
                    session_id=session.id,
                    role="assistant",
                    content="I'm sorry, I encountered an error processing your message.",
                    error=str(e),
                    error_code="generation_error"
                )
                db.commit()
            except Exception as save_error:
                # If we can't save the error message, just log it
                print(f"[ChatbotService] Failed to save error message: {save_error}")

            raise


    async def _should_prompt_for_consent(
        self,
        db: Session,
        session,
        chatbot: Chatbot
    ) -> Optional[str]:
        """
        Check if we need to ask for consent before capturing data.

        WHY: GDPR compliance - explicit consent before data capture
        HOW: Check lead_capture_config.privacy.require_consent

        RETURNS:
            Consent prompt message if should prompt, None otherwise
        """
        lead_config = getattr(chatbot, "lead_capture_config", None) or {}

        if not lead_config.get("enabled"):
            return None

        privacy = lead_config.get("privacy", {})
        if not privacy.get("require_consent", False):
            return None

        metadata = session.session_metadata or {}
        if metadata.get("consent_prompted"):
            return None  # Already asked

        # Return consent message
        return privacy.get("consent_message",
            "We'd like to save your information to follow up with you. Reply 'yes' to agree or 'no' to decline.")

    async def _should_prompt_for_email(
        self,
        db: Session,
        session,
        chatbot: Chatbot
    ) -> Optional[str]:
        """
        Check if we should prompt user for email (messaging platforms only).

        WHY: Capture email for leads after X messages on messaging platforms
        HOW: Check lead_capture_config timing, platform settings, message count

        RETURNS:
            Email prompt message if should prompt, None otherwise

        NOTE: Web/widget platforms use form-based capture, not conversation prompts
        """
        lead_config = getattr(chatbot, "lead_capture_config", None) or {}

        # Check if feature enabled
        if not lead_config.get("enabled"):
            return None

        # Check timing - only prompt for email when timing is "after_n_messages"
        # "before_chat" uses form-based capture on web, handled elsewhere
        timing = lead_config.get("timing", "before_chat")
        if timing != "after_n_messages":
            return None

        # Get platform from session metadata
        metadata = session.session_metadata or {}
        platform = metadata.get("platform") or "widget"

        # Skip web/widget platforms - they use form-based capture
        if platform in ("widget", "web", "website"):
            return None

        # Check platform-specific settings
        platforms = lead_config.get("platforms", {})
        platform_config = platforms.get(platform, {})

        # Platform must be enabled AND prompt_for_email must be true
        if not platform_config.get("enabled", False):
            return None
        if not platform_config.get("prompt_for_email", False):
            return None

        # Check if already prompted
        if metadata.get("email_prompted"):
            return None

        # Check message count threshold
        threshold = lead_config.get("messages_before_prompt", 3)
        if session.message_count < threshold:
            return None

        # Check if lead already has email
        from app.services.lead_capture_service import lead_capture_service

        # Get original session_id string from metadata
        original_session_id = metadata.get("original_session_id") or str(session.id)

        existing_lead = await lead_capture_service.check_lead_exists(
            db, chatbot.workspace_id, original_session_id
        )

        if existing_lead and existing_lead.email and "@placeholder" not in existing_lead.email:
            return None  # Already have real email

        # Return default prompt message
        return "Would you like to share your email so we can follow up with you?"

    def _parse_consent_response(self, message: str) -> Optional[bool]:
        """
        Parse user's consent response.

        WHY: Detect yes/no intent from user message
        HOW: Pattern matching on common consent phrases

        RETURNS:
            True if yes, False if no, None if unclear
        """
        message_lower = message.lower().strip()

        yes_patterns = ["yes", "yeah", "yep", "sure", "ok", "okay", "i agree", "agree", "accepted", "accept"]
        no_patterns = ["no", "nope", "nah", "no thanks", "decline", "declined", "don't", "dont"]

        for pattern in yes_patterns:
            if pattern in message_lower:
                return True

        for pattern in no_patterns:
            if pattern in message_lower:
                return False

        return None  # Unclear response

    async def _trigger_lead_capture_after_consent(
        self,
        db: Session,
        session,
        chatbot: Chatbot
    ):
        """
        Trigger lead capture after user gives consent.

        WHY: Now that consent is given, capture the lead
        HOW: Determine platform and capture with appropriate method
        """
        from app.services.lead_capture_service import lead_capture_service

        # Get platform from session metadata
        metadata = session.session_metadata or {}
        platform = metadata.get("platform") or "widget"

        # For widget/web, we don't have email yet - just mark consent
        # For other platforms, trigger the appropriate capture
        if platform in ("widget", "web"):
            # Widget leads need form submission - just mark session
            return

        # Get session_id from metadata (stored by session_service)
        session_id = metadata.get("original_session_id") or str(session.id)

        # Platform-specific lead capture
        if platform == "telegram":
            await lead_capture_service.capture_from_telegram(
                db=db,
                workspace_id=chatbot.workspace_id,
                bot_id=chatbot.id,
                bot_type="chatbot",
                session_id=session_id,
                telegram_user_id=str(metadata.get("user_id", "")),
                telegram_username=metadata.get("username"),
                first_name=metadata.get("first_name"),
                last_name=metadata.get("last_name"),
                consent_given=True
            )

        elif platform == "discord":
            await lead_capture_service.capture_from_discord(
                db=db,
                workspace_id=chatbot.workspace_id,
                bot_id=chatbot.id,
                bot_type="chatbot",
                session_id=session_id,
                discord_user_id=str(metadata.get("user_id", "")),
                discord_username=metadata.get("username", ""),
                guild_id=metadata.get("guild_id"),
                guild_name=metadata.get("guild_name"),
                consent_given=True
            )

        elif platform == "whatsapp":
            # WhatsApp stores phone in from_number or user_id
            phone = metadata.get("from_number") or metadata.get("user_id") or ""
            await lead_capture_service.capture_from_whatsapp(
                db=db,
                workspace_id=chatbot.workspace_id,
                bot_id=chatbot.id,
                bot_type="chatbot",
                session_id=session_id,
                phone=str(phone),
                wa_id=str(metadata.get("user_id", "")),
                profile_name=metadata.get("display_name"),
                consent_given=True
            )


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

        # Debug logging to trace KB context retrieval
        print(f"[ChatbotService] Retrieved context: {len(context)} chars from {len(all_sources)} sources")
        if context:
            print(f"[ChatbotService] Context preview: {context[:200]}...")

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
            value = variables.get(var_name)
            if value is not None:
                return str(value)
            # Fallback: Use empty string instead of keeping {{var}} literal
            # This prevents template syntax from leaking into AI responses
            return ""

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

        APPLIES ALL CONFIGURATIONS:
        - system_prompt: Base personality and role
        - persona: Name, tone, style settings
        - instructions: Specific behaviors to follow
        - restrictions: Things to avoid
        - grounding_mode: How strictly to use KB (strict/guided/flexible)
        - behavior.show_citations: Whether to cite sources
        - behavior.show_followups: Whether to suggest follow-up questions

        RETURNS:
            [
                {"role": "system", "content": "You are a helpful assistant..."},
                {"role": "user", "content": "Previous user message"},
                {"role": "assistant", "content": "Previous response"},
                {"role": "user", "content": "Current user message"}
            ]
        """
        messages = []
        config = chatbot.config

        # 1. Build the complete system prompt with all configurations
        system_parts = []

        # 1a. Base system prompt
        base_prompt = config.get("system_prompt", "You are a helpful assistant.")
        if collected_variables:
            base_prompt = self._substitute_variables(base_prompt, collected_variables)
        system_parts.append(base_prompt)

        # 1b. Persona settings (name, tone, style) - with variable substitution
        persona = config.get("persona", {})
        if persona:
            persona_parts = []
            if persona.get("name"):
                name = self._substitute_variables(persona['name'], collected_variables) if collected_variables else persona['name']
                persona_parts.append(f"Your name is {name}.")
            if persona.get("tone"):
                tone = self._substitute_variables(persona['tone'], collected_variables) if collected_variables else persona['tone']
                persona_parts.append(f"Use a {tone} tone.")
            if persona.get("style"):
                style = self._substitute_variables(persona['style'], collected_variables) if collected_variables else persona['style']
                persona_parts.append(f"Your communication style is {style}.")
            if persona_parts:
                system_parts.append("\n".join(persona_parts))

        # 1c. Instructions (specific behaviors to follow) - with variable substitution
        instructions = config.get("instructions", [])
        if instructions:
            instruction_text = "\n\nINSTRUCTIONS - Follow these behaviors:\n"
            for i, instr in enumerate(instructions, 1):
                if isinstance(instr, dict):
                    text = instr.get('text', instr.get('content', ''))
                else:
                    text = str(instr)
                # Apply variable substitution to instruction text
                if collected_variables:
                    text = self._substitute_variables(text, collected_variables)
                instruction_text += f"{i}. {text}\n"
            system_parts.append(instruction_text)

        # 1d. Restrictions (things to avoid) - with variable substitution
        restrictions = config.get("restrictions", [])
        if restrictions:
            restriction_text = "\nRESTRICTIONS - Do NOT do the following:\n"
            for i, restr in enumerate(restrictions, 1):
                if isinstance(restr, dict):
                    text = restr.get('text', restr.get('content', ''))
                else:
                    text = str(restr)
                # Apply variable substitution to restriction text
                if collected_variables:
                    text = self._substitute_variables(text, collected_variables)
                restriction_text += f"- {text}\n"
            system_parts.append(restriction_text)

        # 1e. Behavior settings (citations, follow-ups)
        behavior = config.get("behavior", {})
        behavior_parts = []

        if behavior.get("show_citations", False):
            behavior_parts.append("When using information from the knowledge base, cite your sources by mentioning where the information came from.")

        if behavior.get("show_followups", False):
            behavior_parts.append("At the end of your response, suggest 1-2 relevant follow-up questions the user might want to ask.")

        if behavior_parts:
            system_parts.append("\nRESPONSE FORMAT:\n" + "\n".join(f"- {bp}" for bp in behavior_parts))

        # 1f. Knowledge base context with grounding mode
        # ALWAYS apply grounding when KB is configured, even if context is empty
        has_kb_configured = bool(config.get("knowledge_bases"))
        grounding_mode = config.get("grounding_mode", behavior.get("grounding_mode", "strict"))

        if context:
            # Normal case: KB returned results, apply grounding with context
            print(f"[ChatbotService] Injecting KB context with grounding_mode={grounding_mode}, context_length={len(context)}")

            # Import guardrails service for proper grounding prompts
            try:
                from app.services.guardrails import get_guardrails_service, GroundingMode

                guardrails = get_guardrails_service()

                # Map string to enum
                mode_map = {
                    "strict": GroundingMode.STRICT,
                    "guided": GroundingMode.GUIDED,
                    "flexible": GroundingMode.FLEXIBLE
                }
                mode = mode_map.get(grounding_mode, GroundingMode.STRICT)

                # Get the appropriate grounding prompt (without custom_prompt since we're building it)
                from app.services.guardrails import GROUNDING_PROMPTS
                grounding_prompt = GROUNDING_PROMPTS[mode].format(context=context)
                system_parts.append(grounding_prompt)

            except ImportError:
                # Fallback if guardrails not available
                system_parts.append(f"""
KNOWLEDGE BASE CONTEXT:
Use the following context to answer questions. If the context doesn't contain relevant information, say so honestly.

Context:
{context}""")

        elif has_kb_configured:
            # KB is configured but returned NO results - apply empty context grounding
            print(f"[ChatbotService] KB configured but no context found, applying {grounding_mode} mode restrictions")

            if grounding_mode == "strict":
                system_parts.append("""
STRICT MODE - NO KB RESULTS FOR THIS QUERY:

Your knowledge base was searched but found NO relevant information.

═══════════════════════════════════════════════════════════════
RULE: For any question about a topic, fact, or concept:
→ Respond: "I don't have that information in my current context, but if you can provide more details or rephrase the question, I'll try to help."
═══════════════════════════════════════════════════════════════

EXCEPTIONS (respond naturally):
- "hi", "hello" → Greet back
- "ok", "thanks", "hmm" → Acknowledge
- Questions about THIS conversation → Clarify

DO NOT provide information from training data.
DO NOT be "helpful" by answering topic questions without KB.
DO NOT suggest topics to ask about (you don't know what's in the KB for this query).
""")
            elif grounding_mode == "guided":
                system_parts.append("""
NOTE - GUIDED KNOWLEDGE BASE MODE:
Your knowledge base was searched but returned NO relevant information for this query.

You MAY answer using general knowledge, but you MUST clearly disclose this by starting with:
"I don't have specific information about this in my knowledge base, but based on general knowledge..."

Always be transparent about what comes from the knowledge base vs. general knowledge.
""")
            # flexible mode: no restriction needed when no context

        # Combine all system parts
        system_content = "\n\n".join(part for part in system_parts if part.strip())

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
