"""add revoked tokens

Revision ID: 20260310_06
Revises: 20260310_05
Create Date: 2026-03-10 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260310_06'
down_revision = '20260310_05'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'revoked_tokens',
        sa.Column('jti', sa.String(length=36), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('jti'),
    )


def downgrade():
    op.drop_table('revoked_tokens')
