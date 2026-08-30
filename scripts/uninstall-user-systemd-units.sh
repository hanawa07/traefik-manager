#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly STATE_DIR="${TM_USER_SYSTEMD_WATCHDOG_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly BASELINE_FILE="${TM_USER_SYSTEMD_BASELINE_FILE:-${STATE_DIR}/user-systemd-unit-baseline.sha256}"
readonly UNIT_DIR="${TM_USER_SYSTEMD_UNIT_DIR:-${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user}"
readonly WATCHDOG_SCRIPT="${TM_USER_SYSTEMD_WATCHDOG_SCRIPT:-${SCRIPT_DIR}/user-systemd-unit-watchdog.sh}"
readonly TRANSACTION_LIB="${TM_USER_SYSTEMD_TRANSACTION_LIB:-${SCRIPT_DIR}/lib/user-systemd-unit-transaction.sh}"
readonly SYSTEMCTL_BIN="${TM_USER_SYSTEMD_SYSTEMCTL_BIN:-systemctl}"
temporary_dir="$(mktemp -d)"
readonly temporary_dir
readonly baseline_backup="${temporary_dir}/baseline.before"

usage() {
  echo "사용법: $0 [--dry-run|--confirm=REMOVE] <timer> [path ...] <service> [...]" >&2
}

restore_baseline() {
  local temporary_restore
  temporary_restore="$(mktemp "${BASELINE_FILE}.rollback.XXXXXX")" || return 1
  if ! cp -p -- "${baseline_backup}" "${temporary_restore}" \
    || ! mv -- "${temporary_restore}" "${BASELINE_FILE}"; then
    rm -f -- "${temporary_restore}"
    return 1
  fi
}

finish_uninstall() {
  local exit_status=$?
  local restore_baseline_after=0
  local finish_status=0
  trap - EXIT INT TERM HUP
  set +e
  [[ "${TM_USER_SYSTEMD_TRANSACTION_ACTIVE:-0}" == 1 ]] && restore_baseline_after=1
  if declare -F tm_finish_user_systemd_unit_transaction >/dev/null; then
    tm_finish_user_systemd_unit_transaction "${exit_status}"
    finish_status=$?
  else
    finish_status="${exit_status}"
  fi
  if [[ "${restore_baseline_after}" == 1 ]] && ! restore_baseline; then
    echo "사용자 systemd 기준선 자동 복구에 실패했습니다" >&2
    finish_status=1
  fi
  rm -rf -- "${temporary_dir}"
  exit "${finish_status}"
}
trap finish_uninstall EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

valid_path() {
  [[ "$1" =~ ^/[A-Za-z0-9_./-]+$ ]]
}

valid_unit() {
  [[ "$1" =~ ^[A-Za-z0-9_.@:-]+\.(timer|service|path)$ ]]
}

get_property() {
  "${SYSTEMCTL_BIN}" --user show "$1" --property="$2" --value
}

baseline_has_unit() {
  awk -v target="$1" '
    $1 ~ /^[a-f0-9]{64}$/ && NF == 3 && $3 == target &&
      (($2 == "timer" && target ~ /\.timer$/) ||
       ($2 == "service" && target ~ /\.service$/)) { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "${BASELINE_FILE}"
}

configure_user_bus() {
  local runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "${runtime_dir}/bus" ]]; then
    export XDG_RUNTIME_DIR="${runtime_dir}"
    export DBUS_SESSION_BUS_ADDRESS="unix:path=${runtime_dir}/bus"
  fi
}

case "${1:-}" in
  --dry-run) mode="DRY_RUN" ;;
  --confirm=REMOVE) mode="REMOVE" ;;
  *) usage; exit 2 ;;
esac
readonly mode
shift
[[ "$#" -ge 2 ]] || { usage; exit 2; }
for path in "${STATE_DIR}" "${BASELINE_FILE}" "${UNIT_DIR}" "${WATCHDOG_SCRIPT}" \
  "${TRANSACTION_LIB}"; do
  valid_path "${path}" || { echo "경로가 올바르지 않습니다: ${path}" >&2; exit 2; }
done
for command_name in awk cp mktemp mv rm "${SYSTEMCTL_BIN}"; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done
[[ -f "${BASELINE_FILE}" && ! -L "${BASELINE_FILE}" ]] || {
  echo "사용자 systemd 기준선이 없거나 일반 파일이 아닙니다" >&2
  exit 1
}
[[ -x "${WATCHDOG_SCRIPT}" ]] || {
  echo "사용자 systemd 기준선 갱신 스크립트를 실행할 수 없습니다" >&2
  exit 1
}
[[ -r "${TRANSACTION_LIB}" ]] || {
  echo "사용자 systemd unit 트랜잭션을 읽을 수 없습니다" >&2
  exit 1
}

declare -a units=()
declare -a control_units=()
declare -a timer_units=()
declare -a service_units=()
declare -a retire_units=()
declare -A selected=()
declare -A service_has_control=()

