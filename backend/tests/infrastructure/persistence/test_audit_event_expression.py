from sqlalchemy import select
from sqlalchemy.dialects import sqlite

from app.infrastructure.persistence.models import AUDIT_EVENT_EXPRESSION, AuditLogModel


def test_audit_event_expression_keeps_indexed_json_path_literal():
    query = select(AuditLogModel.id).where(
        AUDIT_EVENT_EXPRESSION == "settings_test_cloudflare"
    )

    compiled = str(query.compile(dialect=sqlite.dialect())).lower()

    assert "json_extract(audit_logs.detail, '$.\"event\"')" in compiled
    assert "json_extract(audit_logs.detail, ?)" not in compiled
