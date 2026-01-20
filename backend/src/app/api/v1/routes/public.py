"""
Public API - Unified chat endpoint for widgets and external integrations.

WHY:
- Single API for both chatbots and chatflows
- Used by website widget, mobile apps, API integrations
- Auto-detects bot type (chatbot vs chatflow)
- No authentication required (uses API key from bot config)

HOW:
- Receive message from client
- Detect bot type
- Route to appropriate service
- Return response
"""

from fastapi import APIRouter, HTTPException, Header, Depends, Request
from pydantic import BaseModel
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, Any, Tuple

from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db


router = APIRouter(prefix="/public", tags=["public"])


class ChatRequest(BaseModel):
    """
    Chat request from widget/client.

    WHY: Validate incoming requests
    """

    message: str
    # WHY: User's input text

    session_id: Optional[str] = None
    # WHY: Resume existing conversation
    # HOW: Generate on client, persist across page reloads

    metadata: Optional[dict] = None
    # WHY: Additional context (IP, user agent, etc.)

    variables: Optional[dict] = None
    # WHY: Collected variables for {{variable}} substitution in prompts
    # HOW: Frontend collects via variable_config forms, sends with each request


class ChatResponse(BaseModel):
    """Chat response to client."""

    response: str
    # WHY: AI-generated response text

    sources: Optional[list[dict]] = None
    # WHY: RAG sources for citations

    session_id: str
    # WHY: Client stores for next request

    message_id: str
    # WHY: For feedback submission


class FeedbackRequest(BaseModel):
    """Feedback submission request."""

    rating: str  # "positive" | "negative"
    comment: Optional[str] = None


class LeadCaptureRequest(BaseModel):
    """Lead capture request."""

    session_id: str
    email: Optional[str] = None  # Made optional - validation based on config
    name: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: Optional[dict] = None
    consent_given: bool = False  # Required for GDPR compliance when configured
    ip_address: Optional[str] = None
    # Browser metadata from widget
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    language: Optional[str] = None


class EventTrackingRequest(BaseModel):
    """Widget event tracking request."""

    event_type: str  # widget_loaded, widget_opened, widget_closed, message_sent, etc.
    event_data: Optional[dict] = None
    session_id: Optional[str] = None
    timestamp: Optional[str] = None


class WidgetConfigResponse(BaseModel):
    """Widget configuration response."""

    chatbot_id: str
    name: str
    greeting: Optional[str] = None
    bot_name: Optional[str] = None
    color: Optional[str] = None
    secondary_color: Optional[str] = None
    position: Optional[str] = None
    show_branding: bool = True
    lead_config: Optional[dict] = None
    avatar_url: Optional[str] = None
    font_family: Optional[str] = None
    bubble_style: Optional[str] = None


class HostedPageConfigResponse(BaseModel):
    """Extended configuration for hosted chat page (SecretVM deployment)."""

    # Core identification
    chatbot_id: str
    workspace_slug: Optional[str] = None
    slug: Optional[str] = None
    name: str

    # Widget/Chat settings (reused from widget)
    greeting: Optional[str] = None
    bot_name: Optional[str] = None
    color: Optional[str] = None
    secondary_color: Optional[str] = None
    avatar_url: Optional[str] = None
    font_family: Optional[str] = None

    # Lead capture
    lead_config: Optional[dict] = None

    # Hosted page specific branding
    hosted_page: Optional[dict] = None
    # Structure:
    # {
    #   "enabled": true,
    #   "logo_url": "https://...",
    #   "header_text": "Welcome to Support",
    #   "footer_text": "Powered by MyBrand",
    #   "background_color": "#ffffff",
    #   "background_image": "https://...",
    #   "meta_title": "My Support Bot",
    #   "meta_description": "Get instant help...",
    #   "favicon_url": "https://...",
    #   "custom_domain": "support.mycompany.com",
    #   "domain_verified": false
    # }

    # Authentication
    auth_required: bool = False
    # True if chatbot is private and requires API key to access


