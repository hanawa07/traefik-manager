from sqlalchemy import create_engine, desc, select
from sqlalchemy.dialects import sqlite

from app.infrastructure.persistence.models import (
    AUDIT_EVENT_EXPRESSION,
    AUDIT_SOURCE_EVENT_EXPRESSION,
    AuditLogModel,
)


def test_audit_event_expression_keeps_indexed_json_path_literal():
    query = select(AuditLogModel.id).where(
        AUDIT_EVENT_EXPRESSION == "settings_test_cloudflare"
    )

    compiled = str(query.compile(dialect=sqlite.dialect())).lower()

    assert "json_extract(audit_logs.detail, '$.\"event\"')" in compiled
    assert "json_extract(audit_logs.detail, ?)" not in compiled


def test_audit_source_event_expression_keeps_indexed_json_path_literal():
    query = select(AuditLogModel.id).where(
        AUDIT_SOURCE_EVENT_EXPRESSION == "github_api_primary_rate_limit"
    )

    compiled = str(query.compile(dialect=sqlite.dialect())).lower()

    assert "json_extract(audit_logs.detail, '$.\"source_event\"')" in compiled
    assert "json_extract(audit_logs.detail, ?)" not in compiled


def test_change_alert_source_query_uses_partial_index():
    engine = create_engine("sqlite://")
    AuditLogModel.__table__.create(engine)
    query = (
        select(AuditLogModel.id)
        .where(
            AUDIT_EVENT_EXPRESSION == "change_alert_delivery_success",
            AUDIT_SOURCE_EVENT_EXPRESSION == "github_api_primary_rate_limit",
        )
        .order_by(desc(AuditLogModel.created_at))
        .limit(1)
    )
    sql = str(
        query.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    with engine.connect() as connection:
        plan = connection.exec_driver_sql(f"EXPLAIN QUERY PLAN {sql}").all()

    assert any("ix_audit_logs_change_alert_source_created_at" in row[-1] for row in plan)
