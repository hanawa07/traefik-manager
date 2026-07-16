from pathlib import Path
from types import SimpleNamespace

from app.infrastructure.persistence.migration_compatibility import (
    incompatible_migration_files,
    incompatible_revision_ids,
)


def test_revision_check_reuses_runtime_marker():
    revisions = (
        SimpleNamespace(revision="safe", module=SimpleNamespace(BLUE_GREEN_COMPATIBLE=True)),
        SimpleNamespace(revision="unsafe", module=SimpleNamespace(BLUE_GREEN_COMPATIBLE=False)),
    )

    assert incompatible_revision_ids(revisions) == ("unsafe",)


def test_file_check_requires_top_level_true_marker(tmp_path: Path):
    safe = tmp_path / "safe.py"
    unsafe = tmp_path / "unsafe.py"
    missing = tmp_path / "missing.py"
    safe.write_text("BLUE_GREEN_COMPATIBLE: bool = True\n", encoding="utf-8")
    unsafe.write_text("BLUE_GREEN_COMPATIBLE = False\n", encoding="utf-8")

    assert incompatible_migration_files((safe, unsafe, missing)) == (unsafe, missing)
