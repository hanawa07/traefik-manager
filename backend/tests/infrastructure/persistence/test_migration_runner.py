import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.infrastructure.persistence import migration_runner
from app.infrastructure.persistence.migration_runner import detect_sqlite_schema_state

def test_detect_sqlite_schema_state_returns_fresh_for_missing_database():
    with tempfile.TemporaryDirectory() as temp_dir:
        project_root = Path(temp_dir)
        database_url = "sqlite+aiosqlite:///./data/traefik_manager.db"

        state = detect_sqlite_schema_state(database_url, project_root=project_root)

        assert state == "fresh"

def test_detect_sqlite_schema_state_returns_legacy_unstamped_for_existing_tables():
    with tempfile.TemporaryDirectory() as temp_dir:
        project_root = Path(temp_dir)
        database_path = project_root / "data" / "traefik_manager.db"
        database_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(database_path)
        conn.execute("CREATE TABLE services (id TEXT PRIMARY KEY)")
        conn.commit()
        conn.close()

        state = detect_sqlite_schema_state(
            "sqlite+aiosqlite:///./data/traefik_manager.db",
            project_root=project_root,
        )

        assert state == "legacy_unstamped"

def test_detect_sqlite_schema_state_returns_managed_when_alembic_version_exists():
    with tempfile.TemporaryDirectory() as temp_dir:
        project_root = Path(temp_dir)
        database_path = project_root / "data" / "traefik_manager.db"
        database_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(database_path)
        conn.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        conn.commit()
        conn.close()

        state = detect_sqlite_schema_state(
            "sqlite+aiosqlite:///./data/traefik_manager.db",
            project_root=project_root,
        )

        assert state == "managed"

def test_ensure_database_schema_logs_error_before_legacy_unstamped_runtime_error():
    database_url = "sqlite+aiosqlite:///./data/traefik_manager.db"

    with patch.object(
        migration_runner,
        "resolve_database_url",
        return_value=database_url,
    ), patch.object(
        migration_runner,
        "detect_sqlite_schema_state",
        return_value="legacy_unstamped",
    ), patch.object(migration_runner, "logger") as logger_mock:
        with pytest.raises(RuntimeError):
            migration_runner.ensure_database_schema()

    logger_mock.error.assert_called_once()
    assert logger_mock.error.call_args.args[0] == "Alembic 스탬프 필요: database_url=%s"
    assert logger_mock.error.call_args.args[1] == database_url

def test_ensure_database_schema_logs_revision_after_upgrade():
    database_url = "sqlite+aiosqlite:///./data/traefik_manager.db"

    with patch.object(
        migration_runner,
        "resolve_database_url",
        return_value=database_url,
    ), patch.object(
        migration_runner,
        "detect_sqlite_schema_state",
        return_value="fresh",
    ), patch.object(migration_runner.subprocess, "run") as subprocess_run_mock, patch.object(
        migration_runner,
        "logger",
    ) as logger_mock:
        migration_runner.ensure_database_schema()

    subprocess_run_mock.assert_called_once()
    assert logger_mock.info.call_args.args[0] == "Alembic 마이그레이션 완료: revision=%s"
    assert logger_mock.info.call_args.args[1] is not None