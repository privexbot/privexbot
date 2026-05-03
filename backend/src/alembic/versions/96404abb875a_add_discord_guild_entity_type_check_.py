"""add discord guild entity_type check constraint

Revision ID: 96404abb875a
Revises: d876f78053d0
Create Date: 2026-05-01 12:50:36.406447

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96404abb875a'
down_revision: Union[str, Sequence[str], None] = 'd876f78053d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # NOTE: This migration body was filled in by hand because Alembic
    # autogenerate does not detect CheckConstraints (documented limitation,
    # not a config issue). The constraint IS declared on the model in
    # `app/models/discord_guild_deployment.py::__table_args__`, which is the
    # source of truth — this op just propagates the constraint to existing
    # databases.
    op.create_check_constraint(
        "ck_discord_guild_deployments_entity_type",
        "discord_guild_deployments",
        "entity_type IN ('chatbot', 'chatflow')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "ck_discord_guild_deployments_entity_type",
        "discord_guild_deployments",
        type_="check",
    )