@router.post("/bots/{bot_id}/chat")
async def chat(
    bot_id: UUID,
    request: ChatRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> ChatResponse:
    """
    Unified chat endpoint (works for both chatbots and chatflows).

    WHY: Widget doesn't need to know bot type
    HOW: Auto-detect type, route to service

    FLOW:
    1. Validate API key
    2. Get bot (chatbot or chatflow)
    3. Route to appropriate service
    4. Return response

    ARGS:
        bot_id: UUID of chatbot or chatflow
        request: ChatRequest with message
        authorization: API key (format: "Bearer <key>")
        db: Database session

    RETURNS:
        ChatResponse with AI response
    """

    # Check for API key - if present, validate it; if not, check if bot is public
    if authorization and authorization.startswith("Bearer "):
        # API key provided - validate it
        api_key = authorization.replace("Bearer ", "")
        bot_type, bot, workspace_id = await _validate_api_key_and_get_bot(
            db,
            bot_id,
            api_key
        )
    else:
        # No API key - check if bot is public
        bot_type, bot, workspace_id = await _get_public_bot(db, bot_id)

    # Generate session ID if not provided
    session_id = request.session_id or f"web_{uuid4().hex[:16]}"

    # DEBUG: Log session handling to diagnose context loss
    print(f"[Public API] Session: received={request.session_id}, using={session_id}")

    # Build channel context
    channel_context = {
        "platform": "web",
        "metadata": request.metadata or {}
    }

    # Route to appropriate service
    try:
        if bot_type == "chatbot":
            from app.services.chatbot_service import chatbot_service

            response = await chatbot_service.process_message(
                db=db,
                chatbot=bot,
                user_message=request.message,
                session_id=session_id,
                channel_context=channel_context,
                collected_variables=request.variables,
                platform="widget"  # Session isolation: widget vs other platforms
            )

        else:  # chatflow
            # Placeholder - chatflow_service not yet implemented
            response = {
                "response": "Chatflow support coming soon",
                "session_id": session_id,
                "message_id": str(uuid4())
            }

    except Exception as e:
        # Handle inference errors properly
        error_str = str(e).lower()
        if "rate limit" in error_str or "429" in error_str or "quota" in error_str:
            raise HTTPException(429, f"Rate limit exceeded: {str(e)[:200]}")
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")

    return ChatResponse(
        response=response["response"],
        sources=response.get("sources"),
        session_id=response["session_id"],
        message_id=response["message_id"]
    )


@router.post("/bots/{bot_id}/feedback")
async def submit_feedback(
    bot_id: UUID,
    message_id: UUID,
    request: FeedbackRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Submit feedback on a message.

    WHY: Collect user satisfaction data
    HOW: Update message feedback field

    AUTH: Public bots allow feedback without API key.
          Private bots require valid API key.
    """
    from app.models.chatbot import Chatbot
    from app.models.chat_message import ChatMessage

    # Get the chatbot first to check if it's public
    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if not bot:
        raise HTTPException(404, "Chatbot not found")

    # For private bots, require API key validation
    if not bot.is_public:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "API key required for private bots")

        api_key = authorization.replace("Bearer ", "")
        await _validate_api_key_and_get_bot(db, bot_id, api_key)

    # Get the message
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(404, "Message not found")

    # Verify message belongs to a session of this chatbot
    from app.models.chat_session import ChatSession
    session = db.query(ChatSession).filter(ChatSession.id == message.session_id).first()
    if not session or session.bot_id != bot_id:
        raise HTTPException(403, "Message does not belong to this chatbot")

    # Update feedback
    message.feedback = {
        "rating": request.rating,
        "comment": request.comment,
        "submitted_at": datetime.utcnow().isoformat()
    }
    message.feedback_at = datetime.utcnow()

    db.commit()

    return {"status": "ok"}


@router.post("/leads/capture")
async def capture_lead(
    bot_id: UUID,
    lead_request: LeadCaptureRequest,
    http_request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Capture lead from widget.

    WHY: Lead capture feature
    HOW: Create lead record with geolocation
    """

    # Validate API key
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "API key required")

    api_key = authorization.replace("Bearer ", "")
    bot_type, bot, workspace_id = await _validate_api_key_and_get_bot(
        db,
        bot_id,
        api_key
    )

    # Check if lead capture is enabled and validate fields
    lead_config = getattr(bot, "lead_capture_config", None) or {}
    if not lead_config.get("enabled", False):
        raise HTTPException(400, "Lead capture is not enabled for this chatbot")

    # Validate required fields based on config
    fields_config = lead_config.get("fields", {})
    missing_fields = []

    # Check standard fields
    if fields_config.get("email") == "required" and not lead_request.email:
        missing_fields.append("email")
    if fields_config.get("name") == "required" and not lead_request.name:
        missing_fields.append("name")
    if fields_config.get("phone") == "required" and not lead_request.phone:
        missing_fields.append("phone")

    # Check custom fields
    custom_fields_config = lead_config.get("custom_fields", [])
    request_custom_fields = lead_request.custom_fields or {}
    for cf in custom_fields_config:
        if cf.get("required") and not request_custom_fields.get(cf.get("name")):
            missing_fields.append(cf.get("label", cf.get("name")))

    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing_fields)}"
        )

    # Check consent if required
    privacy_config = lead_config.get("privacy", {})
    if privacy_config.get("require_consent", False) and not lead_request.consent_given:
        raise HTTPException(
            status_code=400,
            detail="Consent is required before submitting your information"
        )

    # Get client IP from headers (handles proxies)
    client_ip = http_request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip:
        client_ip = http_request.client.host if http_request.client else None

    # Use unified LeadCaptureService
    from app.services.lead_capture_service import lead_capture_service

    lead = await lead_capture_service.capture_from_widget(
        db=db,
        workspace_id=workspace_id,
        bot_id=bot_id,
        bot_type=bot_type,
        session_id=lead_request.session_id,
        email=lead_request.email,
        name=lead_request.name,
        phone=lead_request.phone,
        custom_fields=lead_request.custom_fields,
        ip_address=client_ip,  # Use server-captured IP
        user_agent=lead_request.user_agent,
        referrer=lead_request.referrer,
        language=lead_request.language,
        consent_given=lead_request.consent_given  # From form submission
    )

    return {"lead_id": str(lead.id)}


