"""add upstream scheme

Revision ID: 20260310_02
Revises: 20260310_01
Create Date: 2026-03-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260310_02'
down_revision = '20260310_01'
branch_labels = None
depends_on = None


def upgrade():
    # add columns to services table
    with op.batch_alter_table('services', schema=None) as batch_op:
        batch_op.add_column(sa.Column('upstream_scheme', sa.String(length=10), nullable=False, server_default='http'))
        batch_op.add_column(sa.Column('skip_tls_verify', sa.Boolean(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('services', schema=None) as batch_op:
        batch_op.drop_column('skip_tls_verify')
        batch_op.drop_column('upstream_scheme')
