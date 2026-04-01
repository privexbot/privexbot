"""
Integration Auto-Sync Tasks - Celery tasks for periodic content syncing.

WHY:
- Keep knowledge bases up-to-date with external sources automatically
- Re-sync Notion pages, Google Docs, etc. on a schedule

HOW:
- Self-rescheduling task pattern: task runs, syncs, then schedules itself again
- Respects frequency setting from credential auto_sync config
- Graceful error handling with automatic retry
"""

import logging
from celery import shared_task
from uuid import UUID

logger = logging.getLogger(__name__)

# Frequency to seconds mapping
FREQUENCY_SECONDS = {
    "hourly": 3600,
    "daily": 86400,
    "weekly": 604800,
}


@shared_task(bind=True, name="run_auto_sync", max_retries=2, default_retry_delay=300)
def run_auto_sync(self, credential_id: str):
    """
    Run auto-sync for a credential's linked knowledge base.

    Self-rescheduling: after syncing, queues itself again based on frequency.
    Stops if auto_sync is disabled or credential is deleted.
    """
    from app.db.session import SessionLocal
    from app.models.credential import Credential
    from app.services.credential_service import credential_service

    db = SessionLocal()
    try:
        credential = db.query(Credential).get(UUID(credential_id))
        if not credential or not credential.is_active:
            logger.info(f"Auto-sync skipped: credential {credential_id} not found or inactive")
            return {"status": "skipped", "reason": "credential_not_found"}

        # Decrypt to check config
        cred_data = credential_service.decrypt_credential_data(credential.encrypted_data)

        if not cred_data.get("auto_sync_enabled"):
            logger.info(f"Auto-sync disabled for credential {credential_id}")
            return {"status": "skipped", "reason": "auto_sync_disabled"}

        sync_config = cred_data.get("auto_sync", {})
        frequency = sync_config.get("frequency", "manual")

        if frequency == "manual":
            logger.info(f"Auto-sync frequency is 'manual' for credential {credential_id}, not rescheduling")
            return {"status": "skipped", "reason": "manual_frequency"}

        # Perform the sync
        provider = credential.provider
        logger.info(f"Running auto-sync for {provider} credential {credential_id}")

        try:
            if provider == "notion":
                _sync_notion(db, credential, cred_data, sync_config)
            elif provider in ("google", "google_drive"):
                _sync_google(db, credential, cred_data, sync_config)
            else:
                logger.warning(f"No sync handler for provider: {provider}")
        except Exception as e:
            logger.error(f"Auto-sync failed for {credential_id}: {e}")
            # Don't raise — still reschedule

        # Reschedule for next run
        countdown = FREQUENCY_SECONDS.get(frequency, 86400)
        run_auto_sync.apply_async(
            args=[credential_id],
            countdown=countdown
        )
        logger.info(f"Auto-sync rescheduled for credential {credential_id} in {countdown}s")

        return {"status": "completed", "next_run_in": countdown}

    except Exception as e:
        logger.error(f"Auto-sync task error for {credential_id}: {e}", exc_info=True)
        raise self.retry(exc=e)
    finally:
        db.close()


def _sync_notion(db, credential, cred_data, sync_config):
    """Sync Notion pages to linked knowledge bases."""
    logger.info(f"Notion sync for credential {credential.id} - placeholder for KB re-import")
    # Future: Look up KBs that use this Notion credential and re-import pages


def _sync_google(db, credential, cred_data, sync_config):
    """Sync Google Docs/Sheets to linked knowledge bases."""
    logger.info(f"Google sync for credential {credential.id} - placeholder for KB re-import")
    # Future: Look up KBs that use this Google credential and re-import docs