@router.get("/bots/{bot_id}/config")
async def get_widget_config(
    bot_id: UUID,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> WidgetConfigResponse:
    """
    Get widget configuration for a chatbot.

    WHY: Widget needs branding/appearance settings
    HOW: Return chatbot's branding_config and prompt_config.messages
    """

    # Check for API key - if present, validate it; if not, check if bot is public
    if authorization and authorization.startswith("Bearer "):
        api_key = authorization.replace("Bearer ", "")
        bot_type, bot, workspace_id = await _validate_api_key_and_get_bot(
            db,
            bot_id,
            api_key
        )
    else:
        bot_type, bot, workspace_id = await _get_public_bot(db, bot_id)

    if bot_type != "chatbot":
        raise HTTPException(400, "Only chatbots are supported")

    # Extract config from chatbot
    branding = bot.branding_config or {}
    prompt_config = bot.prompt_config or {}
    messages = prompt_config.get("messages", {})
    lead_capture = bot.lead_capture_config

    return WidgetConfigResponse(
        chatbot_id=str(bot_id),
        name=bot.name,
        greeting=messages.get("greeting"),
        bot_name=branding.get("chat_title") or prompt_config.get("persona", {}).get("name"),
        color=branding.get("primary_color"),
        secondary_color=branding.get("secondary_color"),
        position=branding.get("position", "bottom-right"),
        show_branding=True,  # Could be made configurable per plan
        lead_config=lead_capture,
        avatar_url=branding.get("avatar_url"),
        font_family=branding.get("font_family", "Inter"),
        bubble_style=branding.get("bubble_style", "rounded"),
    )


@router.post("/bots/{bot_id}/events")
async def track_widget_event(
    bot_id: UUID,
    request: EventTrackingRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Track widget analytics events.

    WHY: Collect usage analytics for chatbot owners
    HOW: Store events in widget_events table

    Events tracked:
    - widget_loaded: Widget script loaded on page
    - widget_opened: User opened chat window
    - widget_closed: User closed chat window
    - message_sent: User sent a message
    - lead_collected: Lead form submitted
    - feedback_given: User gave feedback
    """

    workspace_id = None
    bot_type = "chatbot"

    # Validate API key (optional for events - can be more lenient)
    if authorization and authorization.startswith("Bearer "):
        api_key = authorization.replace("Bearer ", "")
        try:
            bot_type, bot, workspace_id = await _validate_api_key_and_get_bot(
                db, bot_id, api_key
            )
        except HTTPException:
            # Log but don't fail for analytics
            pass

    # If no workspace_id from API key validation, try to get it from the bot
    if not workspace_id:
        from app.models.chatbot import Chatbot
        bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
        if bot:
            workspace_id = bot.workspace_id

    # Only store event if we have a workspace_id
    if workspace_id:
        from app.services.chatbot_analytics_service import chatbot_analytics_service

        try:
            await chatbot_analytics_service.store_widget_event(
                db=db,
                bot_id=bot_id,
                workspace_id=workspace_id,
                event_type=request.event_type,
                event_data=request.event_data,
                session_id=request.session_id,
                client_timestamp=request.timestamp,
                bot_type=bot_type
            )
        except Exception as e:
            # Log but don't fail the request
            print(f"Failed to store widget event: {e}")

    return {"status": "ok", "event_type": request.event_type}


# ═══════════════════════════════════════════════════════════════
# HOSTED PAGE (SecretVM) ENDPOINTS - Slug-based access
# URL: /chat/{workspace_slug}/{bot_slug}
# ═══════════════════════════════════════════════════════════════

@router.get("/chat/{workspace_slug}/{bot_slug}/config")
async def get_hosted_page_config(
    workspace_slug: str,
    bot_slug: str,
    db: Session = Depends(get_db)
) -> HostedPageConfigResponse:
    """
    Get chatbot configuration by workspace and bot slugs for hosted page.

    WHY: Allow access to chatbot via friendly slug URL with guaranteed uniqueness
    HOW: Look up workspace by slug, then chatbot by slug within that workspace

    URL format: /chat/{workspace_slug}/{bot_slug}
    Example: /chat/acme-corp/support-bot

    This is used by the public /chat/{workspace_slug}/{bot_slug} frontend page.
    """
    from app.models.chatbot import Chatbot, ChatbotStatus
    from app.models.workspace import Workspace

    # Find workspace by slug
    workspace = db.query(Workspace).filter(
        Workspace.slug == workspace_slug
    ).first()

    if not workspace:
        raise HTTPException(404, "Workspace not found")

    # Find chatbot by slug within the workspace
    bot = db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace.id,
        Chatbot.slug == bot_slug,
        Chatbot.status == ChatbotStatus.ACTIVE
    ).first()

    if not bot:
        raise HTTPException(404, "Chatbot not found")

    # Extract configurations
    branding = bot.branding_config or {}
    prompt_config = bot.prompt_config or {}
    messages = prompt_config.get("messages", {})
    hosted_page = branding.get("hosted_page", {})

    # For private bots, return limited config with auth_required flag
    # This allows the frontend to show an API key modal instead of blocking completely
    if not bot.is_public:
        return HostedPageConfigResponse(
            chatbot_id=str(bot.id),
            workspace_slug=workspace.slug,
            slug=bot.slug,
            name=bot.name,
            auth_required=True,
            # Only expose minimal branding for the auth modal
            color=branding.get("primary_color"),
            avatar_url=branding.get("avatar_url"),
        )

    return HostedPageConfigResponse(
        chatbot_id=str(bot.id),
        workspace_slug=workspace.slug,
        slug=bot.slug,
        name=bot.name,
        greeting=messages.get("greeting"),
        bot_name=branding.get("chat_title") or prompt_config.get("persona", {}).get("name"),
        color=branding.get("primary_color"),
        secondary_color=branding.get("secondary_color"),
        avatar_url=branding.get("avatar_url"),
        font_family=branding.get("font_family", "Inter"),
        lead_config=bot.lead_capture_config,
        hosted_page=hosted_page if hosted_page.get("enabled") else None,
        auth_required=False,
    )


@router.post("/chat/{workspace_slug}/{bot_slug}")
async def chat_by_slug(
    workspace_slug: str,
    bot_slug: str,
    request: ChatRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> ChatResponse:
    """
    Chat endpoint via slugs (for hosted page).

    WHY: Allow chatting via friendly slug URL with guaranteed uniqueness
    HOW: Look up workspace by slug, then chatbot by slug within workspace

    URL format: /chat/{workspace_slug}/{bot_slug}
    Example: /chat/acme-corp/support-bot

    Same as /bots/{bot_id}/chat but uses slugs instead of UUID.

    For private bots:
    - Requires API key in Authorization header: "Bearer sk_live_..."
    - Returns 401 if no valid API key provided
    """
    from app.models.chatbot import Chatbot, ChatbotStatus
    from app.models.workspace import Workspace
    from app.models.api_key import APIKey

    # Find workspace by slug
    workspace = db.query(Workspace).filter(
        Workspace.slug == workspace_slug
    ).first()

    if not workspace:
        raise HTTPException(404, "Workspace not found")

    # Find chatbot by slug within the workspace
    bot = db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace.id,
        Chatbot.slug == bot_slug,
        Chatbot.status == ChatbotStatus.ACTIVE
    ).first()

    if not bot:
        raise HTTPException(404, "Chatbot not found")

    # For private bots, require valid API key
    if not bot.is_public:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "API key required for private chatbots")

        api_key = authorization.replace("Bearer ", "")
        key_hash = APIKey.hash_key(api_key)

        # Validate API key belongs to this chatbot
        api_key_obj = db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.entity_id == bot.id,
            APIKey.is_active == True
        ).first()

        if not api_key_obj:
            raise HTTPException(401, "Invalid API key")

        if not api_key_obj.is_valid:
            if api_key_obj.is_expired:
                raise HTTPException(401, "API key expired")
            if api_key_obj.is_revoked:
                raise HTTPException(401, "API key revoked")
            raise HTTPException(401, "API key inactive")

        # Record usage
        api_key_obj.record_usage()
        db.commit()

    # Generate session ID if not provided
    session_id = request.session_id or f"hosted_{uuid4().hex[:16]}"

    # Build channel context
    channel_context = {
        "platform": "hosted_page",
        "metadata": request.metadata or {}
    }

    # Process message
    try:
        from app.services.chatbot_service import chatbot_service

        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=request.message,
            session_id=session_id,
            channel_context=channel_context,
            collected_variables=request.variables,
            platform="hosted_page"  # Session isolation: hosted page vs widget
        )

    except Exception as e:
        error_str = str(e).lower()
        if "rate limit" in error_str or "429" in error_str or "quota" in error_str:
            raise HTTPException(429, f"Rate limit exceeded: {str(e)[:200]}")
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")

    return ChatResponse(
        response=response["response"],
        sources=response.get("sources"),
        session_id=response["session_id"],
        message_id=response["message_id"]
    )


@router.post("/chat/{workspace_slug}/{bot_slug}/events")
async def track_hosted_page_event(
    workspace_slug: str,
    bot_slug: str,
    request: EventTrackingRequest,
    db: Session = Depends(get_db)
):
    """
    Track analytics events for hosted page.

    WHY: Collect usage analytics for hosted page visits
    HOW: Look up workspace and chatbot by slugs, store event

    URL format: /chat/{workspace_slug}/{bot_slug}/events
    Example: /chat/acme-corp/support-bot/events
    """
    from app.models.chatbot import Chatbot, ChatbotStatus
    from app.models.workspace import Workspace

    # Find workspace by slug
    workspace = db.query(Workspace).filter(
        Workspace.slug == workspace_slug
    ).first()

    if not workspace:
        raise HTTPException(404, "Workspace not found")

    # Find chatbot by slug within the workspace
    bot = db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace.id,
        Chatbot.slug == bot_slug,
        Chatbot.status == ChatbotStatus.ACTIVE
    ).first()

    if not bot:
        raise HTTPException(404, "Chatbot not found")

    # Store event
    from app.services.chatbot_analytics_service import chatbot_analytics_service

    try:
        await chatbot_analytics_service.store_widget_event(
            db=db,
            bot_id=bot.id,
            workspace_id=bot.workspace_id,
            event_type=request.event_type,
            event_data=request.event_data,
            session_id=request.session_id,
            client_timestamp=request.timestamp,
            bot_type="chatbot"
        )
    except Exception as e:
        print(f"Failed to store hosted page event: {e}")

    return {"status": "ok", "event_type": request.event_type}


class HostedLeadCaptureRequest(BaseModel):
    """Lead capture request for hosted page."""

    session_id: str
    email: Optional[str] = None  # Made optional to match widget schema and support skip
    name: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: Optional[dict] = None
    consent_given: bool = False
    # Browser metadata (auto-captured by frontend)
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    language: Optional[str] = None


@router.post("/chat/{workspace_slug}/{bot_slug}/leads")
async def capture_lead_hosted_page(
    workspace_slug: str,
    bot_slug: str,
    lead_request: HostedLeadCaptureRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Capture lead from hosted chat page.

    WHY: Lead capture for public bots on hosted page (no API key required)
    HOW: Look up workspace and chatbot by slugs, create lead with geolocation

    URL format: /chat/{workspace_slug}/{bot_slug}/leads
    Example: /chat/acme-corp/support-bot/leads
    """
    from app.models.chatbot import Chatbot, ChatbotStatus
    from app.models.workspace import Workspace
    from app.services.lead_capture_service import lead_capture_service
    from app.services.chatbot_analytics_service import chatbot_analytics_service

    # Find workspace by slug
    workspace = db.query(Workspace).filter(
        Workspace.slug == workspace_slug
    ).first()

    if not workspace:
        raise HTTPException(404, "Workspace not found")

    # Find chatbot by slug within the workspace
    bot = db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace.id,
        Chatbot.slug == bot_slug,
        Chatbot.status == ChatbotStatus.ACTIVE
    ).first()

    if not bot:
        raise HTTPException(404, "Chatbot not found")

    # Only allow for public bots (private bots require API key flow)
    if not bot.is_public:
        raise HTTPException(401, "Lead capture requires API key for private bots")

    # Check if lead capture is enabled
    lead_config = bot.lead_capture_config or {}
    if not lead_config.get("enabled", False):
        raise HTTPException(400, "Lead capture is not enabled for this chatbot")

    # Validate required fields based on config
    fields_config = lead_config.get("fields", {})
    missing_fields = []

    # Check standard fields
    if fields_config.get("email") == "required" and not lead_request.email:
        missing_fields.append("email")
    if fields_config.get("name") == "required" and not lead_request.name:
        missing_fields.append("name")
    if fields_config.get("phone") == "required" and not lead_request.phone:
        missing_fields.append("phone")

    # Check custom fields
    custom_fields_config = lead_config.get("custom_fields", [])
    request_custom_fields = lead_request.custom_fields or {}
    for cf in custom_fields_config:
        if cf.get("required") and not request_custom_fields.get(cf.get("name")):
            missing_fields.append(cf.get("label", cf.get("name")))

    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing_fields)}"
        )

    # Check consent if required
    privacy_config = lead_config.get("privacy", {})
    if privacy_config.get("require_consent", False) and not lead_request.consent_given:
        raise HTTPException(
            status_code=400,
            detail="Consent is required before submitting your information"
        )

    # Get client IP from headers (handles proxies)
    client_ip = http_request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip:
        client_ip = http_request.client.host if http_request.client else None

    # Capture lead with geolocation
    lead = await lead_capture_service.capture_from_widget(
        db=db,
        workspace_id=workspace.id,
        bot_id=bot.id,
        bot_type="chatbot",
        session_id=lead_request.session_id,
        email=lead_request.email,
        name=lead_request.name,
        phone=lead_request.phone,
        custom_fields=lead_request.custom_fields,
        ip_address=client_ip,
        user_agent=lead_request.user_agent,
        referrer=lead_request.referrer,
        language=lead_request.language,
        consent_given=lead_request.consent_given
    )

    # Track lead captured event
    try:
        await chatbot_analytics_service.store_widget_event(
            db=db,
            bot_id=bot.id,
            workspace_id=workspace.id,
            event_type="lead_collected",
            session_id=lead_request.session_id,
            event_data={
                "fields_collected": [
                    k for k, v in {
                        "email": lead_request.email,
                        "name": lead_request.name,
                        "phone": lead_request.phone
                    }.items() if v
                ],
                "consent_given": lead_request.consent_given
            },
            bot_type="chatbot"
        )
    except Exception as e:
        print(f"Failed to track lead capture event: {e}")

    return {"lead_id": str(lead.id), "status": "captured"}


