import sqlite3
import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.script.revision import ResolutionError
from alembic.util.exc import CommandError

from app.infrastructure.persistence.migration_runner import (
    detect_sqlite_schema_state,
    get_backend_root,
    resolve_database_url,
    resolve_sqlite_database_path,
)


class BlueGreenMigrationError(RuntimeError):
    pass


def check_blue_green_migrations(
    database_url: str | None = None,
    project_root: Path | None = None,
) -> tuple[str | None, str, tuple[str, ...]]:
    root = project_root or get_backend_root()
    resolved_url = resolve_database_url(database_url)
    database_path = resolve_sqlite_database_path(resolved_url, project_root=root)
    if database_path is None:
        raise BlueGreenMigrationError("blue-green 사전 검사는 현재 SQLite DB만 지원합니다")

    script = ScriptDirectory.from_config(Config(str(root / "alembic.ini")))
    try:
        target_revision = script.get_current_head()
    except CommandError as exc:
        raise BlueGreenMigrationError("Alembic head가 하나가 아닙니다") from exc
    if target_revision is None:
        raise BlueGreenMigrationError("Alembic head를 찾지 못했습니다")

    schema_state = detect_sqlite_schema_state(resolved_url, project_root=root)
    if schema_state == "fresh":
        return None, target_revision, ()
    if schema_state != "managed":
        raise BlueGreenMigrationError("Alembic stamp가 없는 기존 DB는 blue-green 배포할 수 없습니다")

    current_revision = _read_current_revision(database_path)
    try:
        pending = tuple(reversed(tuple(script.iterate_revisions(target_revision, current_revision))))
    except (CommandError, ResolutionError) as exc:
        raise BlueGreenMigrationError(
            f"현재 DB revision을 Alembic 이력에서 찾지 못했습니다: {current_revision}"
        ) from exc

    incompatible = tuple(
        revision.revision
        for revision in pending
        if getattr(revision.module, "BLUE_GREEN_COMPATIBLE", False) is not True
    )
    if incompatible:
        joined = ", ".join(incompatible)
        raise BlueGreenMigrationError(
            "미적용 migration의 BLUE_GREEN_COMPATIBLE 확인이 필요합니다: " + joined
        )
    return current_revision, target_revision, tuple(revision.revision for revision in pending)


def _read_current_revision(database_path: Path) -> str:
    try:
        connection = sqlite3.connect(database_path)
        try:
            rows = connection.execute("SELECT version_num FROM alembic_version").fetchall()
        finally:
            connection.close()
    except sqlite3.Error as exc:
        raise BlueGreenMigrationError("DB의 Alembic revision을 읽지 못했습니다") from exc
    if len(rows) != 1 or not rows[0][0]:
        raise BlueGreenMigrationError("DB의 Alembic revision은 정확히 하나여야 합니다")
    return str(rows[0][0])


def main() -> int:
    try:
        current, target, pending = check_blue_green_migrations()
    except BlueGreenMigrationError as exc:
        print(f"blue-green migration 사전 검사 실패: {exc}", file=sys.stderr)
        return 1

    if current is None:
        print(f"blue-green migration 사전 검사 통과: 신규 DB, target={target}")
    else:
        revisions = ",".join(pending) if pending else "없음"
        print(
            "blue-green migration 사전 검사 통과: "
            f"current={current}, target={target}, pending={revisions}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
