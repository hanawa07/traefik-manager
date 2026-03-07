import logging
import os
import sqlite3
import subprocess
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.engine import make_url

DEFAULT_DATABASE_URL = "sqlite+aiosqlite:///./data/traefik_manager.db"
LEGACY_TABLES = {"services", "redirect_hosts", "middleware_templates", "users"}
logger = logging.getLogger(__name__)


def get_backend_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_database_url(database_url: str | None = None) -> str:
    return database_url or os.getenv("DATABASE_URL") or DEFAULT_DATABASE_URL


def resolve_sqlite_database_path(
    database_url: str,
    project_root: Path | None = None,
) -> Path | None:
    url = make_url(database_url)
    if url.get_backend_name() != "sqlite":
        return None

    database = url.database
    if not database or database == ":memory:":
        return None

    project_root = project_root or get_backend_root()
    database_path = Path(database)
    if database_path.is_absolute():
        return database_path
    return (project_root / database_path).resolve()


def detect_sqlite_schema_state(
    database_url: str,
    project_root: Path | None = None,
) -> str:
    database_path = resolve_sqlite_database_path(database_url, project_root=project_root)
    if database_path is None or not database_path.exists():
        return "fresh"

    connection = sqlite3.connect(database_path)
    try:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
    finally:
        connection.close()

    if "alembic_version" in tables:
        return "managed"
    if tables & LEGACY_TABLES:
        return "legacy_unstamped"
    return "fresh"


def resolve_target_revision(project_root: Path | None = None) -> str:
    project_root = project_root or get_backend_root()
    config = Config(str(project_root / "alembic.ini"))
    return ScriptDirectory.from_config(config).get_current_head() or "head"


def ensure_database_schema(database_url: str | None = None) -> None:
    resolved_database_url = resolve_database_url(database_url)
    schema_state = detect_sqlite_schema_state(resolved_database_url)
    if schema_state == "legacy_unstamped":
        logger.info("기존 DB에 Alembic 버전 정보 없음 → stamp head 자동 실행: database_url=%s", resolved_database_url)
        project_root_stamp = get_backend_root()
        environment_stamp = os.environ.copy()
        environment_stamp["DATABASE_URL"] = resolved_database_url
        subprocess.run(
            ["alembic", "-c", "alembic.ini", "stamp", "head"],
            cwd=project_root_stamp,
            env=environment_stamp,
            check=True,
        )
        logger.info("Alembic stamp head 완료")

    project_root = get_backend_root()
    target_revision = resolve_target_revision(project_root)
    environment = os.environ.copy()
    environment["DATABASE_URL"] = resolved_database_url
    subprocess.run(
        ["alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=project_root,
        env=environment,
        check=True,
    )
    logger.info("Alembic 마이그레이션 완료: revision=%s", target_revision)
