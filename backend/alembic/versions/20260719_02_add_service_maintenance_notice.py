"""add service maintenance notice

Revision ID: 20260719_02
Revises: 20260719_01
Create Date: 2026-07-19 19:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260719_02"
down_revision = "20260719_01"
branch_labels = None
depends_on = None

BLUE_GREEN_COMPATIBLE = True


def upgrade():
    with op.batch_alter_table("services", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("maintenance_message", sa.String(length=300), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column("maintenance_until", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade():
    with op.batch_alter_table("services", schema=None) as batch_op:
        batch_op.drop_column("maintenance_until")
        batch_op.drop_column("maintenance_message")
