"""
Slack Webhook Handler - Process incoming Slack events.

WHY:
- Receive messages from Slack via Events API
- Handle URL verification challenge
- Route to chatbot execution via slack_integration
- Handle OAuth callback for app installation

HOW:
- Verify HMAC-SHA256 signatures on all requests
- Respond 200 immediately (Slack retries after 3 seconds)
- Process events in FastAPI BackgroundTasks
- OAuth callback stores bot token and creates deployment record
"""

from fastapi import APIRouter, Request, BackgroundTasks, HTTPException, status, Depends, Query
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional
import json
import logging

from app.db.session import get_db, SessionLocal
from app.integrations.slack_integration import slack_integration
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/slack", tags=["webhooks"])


async def _process_slack_event(team_id: str, event: dict, bot_user_id: str = None):
    """
    Background task to process Slack event.

    WHY: Slack requires 200 response within 3 seconds
    HOW: Process event in background after responding 200
    """
    db = SessionLocal()
    try:
        await slack_integration.handle_event(
            db=db,
            team_id=team_id,
            event=event,
            bot_user_id=bot_user_id
        )
    except Exception as e:
        logger.error(f"Error processing Slack event: {e}", exc_info=True)
    finally:
        db.close()


@router.post("/events")
async def slack_events(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Slack Events API endpoint.

    Handles:
    1. url_verification challenge (Slack app setup)
    2. event_callback with message/app_mention events

    WHY: Single endpoint for all Slack events (Events API pattern)
    HOW: Verify signature, respond 200, process in background

    CRITICAL: Must respond 200 within 3 seconds or Slack will retry.
              All event processing happens in BackgroundTasks.
    """
    # Read raw body for signature verification
    body = await request.body()

    # Verify Slack signature
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    if not slack_integration.verify_signature(body, timestamp, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Slack signature"
        )

    # Parse payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )

    event_type = payload.get("type")

    # Handle URL verification challenge (Slack app setup)
    if event_type == "url_verification":
        challenge = payload.get("challenge", "")
        return JSONResponse(content={"challenge": challenge})

    # Handle event callbacks
    if event_type == "event_callback":
        team_id = payload.get("team_id", "")
        event = payload.get("event", {})

        # Get bot user ID from authorizations (to ignore self-messages)
        authorizations = payload.get("authorizations", [])
        bot_user_id = None
        for auth in authorizations:
            if auth.get("is_bot"):
                bot_user_id = auth.get("user_id")
                break

        # Process in background (respond 200 immediately)
        background_tasks.add_task(
            _process_slack_event,
            team_id=team_id,
            event=event,
            bot_user_id=bot_user_id
        )

        return JSONResponse(content={"ok": True})

    # Unknown event type - acknowledge anyway
    return JSONResponse(content={"ok": True})


@router.get("/install")
async def slack_install():
    """
    Redirect to Slack OAuth install URL.

    WHY: Convenience endpoint for starting the Slack app installation
    HOW: Generate install URL and redirect
    """
    if not settings.SLACK_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Slack integration not configured. Contact administrator."
        )

    from app.services.slack_workspace_service import slack_workspace_service
    install_url = slack_workspace_service.generate_install_url()
    return RedirectResponse(url=install_url)


@router.get("/oauth/callback")
async def slack_oauth_callback(
    code: str = Query(..., description="OAuth authorization code"),
    state: str = Query(None, description="Optional state parameter (workspace_id:chatbot_id)"),
    error: str = Query(None, description="Error code if authorization failed"),
    db: Session = Depends(get_db)
):
    """
    Handle Slack OAuth callback after app installation.

    WHY: Complete the OAuth flow and store bot token
    HOW: Exchange code for tokens, create/update deployment record

    FLOW:
    1. Exchange authorization code for bot token
    2. Get workspace info from Slack API
    3. Store bot token in SlackWorkspaceDeployment
    4. Redirect to frontend dashboard

    NOTE: The 'state' parameter can contain workspace_id:chatbot_id
          to auto-associate the installation with a chatbot.
    """
    if error:
        logger.error(f"Slack OAuth error: {error}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/credentials?error=slack_auth_failed&detail={error}"
        )

    # Exchange code for tokens
    oauth_response = await slack_integration.exchange_oauth_code(code)

    if not oauth_response.get("ok"):
        error_msg = oauth_response.get("error", "unknown_error")
        logger.error(f"Slack OAuth token exchange failed: {error_msg}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/credentials?error=slack_token_exchange&detail={error_msg}"
        )

    # Extract token and team info
    bot_token = oauth_response.get("access_token", "")
    team_info = oauth_response.get("team", {})
    team_id = team_info.get("id", "")
    team_name = team_info.get("name", "")
    bot_user_id = oauth_response.get("bot_user_id", "")
    app_id = oauth_response.get("app_id", "")

    # Get additional team info
    extra_info = await slack_integration.get_team_info(bot_token)
    team_domain = extra_info.get("team_domain", "") if extra_info else ""
    team_icon = extra_info.get("team_icon", "") if extra_info else ""

    # Check if deployment already exists for this team
    from app.models.slack_workspace_deployment import SlackWorkspaceDeployment

    existing = db.query(SlackWorkspaceDeployment).filter(
        SlackWorkspaceDeployment.team_id == team_id
    ).first()

    if existing:
        # Update existing deployment with new token
        existing.bot_token_encrypted = bot_token
        existing.bot_user_id = bot_user_id
        existing.team_name = team_name
        existing.team_domain = team_domain
        existing.team_icon = team_icon
        existing.is_active = True
        db.commit()

        logger.info(f"Updated Slack deployment for team {team_id} ({team_name})")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/chatbots?slack_connected=true&team={team_name}"
        )

    # Parse state for auto-association
    workspace_id = None
    chatbot_id = None
    if state:
        try:
            parts = state.split(":")
            if len(parts) >= 2:
                workspace_id = parts[0]
                chatbot_id = parts[1]
        except Exception:
            pass

    if workspace_id and chatbot_id:
        # Auto-create deployment
        from app.services.slack_workspace_service import slack_workspace_service
        try:
            from uuid import UUID as UUIDType
            slack_workspace_service.deploy_to_workspace(
                db=db,
                workspace_id=UUIDType(workspace_id),
                chatbot_id=UUIDType(chatbot_id),
                team_id=team_id,
                team_name=team_name,
                team_domain=team_domain,
                team_icon=team_icon,
                bot_token_encrypted=bot_token,
                bot_user_id=bot_user_id
            )
            logger.info(f"Auto-deployed Slack team {team_id} to chatbot {chatbot_id}")
        except ValueError as e:
            logger.warning(f"Auto-deploy failed: {e}")

    # Redirect to frontend with success
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/chatbots?slack_installed=true&team={team_name}&team_id={team_id}"
    )