async def _get_public_bot(
    db: Session,
    bot_id: UUID
) -> Tuple[str, Any, UUID]:
    """
    Get a public bot without API key validation.

    WHY: Public bots should be accessible without authentication
    HOW: Check is_public flag and return bot if public

    RETURNS:
        (bot_type, bot, workspace_id) or raises HTTPException
    """
    from app.models.chatbot import Chatbot

    # Try to get chatbot
    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if bot:
        if not bot.is_public:
            raise HTTPException(401, "API key required for private bots")
        if not bot.is_active:
            raise HTTPException(400, "Chatbot is not active")
        return "chatbot", bot, bot.workspace_id

    # Chatflow support - would check chatflows table here
    # For now, return 404 if not found as chatbot
    raise HTTPException(404, "Bot not found")


async def _validate_api_key_and_get_bot(
    db: Session,
    bot_id: UUID,
    api_key: str
) -> Tuple[str, Any, UUID]:
    """
    Validate API key and return bot.

    WHY: Security - ensure valid API key
    HOW: Hash incoming key and compare with stored hash

    RETURNS:
        (bot_type, bot, workspace_id)
    """

    from app.models.api_key import APIKey
    from app.models.chatbot import Chatbot

    # Hash the incoming API key
    key_hash = APIKey.hash_key(api_key)

    # Look up by hash
    api_key_obj = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
        APIKey.entity_id == bot_id,
        APIKey.is_active == True
    ).first()

    if not api_key_obj:
        raise HTTPException(401, "Invalid API key")

    # Check if key is valid (not expired, not revoked)
    if not api_key_obj.is_valid:
        if api_key_obj.is_expired:
            raise HTTPException(401, "API key expired")
        if api_key_obj.is_revoked:
            raise HTTPException(401, "API key revoked")
        raise HTTPException(401, "API key inactive")

    # Record usage
    api_key_obj.record_usage()
    db.commit()

    # Get bot
    if api_key_obj.entity_type == "chatbot":
        bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
        if not bot:
            raise HTTPException(404, "Chatbot not found")
        if not bot.is_active:
            raise HTTPException(400, "Chatbot is not active")
        return "chatbot", bot, bot.workspace_id

    else:  # chatflow
        # Chatflow support coming soon
        raise HTTPException(501, "Chatflow support not yet implemented")
