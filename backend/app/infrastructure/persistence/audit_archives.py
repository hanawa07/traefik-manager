import asyncio
import gzip
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditLogModel

AUDIT_ARCHIVE_FILENAME_PATTERN = re.compile(
    r"^audit-\d{8}T\d{6}Z-[0-9a-f]{8}\.jsonl\.gz$"
)
MAX_AUDIT_ARCHIVE_COMPRESSED_BYTES = 64 * 1024 * 1024
MAX_AUDIT_ARCHIVE_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
MAX_AUDIT_ARCHIVE_LINE_BYTES = 1024 * 1024
MAX_AUDIT_ARCHIVE_RECORDS = 10_000
RESTORE_ID_QUERY_BATCH_SIZE = 500


class AuditArchiveValidationError(ValueError):
    pass


def list_audit_archives(archive_dir: str | Path) -> list[dict[str, object]]:
    root = Path(archive_dir)
    if not root.is_dir():
        return []

    archives: list[dict[str, object]] = []
    for path in root.iterdir():
        if not path.is_file() or not AUDIT_ARCHIVE_FILENAME_PATTERN.fullmatch(path.name):
            continue
        try:
            resolved = resolve_audit_archive_path(root, path.name)
        except FileNotFoundError:
            continue
        stat = resolved.stat()
        archives.append(
            {
                "filename": path.name,
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            }
        )
    return sorted(archives, key=lambda item: item["modified_at"], reverse=True)


def resolve_audit_archive_path(archive_dir: str | Path, filename: str) -> Path:
    if not AUDIT_ARCHIVE_FILENAME_PATTERN.fullmatch(filename):
        raise FileNotFoundError(filename)
    root = Path(archive_dir).resolve()
    candidate = (root / filename).resolve()
    if candidate.parent != root or not candidate.is_file():
        raise FileNotFoundError(filename)
    return candidate


async def restore_audit_archive(
    db: AsyncSession,
    *,
    archive_dir: str | Path,
    filename: str,
) -> dict[str, object]:
    path = resolve_audit_archive_path(archive_dir, filename)
    records = await asyncio.to_thread(_read_archive_records, path)
    existing_ids: set[str] = set()
    record_ids = [record["id"] for record in records]
    for start in range(0, len(record_ids), RESTORE_ID_QUERY_BATCH_SIZE):
        result = await db.execute(
            select(AuditLogModel.id).where(
                AuditLogModel.id.in_(
                    record_ids[start : start + RESTORE_ID_QUERY_BATCH_SIZE]
                )
            )
        )
        existing_ids.update(result.scalars().all())

    restored = [
        AuditLogModel(**record) for record in records if record["id"] not in existing_ids
    ]
    db.add_all(restored)
    return {
        "filename": filename,
        "total_count": len(records),
        "restored_count": len(restored),
        "skipped_count": len(records) - len(restored),
    }


def _read_archive_records(path: Path) -> list[dict[str, object]]:
    if path.stat().st_size > MAX_AUDIT_ARCHIVE_COMPRESSED_BYTES:
        raise AuditArchiveValidationError("아카이브 압축 파일이 허용 크기를 초과했습니다")

    records: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    uncompressed_bytes = 0
    try:
        with gzip.open(path, "rb") as archive:
            while True:
                raw_line = archive.readline(MAX_AUDIT_ARCHIVE_LINE_BYTES + 1)
                if not raw_line:
                    break
                if len(raw_line) > MAX_AUDIT_ARCHIVE_LINE_BYTES:
                    raise AuditArchiveValidationError(
                        "아카이브의 단일 레코드가 허용 크기를 초과했습니다"
                    )
                uncompressed_bytes += len(raw_line)
                if uncompressed_bytes > MAX_AUDIT_ARCHIVE_UNCOMPRESSED_BYTES:
                    raise AuditArchiveValidationError(
                        "아카이브 해제 데이터가 허용 크기를 초과했습니다"
                    )
                if not raw_line.strip():
                    continue
                if len(records) >= MAX_AUDIT_ARCHIVE_RECORDS:
                    raise AuditArchiveValidationError(
                        "아카이브 레코드 수가 허용 범위를 초과했습니다"
                    )
                record = _validate_archive_record(raw_line, len(records) + 1)
                record_id = str(record["id"])
                if record_id in seen_ids:
                    raise AuditArchiveValidationError(
                        f"아카이브 {len(records) + 1}번째 레코드 ID가 중복되었습니다"
                    )
                seen_ids.add(record_id)
                records.append(record)
    except (OSError, EOFError) as exc:
        raise AuditArchiveValidationError("gzip 아카이브를 읽을 수 없습니다") from exc

    if not records:
        raise AuditArchiveValidationError("아카이브에 복원할 감사 로그가 없습니다")
    return records


def _validate_archive_record(raw_line: bytes, line_number: int) -> dict[str, object]:
    try:
        payload = json.loads(raw_line.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 레코드가 올바른 JSON이 아닙니다"
        ) from exc
    if not isinstance(payload, dict):
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 레코드는 객체여야 합니다"
        )

    record_id = _validate_uuid(payload.get("id"), line_number)
    detail = payload.get("detail")
    if detail is not None and not isinstance(detail, dict):
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 detail은 객체여야 합니다"
        )
    return {
        "id": record_id,
        "actor": _validate_text(payload.get("actor"), "actor", 100, line_number),
        "action": _validate_text(payload.get("action"), "action", 20, line_number),
        "resource_type": _validate_text(
            payload.get("resource_type"), "resource_type", 50, line_number
        ),
        "resource_id": _validate_text(
            payload.get("resource_id"), "resource_id", 255, line_number
        ),
        "resource_name": _validate_text(
            payload.get("resource_name"), "resource_name", 255, line_number
        ),
        "detail": detail,
        "created_at": _validate_created_at(payload.get("created_at"), line_number),
    }


def _validate_uuid(value: object, line_number: int) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 id가 올바른 UUID가 아닙니다"
        ) from exc


def _validate_text(
    value: object,
    field: str,
    max_length: int,
    line_number: int,
) -> str:
    if not isinstance(value, str) or not value or len(value) > max_length:
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 {field} 값이 올바르지 않습니다"
        )
    return value


def _validate_created_at(value: object, line_number: int) -> datetime:
    if not isinstance(value, str):
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 created_at 값이 올바르지 않습니다"
        )
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AuditArchiveValidationError(
            f"아카이브 {line_number}번째 created_at 값이 올바르지 않습니다"
        ) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)
