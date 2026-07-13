"""add audit created at index

Revision ID: 20260713_01
Revises: 20260311_09
Create Date: 2026-07-13 23:55:00.000000

"""
from alembic import op


revision = "20260713_01"
down_revision = "20260311_09"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)


def downgrade():
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
