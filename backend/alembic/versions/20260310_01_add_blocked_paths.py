"""add blocked paths to services

Revision ID: 20260310_01
Revises: 20260309_01
Create Date: 2026-03-10 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260310_01"
down_revision: Union[str, None] = "20260309_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("blocked_paths", sa.JSON(), nullable=False, server_default='[]')
    )

def downgrade() -> None:
    op.drop_column("services", "blocked_paths")
