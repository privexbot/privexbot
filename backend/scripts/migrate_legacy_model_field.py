#!/usr/bin/env python3
"""
Rewrite stored chatbot / chatflow model ids that no Secret AI worker serves.

WHY:
- Secret AI's workers migrated to a vLLM/OpenAI backend, and the on-chain
  contract's model names went stale. A stored model id is only usable if a
  worker actually serves it right now (probed via each worker's
  `GET /v1/models` — see `app.core.secret_ai_models.discover_served_chat_models`).
- Any chatbot or chatflow LLM node carrying a model id that is NOT currently
  served (the old `"secret-ai-v1"` placeholder, or a since-removed id like
  `deepseek-r1:70b`) needs to be rewritten to a served model so:
    * analytics/logs show the real model that will run, and
    * the edit-page `<ModelSelector>` preselects a valid value.
  The runtime provider already coerces un-migrated rows at request time; this
  script makes the stored data match reality.

HOW:
- Build the live registry of served chat models; `target` = first `gpt-oss*`
  else first served; `served` = the full set of served ids. Abort if NOTHING
  is served (full outage) — don't guess.
- `chatbots`: for every row whose `ai_config->>'model'` is a non-empty string
  NOT in `served` (and not already `target`), rewrite `ai_config.model` to
  `target` via `jsonb_set`. The chatbot schema has separate JSONB columns
  (ai_config, kb_config, ...) — no aggregated `config` column.
- `chatflows`: walk each `config["nodes"]` array; for any node whose
  `data.config.model` is a non-empty string NOT in `served`, rewrite to
  `target`. Reassign the whole `config` dict (JSONB is not `MutableDict` here
  per backend/CLAUDE.md — in-place mutation does NOT persist).
- **Empty/unset models are left alone** — `model == ""` / missing means "use
  the default"; rewriting it would force a selection the user never made.
- Chatflow Redis drafts (24h TTL) are NOT touched — they re-save on next edit.

This script is:
- Idempotent: once every stored id is served, re-running reports 0/0.
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


def resolve_registry() -> dict:
    """Return the live `{served_model_id: worker_url}` registry.

    The on-chain contract (`Secret().get_models()`) is stale — its names no
    longer match what the vLLM/OpenAI workers serve. The authoritative source
    is each worker's `GET /v1/models`, probed by `discover_served_chat_models`.

    Aborts if NOTHING is served (full outage) — we will not rewrite stored ids
    to a model that no worker serves.
    """
    try:
        from secret_ai_sdk.secret import Secret
        from app.core.secret_ai_models import discover_served_chat_models
    except ImportError as exc:
        print(f"❌ Import failed: {exc}")
        print("   Cannot resolve served models without the SDK. Aborting.")
        sys.exit(2)

    try:
        secret = Secret()
        registry = discover_served_chat_models(secret)
    except Exception as exc:
        print(f"❌ Worker discovery failed: {exc}")
        print("   Aborting — we will not guess.")
        sys.exit(3)

    if not registry:
        print("❌ No Secret AI worker is serving a chat model right now.")
        print("   Aborting — nothing to migrate to.")
        sys.exit(4)

    print(f"→ Discovered {len(registry)} served chat model(s):")
    for m, url in registry.items():
        print(f"  ✓ {m} @ {url}")
    return registry


def pick_target(registry: dict) -> str:
    """Prefer a `gpt-oss*` model, else the first served chat model."""
    for m in registry:
        if m.lower().startswith("gpt-oss"):
            return m
    return next(iter(registry))


def migrate_chatbots(db, target: str, served: set, dry_run: bool) -> int:
    """Rewrite chatbots whose stored ai_config.model is a non-empty id that no
    worker serves → `target`.

    The `chatbots` table has SEPARATE JSONB columns (`ai_config`, `kb_config`,
    ...) per models/chatbot.py — there is no aggregated `config` column.

    Select candidates (model set + non-empty) and filter the served check in
    Python rather than binding a NOT-IN array in SQL — mirrors the chatflow
    select→filter→update pattern below and sidesteps array-binding quirks.
    """
    select_sql = text(
        """
        SELECT id, ai_config->>'model' AS model
        FROM chatbots
        WHERE ai_config->>'model' IS NOT NULL
          AND ai_config->>'model' <> ''
        """
    )
    rows = db.execute(select_sql).fetchall()
    stale_ids = [r.id for r in rows if r.model not in served and r.model != target]

    if dry_run or not stale_ids:
        return len(stale_ids)

    # `CAST(:target AS text)` not `:target::text`: SQLAlchemy's `text()` parser
    # reads `::` as a malformed bind-param. Standard `CAST(... AS text)` is safe.
    update_sql = text(
        """
        UPDATE chatbots
        SET ai_config = jsonb_set(ai_config, '{model}', to_jsonb(CAST(:target AS text)), false)
        WHERE id = :cb_id
        """
    )
    for cb_id in stale_ids:
        db.execute(update_sql, {"target": target, "cb_id": cb_id})
    return len(stale_ids)


def migrate_chatflows(db, target: str, served: set, dry_run: bool) -> int:
    """Walk each chatflow's nodes JSONB; rewrite any node whose
    `data.config.model` is a non-empty id that no worker serves → `target`.

    Returns the number of chatflow ROWS updated (not nodes). One chatflow can
    have multiple LLM nodes; if any are touched, the row is rewritten.

    Schema note (models/chatflow.py:56, 87-96): `chatflow.config` is the single
    JSONB column and `nodes` lives inside it as `config["nodes"]`.

    Implementation note: uses raw `text()` SQL (no ORM) — importing the
    `Chatflow` model would trigger global mapper configuration that fails to
    resolve string-referenced relationships in this lightweight script context.
    """
    # Candidate rows: any chatflow with at least one node carrying a model
    # field. The served check happens in Python (jsonpath NOT-IN is awkward).
    # `jsonb_path_exists` is PostgreSQL 12+ (we run pgvector on PG 16).
    select_sql = text(
        """
        SELECT id, config
        FROM chatflows
        WHERE jsonb_path_exists(
            config,
            CAST('$.nodes[*].data.config.model' AS jsonpath)
        )
        """
    )
    rows = db.execute(select_sql).fetchall()

    update_sql = text(
        """
        UPDATE chatflows
        SET config = CAST(:new_config AS jsonb)
        WHERE id = :cf_id
        """
    )

    updated = 0
    for row in rows:
        # JSONB from raw text() can come back as `dict` (psycopg2 default) or
        # `str` (custom adapter). Handle both.
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
            model = cfg.get("model") if isinstance(cfg, dict) else None
            # Rewrite only non-empty stored ids that no worker serves. Leave
            # empty/unset ("use default") and already-served ids untouched.
            if isinstance(model, str) and model and model not in served and model != target:
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
                new_config = dict(config)
                new_config["nodes"] = new_nodes
                db.execute(
                    update_sql,
                    {"new_config": json.dumps(new_config), "cf_id": row.id},
                )

    return updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count rows that would be updated; do not write.",
    )
    args = parser.parse_args()

    print(f"→ Discovering served Secret AI chat models...")
    registry = resolve_registry()
    served = set(registry.keys())
    target = pick_target(registry)
    print(f"  target = {target!r}  (served: {sorted(served)})")

    print(f"→ Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        chatbots_updated = migrate_chatbots(db, target, served, args.dry_run)
        chatflows_updated = migrate_chatflows(db, target, served, args.dry_run)

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
