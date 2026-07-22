"""add audit event created at index

Revision ID: 20260722_01
Revises: 20260719_02
Create Date: 2026-07-22 20:20:00.000000

"""
from alembic import op


revision = "20260722_01"
down_revision = "20260719_02"
branch_labels = None
depends_on = None

BLUE_GREEN_COMPATIBLE = True


def upgrade():
    op.execute(
        "CREATE INDEX ix_audit_logs_event_created_at "
        "ON audit_logs (JSON_EXTRACT(detail, '$.\"event\"'), created_at)"
    )


def downgrade():
    op.drop_index("ix_audit_logs_event_created_at", table_name="audit_logs")
