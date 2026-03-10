"""add service frame policy

Revision ID: 20260310_05
Revises: 20260310_04
Create Date: 2026-03-10 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260310_05'
down_revision = '20260310_04'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'services',
        sa.Column('frame_policy', sa.String(length=20), nullable=False, server_default='deny'),
    )


def downgrade():
    op.drop_column('services', 'frame_policy')
