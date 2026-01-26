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

import re
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
        collected_variables: Optional[dict] = None,
        platform: str = "web"
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
            platform: Deployment channel ("widget", "hosted_page", "telegram", etc.)
                      Used for session isolation - same session_id on different
                      platforms will create separate sessions.

        RETURNS:
            {
                "response": "AI response text",
                "sources": [...],  # RAG sources (if KB used)
                "session_id": "uuid",
                "message_id": "uuid"
            }
        """

        # 1. Get or create session (isolated by bot_id, workspace_id, platform)
        session = self.session_service.get_or_create_session(
            db=db,
            bot_type="chatbot",
            bot_id=chatbot.id,
            session_id=session_id,
            workspace_id=chatbot.workspace_id,
            channel_context=channel_context,
            platform=platform
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

        # Debug: Log history retrieval for troubleshooting context loss
        print(f"[ChatbotService] Memory enabled: {memory_config.get('enabled', True)}, Retrieved {len(history)} messages from history")
        if history:
            for i, msg in enumerate(history):
                preview = msg.content[:50].replace('\n', ' ')
                print(f"[ChatbotService]   History[{i}]: {msg.role.value}: {preview}...")

        # 4b. AFFIRMATIVE FALLBACK: If KB returned 0 results AND message is affirmative
        # WHY: "yes please" returns 0 KB results, breaking follow-up conversation
        # HOW: Detect affirmative, use previous AI response as continuation context
        # CRITICAL: Only enable in GUIDED/FLEXIBLE modes. In STRICT mode, previous
        # responses may have been hallucinated, so we can't safely continue from them.
        grounding_mode = chatbot.config.get("grounding_mode",
                         chatbot.config.get("behavior", {}).get("grounding_mode", "strict"))
        allow_affirmative_fallback = grounding_mode != "strict"

        if allow_affirmative_fallback and not context and self._is_affirmative_response(user_message) and history:
            # Find the last assistant message
            last_ai_msg = next(
                (msg for msg in reversed(history) if msg.role.value == "assistant"),
                None
            )
            if last_ai_msg:
                # Use previous AI response as context for continuation
                context = f"CONTINUING FROM YOUR PREVIOUS RESPONSE:\n{last_ai_msg.content}\n\nThe user said '{user_message}' to affirm/continue. Please continue naturally from where you left off."
                print(f"[ChatbotService] KB=0 + affirmative detected - using previous AI context for continuation")

        # 4c. META-QUESTION FALLBACK: If user asks about previous response
        # WHY: "how did you know that" shouldn't trigger "I don't have info" when we just provided info
        # HOW: Detect meta-questions and use previous AI response as context
        if not context and self._is_meta_question(user_message) and history:
            last_ai_msg = next(
                (msg for msg in reversed(history) if msg.role.value == "assistant"),
                None
            )
            if last_ai_msg and len(last_ai_msg.content) > 50:
                # Use previous response as context - they're asking about it
                context = f"CONTEXT FROM YOUR PREVIOUS RESPONSE (user is asking about this):\n{last_ai_msg.content}\n\nThe user is asking about how you know this or where it came from. Respond naturally - this information came from your knowledge base. Stay in character and don't refer to yourself in third person."
                print(f"[ChatbotService] Meta-question detected - using previous response as context")

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

            # 6a. CRITICAL: Substitute variables in AI response BEFORE saving
            # WHY: Without this, {{name}} and [name] leak into saved history
            # HOW: Reuse the same substitution method used for system prompts
            response_text = self._substitute_variables(response_text, collected_variables)

            # 6b. Clear sources if AI indicates no information found
            # WHY: Don't show sources when AI couldn't answer from KB - it's confusing
            # HOW: Check for common "I don't have information" phrases + hallucination indicators
            response_lower = response_text.lower()
            no_info_indicators = [
                # Existing patterns - explicit refusals
                "i don't have that information",
                "i don't have information",
                "i don't have any specific information",
                "don't have any specific information",
                "i don't have specific information",
                "not in my current context",
                "i'm not sure about that",
                "i cannot find",
                "no relevant information",
                "don't have specific information",
                "i don't have any information",
                "i couldn't find",
                "not available in my knowledge",
                # NEW: Patterns indicating AI used general/training knowledge
                "based on general knowledge",
                "from what i know",
                "generally speaking",
                "while the document doesn't",
                "although the context doesn't",
                "the document doesn't specifically mention",
                "not mentioned in the context",
                "outside of the provided context",
                "beyond what's in the knowledge base",
                "from my understanding",
                "in my experience",
                "based on my training",
                "from technical documentation",  # AI lie when hallucinating
            ]
            if any(indicator in response_lower for indicator in no_info_indicators):
                print(f"[ChatbotService] AI indicated no info found, clearing {len(sources)} sources")
                sources = []

            # 6c. Validate sources are actually relevant to response
            # WHY: Don't cite sources if AI didn't use retrieved content
            # HOW: Check for meaningful word overlap between source and response
            if sources and context:
                validated_sources = []

                for source in sources:
                    source_content = source.get("content", "").lower()
                    # Check for meaningful overlap (not just common words)
                    source_words = set(source_content.split())
                    response_words = set(response_lower.split())

                    # Remove common stop words
                    stop_words = {
                        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
                        "have", "has", "had", "do", "does", "did", "will", "would", "could",
                        "should", "may", "might", "must", "shall", "can", "need", "to", "and",
                        "but", "or", "nor", "for", "yet", "so", "in", "on", "at", "by", "with",
                        "from", "as", "into", "through", "during", "before", "after", "above",
                        "below", "between", "under", "again", "further", "then", "once", "here",
                        "there", "when", "where", "why", "how", "all", "each", "few", "more",
                        "most", "other", "some", "such", "no", "not", "only", "own", "same",
                        "than", "too", "very", "just", "also", "now", "of", "it", "i", "you",
                        "he", "she", "we", "they", "this", "that", "these", "those", "about",
                        "what", "which", "who", "whom", "your", "my", "me", "him", "her", "its"
                    }
                    source_words = source_words - stop_words
                    response_words = response_words - stop_words

                    # Require at least 3 meaningful word matches
                    overlap = len(source_words & response_words)
                    if overlap >= 3:
                        validated_sources.append(source)

                if len(validated_sources) < len(sources):
                    print(f"[ChatbotService] Source validation: {len(sources)} → {len(validated_sources)} (removed irrelevant)")

                sources = validated_sources

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
                "session_id": session_id,  # Return original string, not UUID (prevents feedback loop)
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

    def _is_affirmative_response(self, message: str) -> bool:
        """
        Detect if user message is an affirmative response to AI's suggestion.

        WHY: "yes please" returns 0 KB results, breaking conversation flow.
             When KB returns empty AND user message is affirmative, we should
             use the previous AI response as context for continuation.
        HOW: Pattern matching for common affirmative phrases

        RETURNS:
            True if message appears to be affirming a previous suggestion
        """
        message_lower = message.lower().strip()

        # Direct affirmatives
        affirmatives = [
            "yes", "yeah", "yep", "yup", "sure", "ok", "okay",
            "yes please", "please", "go ahead", "continue",
            "tell me more", "more info", "more details",
            "sounds good", "that sounds good", "perfect",
            "i'd like that", "i would like that", "definitely",
            "absolutely", "of course", "why not", "let's do it"
        ]

        # Ordinal selections (for "Would you like X or Y?" suggestions)
        ordinals = [
            "the first one", "the second one", "the first", "the second",
            "first one", "second one", "option 1", "option 2",
            "1", "2", "a", "b"
        ]

        # Check exact match or starts with
        for pattern in affirmatives + ordinals:
            if message_lower == pattern or message_lower.startswith(pattern + " "):
                return True

        # Check if message is very short and contains affirmative keyword
        if len(message_lower) < 25:
            for pattern in ["yes", "sure", "ok", "please", "go ahead"]:
                if pattern in message_lower:
                    return True

        return False

    def _is_meta_question(self, message: str) -> bool:
        """
        Detect if user is asking about a previous response (meta-question).

        WHY: "how did you know that" shouldn't trigger fresh KB search and
             shouldn't result in "I don't have information" when we just provided info.
        HOW: Pattern matching for common meta-question phrases

        RETURNS:
            True if message appears to be asking about the bot's previous response
        """
        message_lower = message.lower().strip()

        meta_patterns = [
            "how did you know",
            "how do you know",
            "where did you get",
            "where did that come from",
            "what's your source",
            "what is your source",
            "how did you find",
            "where did you find",
            "tell me more about what you just said",
            "can you explain that",
            "what do you mean",
            "explain that",
            "how do you know that",
            "where is that from",
            "source?",
            "how come you know",
        ]

        for pattern in meta_patterns:
            if pattern in message_lower:
                return True

        return False

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
        kbs_with_results = 0  # Track how many KBs contributed results

        for kb_config in chatbot.config.get("knowledge_bases", []):
            if not kb_config.get("enabled"):
                continue

            kb_id = kb_config["kb_id"]

            # Log KB state for debugging 0-result issues
            from app.models.knowledge_base import KnowledgeBase
            kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
            if kb:
                print(f"[ChatbotService] KB {kb_id}: status={kb.status}, chunks={kb.total_chunks}")
                if kb.status != "ready":
                    print(f"[ChatbotService] ⚠️ KB {kb_id} not ready (status={kb.status})")
                if kb.total_chunks == 0:
                    print(f"[ChatbotService] ⚠️ KB {kb_id} has 0 chunks - search will return empty")
            else:
                print(f"[ChatbotService] ⚠️ KB {kb_id} not found in database")

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

                if results:
                    kbs_with_results += 1
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

        # Add synthesis hint when multiple KBs contributed results
        if kbs_with_results > 1 and context:
            context = f"The following information comes from your knowledge base:\n\n{context}\n\n(Synthesize this information naturally - don't mention multiple sources)"

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

        CRITICAL: Even when variables=None, we MUST remove {{var}} placeholders
        to prevent literal template syntax from appearing in AI responses.

        ARGS:
            text: Text containing {{variable}} placeholders
            variables: Dict of variable_name -> value mappings

        RETURNS:
            Text with placeholders replaced by values (or [var_name] if undefined)
        """
        if not text:
            return text

        # Use empty dict if variables is None - this ensures regex ALWAYS runs
        # to remove any {{var}} placeholders that would otherwise appear literally
        vars_dict = variables or {}

        def replace_var(match):
            var_name = match.group(1).strip()
            value = vars_dict.get(var_name)
            if value is not None:
                return str(value)
            # Return descriptive placeholder instead of empty string
            # This helps AI understand it's a variable that will be filled later
            # e.g., {{name}} → [name], {{email}} → [email]
            return f"[{var_name}]"

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

        # 1a. Base system prompt - always substitute variables (removes {{var}} even if undefined)
        base_prompt = config.get("system_prompt", "You are a helpful assistant.")
        base_prompt = self._substitute_variables(base_prompt, collected_variables)
        system_parts.append(base_prompt)

        # 1b. Persona settings (name, tone, style) - always substitute variables
        persona = config.get("persona", {})
        if persona:
            persona_parts = []
            if persona.get("name"):
                name = self._substitute_variables(persona['name'], collected_variables)
                persona_parts.append(f"Your name is {name}.")
            if persona.get("tone"):
                tone = self._substitute_variables(persona['tone'], collected_variables)
                persona_parts.append(f"Use a {tone} tone.")
            if persona.get("style"):
                style = self._substitute_variables(persona['style'], collected_variables)
                persona_parts.append(f"Your communication style is {style}.")
            if persona_parts:
                system_parts.append("\n".join(persona_parts))

        # 1c. Instructions (specific behaviors to follow) - always substitute variables
        instructions = config.get("instructions", [])
        if instructions:
            # Build conversation summary from history and inject BEFORE instructions
            # WHY: LLMs prioritize system prompt instructions over history context.
            # By placing a summary RIGHT BEFORE instructions, the LLM sees what's
            # already happened and naturally skips completed actions.
            if history and len(history) > 0:
                summary_parts = []
                for msg in history[-6:]:  # Last 6 messages for context
                    role = "User" if msg.role.value == "user" else "Assistant"
                    # Truncate content for brevity but keep enough for context
                    content_preview = msg.content[:80].replace('\n', ' ')
                    if len(msg.content) > 80:
                        content_preview += "..."
                    summary_parts.append(f"- {role}: {content_preview}")

                conversation_summary = "\n".join(summary_parts)
                instruction_text = f"""
CONVERSATION SO FAR:
{conversation_summary}

INSTRUCTIONS (DO NOT repeat actions already completed above):
"""
            else:
                instruction_text = "\n\nINSTRUCTIONS:\n"

            for i, instr in enumerate(instructions, 1):
                if isinstance(instr, dict):
                    text = instr.get('text', instr.get('content', ''))
                else:
                    text = str(instr)
                # Always apply variable substitution (removes {{var}} even if undefined)
                text = self._substitute_variables(text, collected_variables)
                instruction_text += f"{i}. {text}\n"
            system_parts.append(instruction_text)

        # 1d. Restrictions (things to avoid) - always substitute variables
        restrictions = config.get("restrictions", [])
        if restrictions:
            restriction_text = "\nRESTRICTIONS - Do NOT do the following:\n"
            for i, restr in enumerate(restrictions, 1):
                if isinstance(restr, dict):
                    text = restr.get('text', restr.get('content', ''))
                else:
                    text = str(restr)
                # Always apply variable substitution (removes {{var}} even if undefined)
                text = self._substitute_variables(text, collected_variables)
                restriction_text += f"- {text}\n"
            system_parts.append(restriction_text)

        # 1e. Behavior settings (citations, follow-ups)
        behavior = config.get("behavior", {})
        behavior_parts = []

        if behavior.get("show_citations", False):
            behavior_parts.append("When using information from the knowledge base, cite your sources by mentioning where the information came from.")

        if behavior.get("show_followups", False):
            behavior_parts.append("At the end of your response, suggest 1-2 follow-up questions ONLY about topics that are actually in your knowledge base context. Never suggest topics from your general training data.")

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

            # Check if we recently provided substantial information (within last 2 turns)
            # WHY: Don't say "I don't have info" if we JUST provided info - that's contradictory
            recently_provided_info = False
            if history and len(history) >= 2:
                last_ai_msg = next(
                    (msg for msg in reversed(history) if msg.role.value == "assistant"),
                    None
                )
                if last_ai_msg and len(last_ai_msg.content) > 100:
                    recently_provided_info = True
                    print(f"[ChatbotService] Recently provided substantial info ({len(last_ai_msg.content)} chars) - avoiding contradiction")

            if recently_provided_info:
                # Don't say "I don't have info" if we just provided info - prevent contradiction
                system_parts.append("""
NOTE: Your knowledge base search returned no new results for this specific query,
but you recently provided information in this conversation.

RULES:
- If the user is asking about your previous response (follow-up, clarification), respond naturally based on what you already said
- If they're asking about a genuinely NEW topic not in your KB, you may say you don't have specific information on that new topic
- NEVER contradict information you already provided in this conversation
- Stay in character - don't refer to yourself as "the assistant" or analyze your own behavior
- Speak naturally as if the knowledge is yours

Custom BEHAVIORAL INSTRUCTIONS defined earlier (like "ask for user's name") MUST still be followed.
""")
            elif grounding_mode == "strict":
                system_parts.append("""
NOTE: No specific match was found in your knowledge base for this query.

RULES:
- For greetings/conversation ("hi", "hello", "thanks", "ok"): Respond naturally AND follow your behavioral instructions
- For topic questions: Say "I don't have specific information about that topic. Could you try rephrasing or ask about something else?"
- NEVER say "I don't have a general knowledge base" - you DO have one, this query just didn't match
- NEVER expose internal workings ("based on the provided context", "according to my context", "in my knowledge base")
- Speak naturally as if the knowledge is yours

Custom BEHAVIORAL INSTRUCTIONS defined earlier (like "ask for user's name") MUST still be followed.
""")
            elif grounding_mode == "guided":
                system_parts.append("""
NOTE - GUIDED KNOWLEDGE BASE MODE:
Your knowledge base was searched but returned NO relevant information for this query.

You MAY answer using general knowledge, but you MUST clearly disclose this by starting with:
"I don't have specific information about this in my knowledge base, but based on general knowledge..."

Always be transparent about what comes from the knowledge base vs. general knowledge.
""")
            elif grounding_mode == "flexible":
                system_parts.append("""
NOTE - FLEXIBLE KNOWLEDGE BASE MODE:
Your knowledge base was searched but returned NO relevant information for this query.

You may answer using general knowledge without disclosure. However:
- For vague requests like "tell me something", ask what they're interested in
- If they ask about a topic later that IS in your KB, use that KB info
- Never claim to have KB info you don't have
""")

        # Combine all system parts
        system_content = "\n\n".join(part for part in system_parts if part.strip())

        messages.append({"role": "system", "content": system_content})

        # 2. Chat history (previous messages)
        # Sanitize history to remove any leftover {{var}} patterns from old responses
        var_pattern = re.compile(r'\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}')
        if history:
            for msg in history:
                role = "user" if msg.role.value == "user" else "assistant"
                # Remove any {{variable}} patterns that might have leaked into old responses
                sanitized_content = var_pattern.sub('', msg.content)
                messages.append({"role": role, "content": sanitized_content})

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
        from sqlalchemy import func, Integer, select
        from app.models.chat_message import ChatMessage, MessageRole
        from app.models.chat_session import ChatSession

        try:
            # Get real-time stats from session service
            stats = self.session_service.get_session_stats(
                db=db,
                workspace_id=chatbot.workspace_id,
                bot_type="chatbot",
                bot_id=chatbot.id
            )

            # Calculate average response time from messages
            # Note: ChatSession uses polymorphic design (bot_type + bot_id), not chatbot_id
            session_ids_subquery = select(ChatSession.id).where(
                ChatSession.bot_type == "chatbot",
                ChatSession.bot_id == chatbot.id
            )

            avg_response_time = db.query(
                func.avg(
                    ChatMessage.response_metadata['latency_ms'].astext.cast(Integer)
                )
            ).filter(
                ChatMessage.session_id.in_(session_ids_subquery),
                ChatMessage.role == MessageRole.ASSISTANT,
                ChatMessage.response_metadata.isnot(None),
                ChatMessage.response_metadata['latency_ms'].isnot(None)
            ).scalar() or 0

            # Update cached_metrics
            chatbot.cached_metrics = {
                "total_conversations": stats.get("total_sessions", 0),
                "total_messages": stats.get("total_messages", 0),
                "avg_messages_per_session": stats.get("avg_messages_per_session", 0),
                "active_sessions": stats.get("active_sessions", 0),
                "avg_response_time_ms": int(avg_response_time),
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
