import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.infrastructure.persistence import blue_green_preflight
from app.infrastructure.persistence.blue_green_preflight import (
    BlueGreenMigrationError,
    check_blue_green_migrations,
)


BACKEND_ROOT = Path(__file__).resolve().parents[3]


def _managed_database(tmp_path: Path, revision: str) -> str:
    database_path = tmp_path / "traefik_manager.db"
    connection = sqlite3.connect(database_path)
    connection.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
    connection.execute("INSERT INTO alembic_version VALUES (?)", (revision,))
    connection.commit()
    connection.close()
    return f"sqlite+aiosqlite:///{database_path}"


def test_preflight_passes_when_database_is_already_at_head(tmp_path: Path):
    database_url = _managed_database(tmp_path, "20260722_02")

    current, target, pending = check_blue_green_migrations(
        database_url,
        project_root=BACKEND_ROOT,
    )

    assert current == target == "20260722_02"
    assert pending == ()


def test_preflight_allows_audit_index_migrations(tmp_path: Path):
    database_url = _managed_database(tmp_path, "20260719_02")

    current, target, pending = check_blue_green_migrations(
        database_url,
        project_root=BACKEND_ROOT,
    )

    assert (current, target, pending) == (
        "20260719_02",
        "20260722_02",
        ("20260722_01", "20260722_02"),
    )


def test_preflight_rejects_pending_migration_without_compatibility_marker(tmp_path: Path):
    database_url = _managed_database(tmp_path, "20260311_09")

    with pytest.raises(BlueGreenMigrationError, match="20260713_01"):
        check_blue_green_migrations(database_url, project_root=BACKEND_ROOT)


def test_preflight_allows_pending_migration_with_compatibility_marker(
    tmp_path: Path,
    monkeypatch,
):
    database_url = _managed_database(tmp_path, "old_revision")
    pending_revision = SimpleNamespace(
        revision="new_revision",
        module=SimpleNamespace(BLUE_GREEN_COMPATIBLE=True),
    )

    class FakeScript:
        @staticmethod
        def get_current_head():
            return "new_revision"

        @staticmethod
        def iterate_revisions(target: str, current: str):
            assert (target, current) == ("new_revision", "old_revision")
            return [pending_revision]

    monkeypatch.setattr(
        blue_green_preflight.ScriptDirectory,
        "from_config",
        lambda _config: FakeScript(),
    )

    current, target, pending = check_blue_green_migrations(
        database_url,
        project_root=BACKEND_ROOT,
    )

    assert (current, target, pending) == (
        "old_revision",
        "new_revision",
        ("new_revision",),
    )


def test_preflight_allows_fresh_database(tmp_path: Path):
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'missing.db'}"

    current, target, pending = check_blue_green_migrations(
        database_url,
        project_root=BACKEND_ROOT,
    )

    assert current is None
    assert target == "20260722_02"
    assert pending == ()
