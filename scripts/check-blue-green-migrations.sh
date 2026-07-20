#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT
readonly CHECKER="${REPO_ROOT}/backend/app/infrastructure/persistence/migration_compatibility.py"

base_revision="${1:-}"
head_revision="${2:-HEAD}"
if [[ -z "${base_revision}" ]]; then
  echo "사용법: $0 BASE_REVISION [HEAD_REVISION]" >&2
  exit 2
fi

cd "${REPO_ROOT}"
mapfile -t deleted_files < <(
  git diff --name-only --diff-filter=D "${base_revision}" "${head_revision}" -- \
    'backend/alembic/versions/*.py'
)
if (( ${#deleted_files[@]} > 0 )); then
  printf '기존 Alembic migration 삭제는 허용되지 않습니다: %s\n' "${deleted_files[*]}" >&2
  exit 1
fi

mapfile -t changed_files < <(
  git diff --name-only --diff-filter=ACMRT "${base_revision}" "${head_revision}" -- \
    'backend/alembic/versions/*.py'
)
python3 "${CHECKER}" "${changed_files[@]}"
