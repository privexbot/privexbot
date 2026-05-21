#!/usr/bin/env python3
"""
Migrate legacy "secret-ai-v1" model field to a live Secret AI model.

WHY:
- The frontend used to show a one-option dropdown with the placeholder
  string "secret-ai-v1" while the backend silently called whatever
  Secret AI's first model was. Going dynamic (Secret().get_models()) means
  the frontend now shows real model IDs (e.g. "DeepSeek-R1-Distill-Llama-70B").
  Any chatbot or chatflow LLM node still carrying `model = "secret-ai-v1"`
  in its config needs to be migrated to a real model id so the
  <ModelSelector> dropdown shows the correct preselected value.

HOW:
- Resolve `target = Secret().get_models()[0]` once at script start. Abort
  if the SDK can't reach Secret AI — don't guess.
- Update `chatbots.config -> ai_config -> model` via `jsonb_set` for every
  row where the current value is exactly "secret-ai-v1".
- Walk every chatflow's `nodes` JSONB array; for any LLM node where
  `data.config.model == "secret-ai-v1"`, rewrite to `target`. Reassign
  the `nodes` column on the SQLAlchemy instance (JSONB columns are not
  `MutableDict` here per backend/CLAUDE.md — in-place mutation does NOT
  persist).
- Chatflow Redis drafts (24h TTL) are NOT touched — they re-save with
  whatever value the UI picks on next edit.

This script is:
- Idempotent: re-running reports 0/0 once the migration has completed.
- Dry-runnable: pass `--dry-run` to count without writing.

Usage:
    docker exec privexbot-backend-dev python scripts/migrate_legacy_model_field.py [--dry-run]
"""

import argparse
import os
import sys

# Add src to path for imports (handles both local and Docker environments)
script_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(script_dir, '..', 'src')
if os.path.exists(src_path):
    sys.path.insert(0, src_path)
else:
    sys.path.insert(0, '/app/src')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

try:
    from app.core.config import settings
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure you're running in Docker or from backend/ with PYTHONPATH set.")
    sys.exit(1)


LEGACY_VALUE = "secret-ai-v1"


def resolve_target_model() -> str:
    """Call Secret().get_models() and return models[0]. Abort on failure."""
    try:
        from secret_ai_sdk.secret import Secret
    except ImportError as exc:
        print(f"❌ secret_ai_sdk import failed: {exc}")
        print("   Cannot resolve target model without the SDK. Aborting.")
        sys.exit(2)

    try:
        secret = Secret()
        models = secret.get_models()
    except Exception as exc:
        print(f"❌ Secret().get_models() failed: {exc}")
        print("   Aborting — we will not guess a target model.")
        sys.exit(3)

    if not models:
        print("❌ Secret().get_models() returned an empty list.")
        print("   Aborting — no models to migrate to.")
        sys.exit(4)

    return models[0]


def migrate_chatbots(db, target: str, dry_run: bool) -> int:
    """Update chatbots whose ai_config.model is exactly 'secret-ai-v1'."""
    select_sql = text(
        """
        SELECT COUNT(*)
        FROM chatbots
        WHERE config->'ai_config'->>'model' = :legacy
        """
    )
    count = db.execute(select_sql, {"legacy": LEGACY_VALUE}).scalar() or 0

    if dry_run or count == 0:
        return count

    update_sql = text(
        """
        UPDATE chatbots
        SET config = jsonb_set(config, '{ai_config,model}', to_jsonb(:target::text), false)
        WHERE config->'ai_config'->>'model' = :legacy
        """
    )
    db.execute(update_sql, {"target": target, "legacy": LEGACY_VALUE})
    return count


def migrate_chatflows(db, target: str, dry_run: bool) -> int:
    """Walk each chatflow's nodes JSONB; rewrite LLM node model strings.

    Returns the number of chatflow ROWS updated (not nodes). One chatflow
    can have multiple LLM nodes; if any are touched, the row is rewritten.
    """
    chatflows = db.query(Chatflow).filter(Chatflow.nodes.isnot(None)).all()
    updated = 0

    for cf in chatflows:
        if not cf.nodes:
            continue
        # Defensive copy so mutation is intentional.
        new_nodes = []
        cf_changed = False
        for node in cf.nodes:
            node_copy = dict(node) if isinstance(node, dict) else node
            data = node_copy.get("data") if isinstance(node_copy, dict) else None
            cfg = data.get("config") if isinstance(data, dict) else None
            if (
                isinstance(cfg, dict)
                and cfg.get("model") == LEGACY_VALUE
            ):
                # Mutate the nested dict copies — we reassign cf.nodes
                # below so SQLAlchemy detects the change.
                new_cfg = dict(cfg)
                new_cfg["model"] = target
                new_data = dict(data)
                new_data["config"] = new_cfg
                node_copy["data"] = new_data
                cf_changed = True
            new_nodes.append(node_copy)

        if cf_changed:
            updated += 1
            if not dry_run:
                # Reassign — JSONB columns aren't MutableDict in this codebase,
                # so in-place mutation would NOT persist. See backend/CLAUDE.md.
                cf.nodes = new_nodes

    return updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count rows that would be updated; do not write.",
    )
    args = parser.parse_args()

    print(f"→ Resolving target model from Secret AI SDK...")
    target = resolve_target_model()
    print(f"  target = {target!r}")

    print(f"→ Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        chatbots_updated = migrate_chatbots(db, target, args.dry_run)
        chatflows_updated = migrate_chatflows(db, target, args.dry_run)

        if args.dry_run:
            print(
                f"→ DRY RUN — would update {chatbots_updated} chatbots, "
                f"{chatflows_updated} chatflows."
            )
        else:
            db.commit()
            print(
                f"→ Updated {chatbots_updated} chatbots, "
                f"{chatflows_updated} chatflows. target_model={target!r}."
            )
    except Exception as exc:
        db.rollback()
        print(f"❌ Migration failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
