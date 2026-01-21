"""add_discord_guild_deployments

Revision ID: d4c8f5a12b3e
Revises: c88464ddecb0
Create Date: 2026-01-20 10:00:00.000000

Discord Shared Bot Architecture:
- Creates discord_guild_deployments table
- Maps Discord guilds to chatbots
- Enables ONE bot token to serve ALL customers
- Guild ID routing determines which chatbot handles each message
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4c8f5a12b3e'
down_revision: Union[str, Sequence[str], None] = 'c88464ddecb0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create discord_guild_deployments table."""
    op.create_table(
        'discord_guild_deployments',
        # Identity
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),

        # Tenant isolation
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),

        # Discord identifiers
        sa.Column('guild_id', sa.String(100), nullable=False, unique=True),
        sa.Column('guild_name', sa.String(200), nullable=True),
        sa.Column('guild_icon', sa.String(500), nullable=True),

        # Target chatbot
        sa.Column('chatbot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chatbots.id', ondelete='CASCADE'), nullable=False),

        # Channel restrictions
        sa.Column('allowed_channel_ids', postgresql.JSONB, nullable=False, server_default='[]'),

        # Status
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),

        # Audit trail
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
        sa.Column('deployed_at', sa.DateTime, nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),

        # Metadata (Note: 'metadata' is reserved by SQLAlchemy)
        sa.Column('guild_metadata', postgresql.JSONB, nullable=False, server_default='{}'),
    )

    # Create indexes
    op.create_index('ix_discord_guild_deployments_workspace_id', 'discord_guild_deployments', ['workspace_id'])
    op.create_index('ix_discord_guild_deployments_guild_id', 'discord_guild_deployments', ['guild_id'])
    op.create_index('ix_discord_guild_deployments_chatbot_id', 'discord_guild_deployments', ['chatbot_id'])
    op.create_index('ix_discord_guild_workspace_chatbot', 'discord_guild_deployments', ['workspace_id', 'chatbot_id'])
    op.create_index('ix_discord_guild_active', 'discord_guild_deployments', ['guild_id', 'is_active'])


def downgrade() -> None:
    """Drop discord_guild_deployments table."""
    # Drop indexes
    op.drop_index('ix_discord_guild_active', table_name='discord_guild_deployments')
    op.drop_index('ix_discord_guild_workspace_chatbot', table_name='discord_guild_deployments')
    op.drop_index('ix_discord_guild_deployments_chatbot_id', table_name='discord_guild_deployments')
    op.drop_index('ix_discord_guild_deployments_guild_id', table_name='discord_guild_deployments')
    op.drop_index('ix_discord_guild_deployments_workspace_id', table_name='discord_guild_deployments')

    # Drop table
    op.drop_table('discord_guild_deployments')
