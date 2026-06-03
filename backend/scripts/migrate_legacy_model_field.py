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
- Update `chatbots.ai_config -> model` via `jsonb_set` for every row where
  the current value is exactly "secret-ai-v1". The chatbot schema has
  separate JSONB columns per concern (ai_config, kb_config, prompt_config,
  ...) — there is no aggregated `config` column.
- Walk every chatflow's `config["nodes"]` array (chatflow has a single
  `config` JSONB column, with `nodes` and `edges` as keys inside it).
  For any LLM node where `data.config.model == "secret-ai-v1"`, rewrite to
  `target`. Reassign the entire `config` dict on the SQLAlchemy instance
  (JSONB columns are not `MutableDict` here per backend/CLAUDE.md —
  in-place mutation does NOT persist).
- Chatflow Redis drafts (24h TTL) are NOT touched — they re-save with
  whatever value the UI picks on next edit.

This script is:
- Idempotent: re-running reports 0/0 once the migration has completed.
- Dry-runnable: pass `--dry-run` to count without writing.

Usage:
    docker exec privexbot-backend-dev python scripts/migrate_legacy_model_field.py [--dry-run]
"""

import argparse
import json
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
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure you're running in Docker or from backend/ with PYTHONPATH set.")
    sys.exit(1)

# Note: we deliberately do NOT import the SQLAlchemy ORM model classes here
# (`Chatbot`, `Chatflow`, etc). Importing any single model would trigger the
# global mapper registry, which walks every string-referenced relationship
# (e.g. `Workspace.slack_deployments` -> `'SlackWorkspaceDeployment'`) and
# fails to resolve in this lightweight script context. The migration uses
# raw SQL via `text()` for both tables — no ORM, no mapper init.


LEGACY_VALUE = "secret-ai-v1"


def resolve_working_chat_model() -> str:
    """Pick the first chat-base model whose worker is actually serving
    right now.

    `Secret().get_models()` returns the contract's enumeration in some
    order — not a health signal. Earlier behavior of writing `models[0]`
    bit us when the Secret Labs team migrated `deepseek-r1:70b` (which
    happens to be `models[0]`) off `secretai-rytn` while the contract
    still advertised that URL; the migration wrote a broken model to
    every chatbot.

    Probe each chat-base model's URLs with a minimal `/api/chat` POST
    (via `app.core.secret_ai_models.ping_chat_model`). Return the first
    that responds 200. Falls back to `models[0]` only if every probe
    fails — preserves prior behavior on a full Secret AI outage so the
    migration doesn't silently abort. The runtime path
    (`secret_ai_sdk_provider._iterate_candidates`) provides its own
    fallback regardless of what we write here.
    """
    try:
        from secret_ai_sdk.secret import Secret
        from app.core.secret_ai_models import is_chat_capable, ping_chat_model
    except ImportError as exc:
        print(f"❌ Import failed: {exc}")
        print("   Cannot resolve target model without the SDK. Aborting.")
        sys.exit(2)

    try:
        secret = Secret()
        all_models = secret.get_models() or []
    except Exception as exc:
        print(f"❌ Secret().get_models() failed: {exc}")
        print("   Aborting — we will not guess a target model.")
        sys.exit(3)

    if not all_models:
        print("❌ Secret().get_models() returned an empty list.")
        print("   Aborting — no models to migrate to.")
        sys.exit(4)

    candidates = [m for m in all_models if is_chat_capable(m)]
    print(f"→ Probing {len(candidates)} chat-base models for liveness "
          f"(2s timeout each)...")
    for m in candidates:
        try:
            urls = secret.get_urls(model=m) or []
        except Exception as exc:
            print(f"  ✗ {m}: get_urls failed ({type(exc).__name__}: {exc})")
            continue
        if not urls:
            print(f"  ✗ {m}: no URLs advertised")
            continue
        for u in urls:
            if ping_chat_model(u, m, timeout=2.0):
                print(f"  ✓ {m} @ {u}")
                return m
            print(f"  ✗ {m} @ {u}")

    # All probes failed — fall back to models[0] rather than abort. The
    # runtime SDK provider has its own per-request iteration that will
    # recover when (if) workers come back up.
    fallback = all_models[0]
    print(f"⚠ All probes failed; falling back to models[0]={fallback!r}.")
    print(f"   The runtime path will continue attempting other models on each request.")
    return fallback


def migrate_chatbots(db, target: str, dry_run: bool) -> int:
    """Update chatbots whose ai_config.model is exactly 'secret-ai-v1'.

    The `chatbots` table has SEPARATE JSONB columns (`ai_config`,
    `kb_config`, `prompt_config`, ...) per models/chatbot.py — there is
    no aggregated `config` column. The Python `chatbot.config` attribute
    is a SQLAlchemy property at models/chatbot.py:382 that merges the
    per-config columns at read time; it cannot be queried by SQL.
    """
    select_sql = text(
        """
        SELECT COUNT(*)
        FROM chatbots
        WHERE ai_config->>'model' = :legacy
        """
    )
    count = db.execute(select_sql, {"legacy": LEGACY_VALUE}).scalar() or 0

    if dry_run or count == 0:
        return count

    # `CAST(:target AS text)` rather than `:target::text`: SQLAlchemy's
    # `text()` parser interprets the colon as the start of a bind-param
    # name, so `:target::text` ends up being passed to PostgreSQL with
    # `:target` unbound — psycopg2 then errors with `syntax error at or
    # near ":"`. Standard-SQL `CAST(... AS text)` sidesteps the ambiguity.
    update_sql = text(
        """
        UPDATE chatbots
        SET ai_config = jsonb_set(ai_config, '{model}', to_jsonb(CAST(:target AS text)), false)
        WHERE ai_config->>'model' = :legacy
        """
    )
    db.execute(update_sql, {"target": target, "legacy": LEGACY_VALUE})
    return count


def migrate_chatflows(db, target: str, dry_run: bool) -> int:
    """Walk each chatflow's nodes JSONB; rewrite LLM node model strings.

    Returns the number of chatflow ROWS updated (not nodes). One chatflow
    can have multiple LLM nodes; if any are touched, the row is rewritten.

    Schema note (models/chatflow.py:56, 87-96): `chatflow.config` is the
    single JSONB column and `nodes` lives inside it as `config["nodes"]`.
    There is no `Chatflow.nodes` column attribute.

    Implementation note: uses raw `text()` SQL (no ORM) for the same
    reason `migrate_chatbots` does — importing the `Chatflow` SQLAlchemy
    model would trigger global mapper configuration, which fails to
    resolve string-referenced relationships from other models that
    aren't imported in this script's context.
    """
    # Find candidate rows: chatflows that contain at least one node whose
    # data.config.model equals the legacy value. `jsonb_path_exists` is
    # PostgreSQL 12+ (we run pgvector on PG 16, verified).
    select_sql = text(
        """
        SELECT id, config
        FROM chatflows
        WHERE jsonb_path_exists(
            config,
            CAST('$.nodes[*].data.config.model ? (@ == "secret-ai-v1")' AS jsonpath)
        )
        """
    )
    rows = db.execute(select_sql).fetchall()

    if dry_run or not rows:
        return len(rows)

    update_sql = text(
        """
        UPDATE chatflows
        SET config = CAST(:new_config AS jsonb)
        WHERE id = :cf_id
        """
    )

    updated = 0
    for row in rows:
        # JSONB columns from raw text() queries can come back as either
        # `dict` (psycopg2 auto-decodes by default) or `str` (if a custom
        # adapter is installed). Handle both so the script works
        # regardless of which adapter is registered.
        config = row.config
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except (TypeError, json.JSONDecodeError):
                continue
        if not isinstance(config, dict):
            continue
        nodes = config.get("nodes")
        if not isinstance(nodes, list) or not nodes:
            continue

        new_nodes = []
        cf_changed = False
        for node in nodes:
            node_copy = dict(node) if isinstance(node, dict) else node
            data = node_copy.get("data") if isinstance(node_copy, dict) else None
            cfg = data.get("config") if isinstance(data, dict) else None
            if (
                isinstance(cfg, dict)
                and cfg.get("model") == LEGACY_VALUE
            ):
                new_cfg = dict(cfg)
                new_cfg["model"] = target
                new_data = dict(data)
                new_data["config"] = new_cfg
                node_copy["data"] = new_data
                cf_changed = True
            new_nodes.append(node_copy)

        if cf_changed:
            new_config = dict(config)
            new_config["nodes"] = new_nodes
            db.execute(
                update_sql,
                {"new_config": json.dumps(new_config), "cf_id": row.id},
            )
            updated += 1

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
    target = resolve_working_chat_model()
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
