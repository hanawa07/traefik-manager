"""add service routing mode

Revision ID: 20260719_01
Revises: 20260713_01
Create Date: 2026-07-19 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260719_01"
down_revision = "20260713_01"
branch_labels = None
depends_on = None

BLUE_GREEN_COMPATIBLE = True


def upgrade():
    with op.batch_alter_table("services", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("routing_mode", sa.String(length=20), nullable=False, server_default="active")
        )


def downgrade():
    with op.batch_alter_table("services", schema=None) as batch_op:
        batch_op.drop_column("routing_mode")
