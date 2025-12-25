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

PSEUDOCODE follows the existing codebase patterns.
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
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: Optional[dict] = None
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

    # Extract API key
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "API key required")

    api_key = authorization.replace("Bearer ", "")

    # Validate API key and get bot
    bot_type, bot, workspace_id = await _validate_api_key_and_get_bot(
        db,
        bot_id,
        api_key
    )

    # Generate session ID if not provided
    session_id = request.session_id or f"web_{uuid4().hex[:16]}"

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
                collected_variables=request.variables
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
    """

    # Validate API key
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "API key required")

    api_key = authorization.replace("Bearer ", "")
    await _validate_api_key_and_get_bot(db, bot_id, api_key)

    # Update message
    from app.models.chat_message import ChatMessage

    message = db.query(ChatMessage).get(message_id)
    if not message:
        raise HTTPException(404, "Message not found")

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
        consent_given=True  # Widget form implies consent
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

    # Validate API key
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "API key required")

    api_key = authorization.replace("Bearer ", "")
    bot_type, bot, workspace_id = await _validate_api_key_and_get_bot(
        db,
        bot_id,
        api_key
    )

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
