import sqlite3
import tempfile
import unittest
from pathlib import Path

from app.infrastructure.persistence.migration_runner import detect_sqlite_schema_state


class MigrationRunnerTest(unittest.TestCase):
    def test_detect_sqlite_schema_state_returns_fresh_for_missing_database(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            project_root = Path(temp_dir)
            database_url = "sqlite+aiosqlite:///./data/traefik_manager.db"

            state = detect_sqlite_schema_state(database_url, project_root=project_root)

            self.assertEqual(state, "fresh")

    def test_detect_sqlite_schema_state_returns_legacy_unstamped_for_existing_tables(self):
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

            self.assertEqual(state, "legacy_unstamped")

    def test_detect_sqlite_schema_state_returns_managed_when_alembic_version_exists(self):
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

            self.assertEqual(state, "managed")
