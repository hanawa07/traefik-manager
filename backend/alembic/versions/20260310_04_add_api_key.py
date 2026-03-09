"""add api key to services

Revision ID: 20260310_04
Revises: 20260310_03
Create Date: 2026-03-10 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260310_04'
down_revision = '20260310_03'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('services', sa.Column('api_key', sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column('services', 'api_key')
