"""add avatar_url to workspace and organization

Revision ID: 2388518a8727
Revises: a680b994bafd
Create Date: 2025-10-31 18:05:41.380229

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2388518a8727'
down_revision: Union[str, Sequence[str], None] = 'a680b994bafd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add avatar_url column to workspaces and organizations tables."""
    # Add avatar_url to workspaces
    op.add_column('workspaces', sa.Column('avatar_url', sa.String(length=512), nullable=True))

    # Add avatar_url to organizations
    op.add_column('organizations', sa.Column('avatar_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    """Remove avatar_url column from workspaces and organizations tables."""
    # Remove avatar_url from workspaces
    op.drop_column('workspaces', 'avatar_url')

    # Remove avatar_url from organizations
    op.drop_column('organizations', 'avatar_url')
