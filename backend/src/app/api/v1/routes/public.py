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

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, Any, Tuple

from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db


router = APIRouter(prefix="/v1/public", tags=["public"])


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
    if bot_type == "chatbot":
        from app.services.chatbot_service import chatbot_service

        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=request.message,
            session_id=session_id,
            channel_context=channel_context
        )

    else:  # chatflow
        # Placeholder - chatflow_service not yet implemented
        response = {
            "response": "Chatflow support coming soon",
            "session_id": session_id,
            "message_id": str(uuid4())
        }

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
    request: LeadCaptureRequest,
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

    # Get geolocation from IP (placeholder - requires geoip_service)
    geolocation = None
    if request.ip_address:
        # from app.services.geoip_service import geoip_service
        # geolocation = geoip_service.lookup(request.ip_address)
        pass

    # Create lead (placeholder - requires Lead model)
    # from app.models.lead import Lead
    #
    # lead = Lead(
    #     workspace_id=workspace_id,
    #     bot_type=bot_type,
    #     bot_id=bot_id,
    #     session_id=UUID(request.session_id),
    #     email=request.email,
    #     name=request.name,
    #     phone=request.phone,
    #     custom_fields=request.custom_fields or {},
    #     ip_address=request.ip_address,
    #     geolocation=geolocation,
    #     source="widget"
    # )
    #
    # db.add(lead)
    # db.commit()

    # Placeholder response
    lead_id = str(uuid4())

    return {"lead_id": lead_id}


async def _validate_api_key_and_get_bot(
    db: Session,
    bot_id: UUID,
    api_key: str
) -> Tuple[str, Any, UUID]:
    """
    Validate API key and return bot.

    WHY: Security - ensure valid API key
    HOW: Check API key matches bot

    RETURNS:
        (bot_type, bot, workspace_id)
    """

    from app.models.api_key import APIKey
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    # Validate API key
    api_key_obj = db.query(APIKey).filter(
        APIKey.key == api_key,
        APIKey.entity_id == bot_id,
        APIKey.is_active == True
    ).first()

    if not api_key_obj:
        raise HTTPException(401, "Invalid API key")

    # Get bot
    if api_key_obj.entity_type == "chatbot":
        bot = db.query(Chatbot).get(bot_id)
        if not bot:
            raise HTTPException(404, "Chatbot not found")
        return "chatbot", bot, bot.workspace_id

    else:  # chatflow
        bot = db.query(Chatflow).get(bot_id)
        if not bot:
            raise HTTPException(404, "Chatflow not found")
        return "chatflow", bot, bot.workspace_id
