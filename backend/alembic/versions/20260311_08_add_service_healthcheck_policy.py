"""add service healthcheck policy

Revision ID: 20260311_08
Revises: 20260311_07
Create Date: 2026-03-11 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260311_08'
down_revision = '20260311_07'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('services', schema=None) as batch_op:
        batch_op.add_column(sa.Column('healthcheck_enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')))
        batch_op.add_column(sa.Column('healthcheck_path', sa.String(length=255), nullable=False, server_default='/'))
        batch_op.add_column(sa.Column('healthcheck_timeout_ms', sa.Integer(), nullable=False, server_default='3000'))
        batch_op.add_column(sa.Column('healthcheck_expected_statuses', sa.JSON(), nullable=False, server_default=sa.text("'[]'")))


def downgrade():
    with op.batch_alter_table('services', schema=None) as batch_op:
        batch_op.drop_column('healthcheck_expected_statuses')
        batch_op.drop_column('healthcheck_timeout_ms')
        batch_op.drop_column('healthcheck_path')
        batch_op.drop_column('healthcheck_enabled')