for unit in "$@"; do
  valid_unit "${unit}" || { echo "unit 이름이 올바르지 않습니다: ${unit}" >&2; exit 2; }
  [[ -z "${selected[${unit}]+x}" ]] \
    || { echo "대상 unit이 중복되었습니다: ${unit}" >&2; exit 2; }
  [[ -e "${UNIT_DIR}/${unit}" || -L "${UNIT_DIR}/${unit}" ]] || {
    echo "로컬 사용자 unit 파일을 찾을 수 없습니다: ${unit}" >&2
    exit 1
  }
  [[ ! -e "${UNIT_DIR}/${unit}.d" && ! -L "${UNIT_DIR}/${unit}.d" ]] || {
    echo "drop-in이 있는 unit은 자동 제거하지 않습니다: ${unit}" >&2
    exit 1
  }
  selected["${unit}"]=1
  units+=("${unit}")
  case "${unit}" in
    *.timer)
      control_units+=("${unit}")
      timer_units+=("${unit}")
      retire_units+=("${unit}")
      ;;
    *.path) control_units+=("${unit}") ;;
    *.service)
      service_units+=("${unit}")
      retire_units+=("${unit}")
      ;;
  esac
done
[[ "${#timer_units[@]}" -gt 0 && "${#service_units[@]}" -gt 0 ]] || {
  echo "최소 한 개의 timer와 service를 함께 지정해야 합니다" >&2
  exit 2
}
for unit in "${retire_units[@]}"; do
  baseline_has_unit "${unit}" || {
    echo "감시 기준선에 없는 unit은 자동 제거하지 않습니다: ${unit}" >&2
    exit 1
  }
done

configure_user_bus
for control in "${control_units[@]}"; do
  triggers="$(get_property "${control}" Triggers)" || {
    echo "unit 실행 관계를 확인할 수 없습니다: ${control}" >&2
    exit 1
  }
  control_has_service=0
  for trigger in ${triggers}; do
    [[ "${trigger}" == *.service && -n "${selected[${trigger}]+x}" ]] || {
      echo "함께 제거하지 않은 실행 대상이 있습니다: ${control} -> ${trigger}" >&2
      exit 1
    }
    service_has_control["${trigger}"]=1
    control_has_service=1
  done
  [[ "${control_has_service}" == 1 ]] || {
    echo "service 실행 관계가 없는 unit은 자동 제거하지 않습니다: ${control}" >&2
    exit 1
  }
done
for service in "${service_units[@]}"; do
  [[ -n "${service_has_control[${service}]+x}" ]] || {
    echo "선택한 timer/path가 실행하지 않는 service입니다: ${service}" >&2
    exit 1
  }
  triggered_by="$(get_property "${service}" TriggeredBy)" || {
    echo "service 역참조 관계를 확인할 수 없습니다: ${service}" >&2
    exit 1
  }
  [[ -n "${triggered_by}" ]] || {
    echo "service를 실행하는 unit을 확인할 수 없습니다: ${service}" >&2
    exit 1
  }
  for trigger in ${triggered_by}; do
    [[ ( "${trigger}" == *.timer || "${trigger}" == *.path ) \
      && -n "${selected[${trigger}]+x}" ]] || {
      echo "함께 제거하지 않은 service 실행 주체가 있습니다: ${service} <- ${trigger}" >&2
      exit 1
    }
  done
  if "${SYSTEMCTL_BIN}" --user is-active --quiet "${service}"; then
    echo "실행 중인 service는 자동 제거하지 않습니다: ${service}" >&2
    exit 1
  fi
done

if [[ "${mode}" == "DRY_RUN" ]]; then
  echo "사용자 systemd unit 제거 사전 점검 완료(변경 없음)"
  echo "중지·비활성화 예정: ${control_units[*]}"
  echo "파일 제거 예정: ${units[*]}"
  echo "감시 기준선 폐기 예정: ${retire_units[*]}"
  exit 0
fi

cp -p -- "${BASELINE_FILE}" "${baseline_backup}"
# shellcheck source=lib/user-systemd-unit-transaction.sh
source "${TRANSACTION_LIB}"
transaction_backup="${temporary_dir}/unit-transaction"
TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}" \
  tm_begin_user_systemd_unit_transaction "${transaction_backup}" "${UNIT_DIR}" "${units[@]}"

"${SYSTEMCTL_BIN}" --user stop "${control_units[@]}"
"${SYSTEMCTL_BIN}" --user disable "${control_units[@]}"
for control in "${control_units[@]}"; do
  if "${SYSTEMCTL_BIN}" --user is-active --quiet "${control}"; then
    echo "unit이 아직 실행 중입니다: ${control}" >&2
    exit 1
  fi
  if "${SYSTEMCTL_BIN}" --user is-enabled --quiet "${control}"; then
    echo "unit이 아직 활성화되어 있습니다: ${control}" >&2
    exit 1
  fi
done
for unit in "${units[@]}"; do
  rm -f -- "${UNIT_DIR}/${unit}"
done
"${SYSTEMCTL_BIN}" --user daemon-reload
for unit in "${units[@]}"; do
  load_state="$(get_property "${unit}" LoadState 2>/dev/null || true)"
  [[ "${load_state}" == "not-found" ]] || {
    echo "제거한 unit이 아직 로드되어 있습니다: ${unit}" >&2
    exit 1
  }
done

TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
TM_USER_SYSTEMD_SYSTEMCTL_BIN="${SYSTEMCTL_BIN}" \
  "${WATCHDOG_SCRIPT}" --retire-baseline "${retire_units[@]}"
tm_commit_user_systemd_unit_transaction

echo "사용자 systemd unit 안전 제거 완료: ${units[*]}"
