"""add change alert source index

Revision ID: 20260722_02
Revises: 20260722_01
Create Date: 2026-07-22 22:30:00.000000

"""
from alembic import op


revision = "20260722_02"
down_revision = "20260722_01"
branch_labels = None
depends_on = None

BLUE_GREEN_COMPATIBLE = True


def upgrade():
    op.execute(
        "CREATE INDEX ix_audit_logs_change_alert_source_created_at "
        "ON audit_logs (JSON_EXTRACT(detail, '$.\"source_event\"'), created_at) "
        "WHERE JSON_EXTRACT(detail, '$.\"event\"') = 'change_alert_delivery_success'"
    )


def downgrade():
    op.drop_index(
        "ix_audit_logs_change_alert_source_created_at",
        table_name="audit_logs",
    )
