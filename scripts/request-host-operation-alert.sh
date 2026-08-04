#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")"
readonly SCRIPT_PATH
readonly DOCKER_BIN="${TM_HOST_OPERATION_ALERT_DOCKER_BIN:-docker}"
readonly ANUBIS_CONTAINER="${TM_HOST_OPERATION_ALERT_ANUBIS_CONTAINER:-anubis}"
readonly ANUBIS_CLI="${TM_HOST_OPERATION_ALERT_ANUBIS_CLI:-/app/scripts/send-host-operation-alert.js}"
readonly SUCCESS_MARKER="ANUBIS_HOST_OPERATION_ALERT=sent"

validate_input() {
  local status="$1"
  [[ "${status}" == "failure" || "${status}" == "warning" || "${status}" == "recovery" ]] \
    || { echo "알림 상태는 failure, warning, recovery 중 하나여야 합니다" >&2; return 1; }
}

run_self_test() {
  local temporary_dir fake_docker capture_file channel
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  fake_docker="${temporary_dir}/docker"
  capture_file="${temporary_dir}/arguments"
  cat > "${fake_docker}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$@" > "${TM_HOST_OPERATION_ALERT_CAPTURE}"
printf '%s\n' "${TM_HOST_OPERATION_ALERT_FAKE_OUTPUT:-ANUBIS_HOST_OPERATION_ALERT=sent}"
SCRIPT
  chmod 700 "${fake_docker}"
  channel="$(
    TM_HOST_OPERATION_ALERT_DOCKER_BIN="${fake_docker}" \
    TM_HOST_OPERATION_ALERT_CAPTURE="${capture_file}" \
      "${SCRIPT_PATH}" "Manager deployment bottleneck event storage" \
      "이벤트 보관량 80/100건: 80건 경고 기준 도달" warning
  )"
  [[ "${channel}" == "anubis" ]]
  grep -Fxq 'exec' "${capture_file}"
  grep -Fxq 'anubis' "${capture_file}"
  grep -Fxq '/app/scripts/send-host-operation-alert.js' "${capture_file}"
  grep -Fxq 'Manager deployment bottleneck event storage' "${capture_file}"
  grep -Fxq '이벤트 보관량 80/100건: 80건 경고 기준 도달' "${capture_file}"
  grep -Fxq 'warning' "${capture_file}"
  if TM_HOST_OPERATION_ALERT_DOCKER_BIN="${fake_docker}" \
    TM_HOST_OPERATION_ALERT_CAPTURE="${capture_file}" \
    TM_HOST_OPERATION_ALERT_FAKE_OUTPUT='ANUBIS_HOST_OPERATION_ALERT=pending' \
      "${SCRIPT_PATH}" "Manager deployment bottleneck event storage" \
      "이벤트 보관량 80/100건: 80건 경고 기준 도달" warning \
      >/dev/null 2>&1; then
    echo "잘못된 Anubis 성공 marker를 허용했습니다" >&2
    return 1
  fi
  echo "Anubis 호스트 운영 알림 self-test 통과"
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

source_name="${1:-}"
detail="${2:-}"
status="${3:-failure}"
if [[ -z "${source_name}" || -z "${detail}" ]]; then
  echo "사용법: $0 SOURCE DETAIL [failure|warning|recovery]" >&2
  exit 2
fi
validate_input "${status}"
command -v "${DOCKER_BIN}" >/dev/null \
  || { echo "docker 명령을 찾을 수 없습니다: ${DOCKER_BIN}" >&2; exit 1; }

result="$(
  "${DOCKER_BIN}" exec "${ANUBIS_CONTAINER}" node "${ANUBIS_CLI}" \
    "${source_name}" "${detail}" "${status}"
)"
if [[ "${result}" != "${SUCCESS_MARKER}" ]]; then
  echo "Anubis 호스트 운영 알림 성공 marker를 확인하지 못했습니다" >&2
  exit 1
fi
printf 'anubis\n'
