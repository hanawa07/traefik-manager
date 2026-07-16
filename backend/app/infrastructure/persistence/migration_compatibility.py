import ast
import sys
from pathlib import Path
from typing import Iterable

MARKER_NAME = "BLUE_GREEN_COMPATIBLE"


def incompatible_revision_ids(revisions: Iterable[object]) -> tuple[str, ...]:
    return tuple(
        str(revision.revision)
        for revision in revisions
        if getattr(revision.module, MARKER_NAME, False) is not True
    )


def incompatible_migration_files(paths: Iterable[str | Path]) -> tuple[Path, ...]:
    return tuple(Path(path) for path in paths if not migration_file_is_compatible(Path(path)))


def migration_file_is_compatible(path: Path) -> bool:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (OSError, SyntaxError, UnicodeError):
        return False

    for node in tree.body:
        if isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == MARKER_NAME for target in node.targets):
                return isinstance(node.value, ast.Constant) and node.value.value is True
        if isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id == MARKER_NAME:
                return isinstance(node.value, ast.Constant) and node.value.value is True
    return False


def main(arguments: list[str] | None = None) -> int:
    paths = arguments if arguments is not None else sys.argv[1:]
    incompatible = incompatible_migration_files(paths)
    if incompatible:
        joined = ", ".join(str(path) for path in incompatible)
        print(f"blue-green 호환성 표식이 없거나 올바르지 않은 migration: {joined}", file=sys.stderr)
        return 1
    print(f"blue-green migration 파일 호환성 검사 통과: {len(paths)}개")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
