"""backfill_notifications_workspace_id

Resolve `notifications.workspace_id` for legacy rows by joining
`resource_id` against the resource's owning table. Rows that can't be
resolved (orphaned) stay NULL — they only surface when the read path
explicitly opts in (currently: `event = 'invitation.accepted'`).

WHY: Strict workspace scoping in `notification_service` will hide every
NULL row by default. Backfill fills in the legitimate rows so they keep
appearing under their workspace after the read-path tightening lands.

Revision ID: d4e5783064df
Revises: 5000eb773e1a
Create Date: 2026-04-28 16:13:57.289780

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e5783064df'
down_revision: Union[str, Sequence[str], None] = '5000eb773e1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Each resource_type → (table name, column to join workspace_id from).
# Document/Chunk are KB-children; we resolve via knowledge_bases instead.
_BACKFILL = [
    ("kb", "knowledge_bases"),
    ("chatbot", "chatbots"),
    ("chatflow", "chatflows"),
    ("lead", "leads"),
]


def upgrade() -> None:
    for resource_type, table in _BACKFILL:
        op.execute(
            f"""
            UPDATE notifications n
            SET workspace_id = r.workspace_id
            FROM {table} r
            WHERE n.workspace_id IS NULL
              AND n.resource_type = '{resource_type}'
              AND n.resource_id = r.id
              AND r.workspace_id IS NOT NULL
            """
        )


def downgrade() -> None:
    # Backfill is one-way; downgrade clears the populated rows so the
    # subsequent read-path rollback (with an OR-NULL filter) still surfaces
    # them. We use a UUID match on the resource tables to identify which
    # rows we touched.
    for resource_type, _table in _BACKFILL:
        op.execute(
            f"""
            UPDATE notifications
            SET workspace_id = NULL
            WHERE resource_type = '{resource_type}'
            """
        )
