"""
Calendly Webhook Handler - Receive Calendly booking events.

WHY:
- Capture leads when users book meetings via Calendly
- Trigger chatflow actions on booking/cancellation events

HOW:
- Receive invitee.created and invitee.canceled events
- Route to calendly_integration for processing
- Return 200 OK to acknowledge receipt
"""

from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse
from uuid import UUID
import json
import logging

from app.db.session import SessionLocal
from app.integrations.calendly_integration import calendly_integration

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/calendly", tags=["webhooks"])


@router.post("/{bot_id}")
async def calendly_webhook(
    bot_id: str,
    request: Request
):
    """
    Receive Calendly webhook events.

    Events:
    - invitee.created: Someone booked a meeting
    - invitee.canceled: Someone canceled a meeting

    ARGS:
        bot_id: The chatbot/chatflow ID associated with this webhook
    """
    try:
        body = await request.body()
        payload = json.loads(body)
    except (json.JSONDecodeError, Exception):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )

    event_type = payload.get("event")
    if event_type not in ("invitee.created", "invitee.canceled"):
        # Acknowledge unknown events without processing
        return JSONResponse(content={"ok": True, "event": event_type, "action": "ignored"})

    # Process the event
    db = SessionLocal()
    try:
        result = await calendly_integration.handle_webhook_event(
            db=db,
            bot_id=UUID(bot_id),
            event_payload=payload
        )

        return JSONResponse(content={
            "ok": True,
            "event": event_type,
            "lead_captured": result.get("lead_captured", False)
        })

    except ValueError as e:
        logger.warning(f"Calendly webhook error for bot {bot_id}: {e}")
        return JSONResponse(
            status_code=200,  # Still return 200 to prevent Calendly retries
            content={"ok": False, "error": str(e)}
        )
    except Exception as e:
        logger.error(f"Calendly webhook exception: {e}", exc_info=True)
        return JSONResponse(
            status_code=200,
            content={"ok": False, "error": "Internal processing error"}
        )
    finally:
        db.close()
