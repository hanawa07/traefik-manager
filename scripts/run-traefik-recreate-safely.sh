#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly STATE_DIR="${TM_MANAGER_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
if [[ "$#" -gt 1 || ( "$#" -eq 1 && "${1}" != "--force-recreate" && "${1}" != "--checkpoint" ) ]]; then
  echo "사용법: $0 [--force-recreate|--checkpoint]" >&2
  exit 2
fi
[[ "${1:-}" == "--checkpoint" ]] || "${SCRIPT_DIR}/traefik_recreate_window.py"
mkdir -p "${STATE_DIR}"
exec 9>> "${STATE_DIR}/traefik-update-runner.lock"
flock -n 9 || { echo "다른 Traefik 업데이트 작업이 실행 중입니다" >&2; exit 1; }
exec "${SCRIPT_DIR}/traefik_safe_recreate.py" "$@"
