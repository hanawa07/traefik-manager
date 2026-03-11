"""add login attempt tracking

Revision ID: 20260311_09
Revises: 20260311_08
Create Date: 2026-03-11 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260311_09'
down_revision = '20260311_08'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'failed_login_attempts',
                sa.Integer(),
                nullable=False,
                server_default='0',
            )
        )
        batch_op.add_column(sa.Column('last_failed_login_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('locked_until')
        batch_op.drop_column('last_failed_login_at')
        batch_op.drop_column('failed_login_attempts')
