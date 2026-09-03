#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly STATE_DIR="${TM_USER_SYSTEMD_WATCHDOG_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly STATE_FILE="${STATE_DIR}/user-systemd-unit-watchdog.state"
readonly BASELINE_FILE="${TM_USER_SYSTEMD_BASELINE_FILE:-${STATE_DIR}/user-systemd-unit-baseline.sha256}"
readonly LOCK_FILE="${STATE_DIR}/user-systemd-unit-watchdog.lock"
readonly SYSTEMCTL_BIN="${TM_USER_SYSTEMD_SYSTEMCTL_BIN:-systemctl}"
readonly SHA256SUM_BIN="${TM_USER_SYSTEMD_SHA256SUM_BIN:-sha256sum}"
readonly ALERT_SCRIPT="${TM_USER_SYSTEMD_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
readonly FAILURE_THRESHOLD="${TM_USER_SYSTEMD_FAILURE_THRESHOLD:-2}"
readonly COOLDOWN_SECONDS="${TM_USER_SYSTEMD_COOLDOWN_SECONDS:-21600}"
readonly ALERT_SOURCE="사용자 systemd 타이머·서비스 점검"
readonly WATCHDOG_SERVICE_NAME="traefik-manager-user-systemd-watchdog.service"

declare -a baseline_units=()
declare -a issues=()
declare -A baseline_hashes=()
declare -A baseline_roles=()
declare -A issue_seen=()
baseline_candidate_count=0

get_property() {
  "${SYSTEMCTL_BIN}" --user show "$1" --property="$2" --value 2>/dev/null
}

valid_unit_name() {
  [[ "$1" =~ ^[A-Za-z0-9_.@:-]+\.(timer|service)$ ]]
}

list_active_enabled_timers() {
  local output timer state active
  output="$(
    "${SYSTEMCTL_BIN}" --user list-unit-files --type=timer --state=enabled \
      --no-legend --no-pager
  )" || return 1
  while read -r timer state _; do
    [[ -n "${timer:-}" && "${state:-}" == enabled* ]] || continue
    valid_unit_name "${timer}" || return 1
    active="$(get_property "${timer}" ActiveState)" || return 1
    [[ "${active}" == "active" ]] && printf '%s\n' "${timer}"
  done <<< "${output}"
}

discover_units() {
  local timers timer triggers trigger found_service records=""
  timers="$(list_active_enabled_timers)" || return 1
  [[ -n "${timers}" ]] || return 1
  while read -r timer; do
    [[ -n "${timer}" ]] || continue
    records+="timer ${timer}"$'\n'
    triggers="$(get_property "${timer}" Triggers)" || return 1
    found_service=0
    for trigger in ${triggers}; do
      [[ "${trigger}" == *.service ]] || continue
      valid_unit_name "${trigger}" || return 1
      records+="service ${trigger}"$'\n'
      found_service=1
    done
    [[ "${found_service}" == "1" ]] || return 1
  done <<< "${timers}"
  printf '%s' "${records}" | sort -u -k2,2
}

hash_unit() {
  local output hash
  output="$(
    "${SYSTEMCTL_BIN}" --user cat "$1" 2>/dev/null | "${SHA256SUM_BIN}"
  )" || return 1
  hash="${output%% *}"
  [[ "${hash}" =~ ^[a-fA-F0-9]{64}$ ]] || return 1
  printf '%s\n' "${hash,,}"
}

service_is_healthy() {
  local active result
  # The running watchdog sees its own previous Result until this invocation exits.
  [[ "$1" == "${WATCHDOG_SERVICE_NAME}" ]] && return 0
  active="$(get_property "$1" ActiveState)" || return 1
  result="$(get_property "$1" Result)" || return 1
  [[ "${active}" != "failed" ]]
  [[ -z "${result}" || "${result}" == "success" ]]
}

build_baseline_candidate() {
  local inventory_file="$1"
  local candidate_file="$2"
  local role unit extra load active enabled hash
  baseline_candidate_count=0
  discover_units > "${inventory_file}" || {
    echo "활성 사용자 systemd 타이머 목록을 만들 수 없습니다" >&2
    return 1
  }
  while read -r role unit extra; do
    [[ -n "${unit:-}" && -z "${extra:-}" ]] || return 1
    load="$(get_property "${unit}" LoadState)" || return 1
    [[ "${load}" == "loaded" ]] || {
      echo "기준선 대상 unit이 로드되지 않았습니다: ${unit}" >&2
      return 1
    }
    if [[ "${role}" == "timer" ]]; then
      active="$(get_property "${unit}" ActiveState)" || return 1
      enabled="$("${SYSTEMCTL_BIN}" --user is-enabled "${unit}" 2>/dev/null || true)"
      [[ "${active}" == "active" && "${enabled}" == enabled* ]] || return 1
    elif [[ "${role}" == "service" ]]; then
      service_is_healthy "${unit}" || {
        echo "실패 상태 service는 기준선에 포함할 수 없습니다: ${unit}" >&2
        return 1
      }
    else
      return 1
    fi
    hash="$(hash_unit "${unit}")" || return 1
    printf '%s %s %s\n' "${hash}" "${role}" "${unit}" >> "${candidate_file}"
    baseline_candidate_count=$((baseline_candidate_count + 1))
  done < "${inventory_file}"
  [[ "${baseline_candidate_count}" -gt 0 ]]
}

write_baseline() {
  local inventory_file temporary_file
  if [[ -e "${BASELINE_FILE}" || -L "${BASELINE_FILE}" ]]; then
    echo "기존 기준선이 있습니다. 명시적 unit 제한 갱신을 사용하세요" >&2
    return 1
  fi
  inventory_file="$(mktemp "${STATE_DIR}/user-systemd-units.XXXXXX")"
  temporary_file="$(mktemp "${BASELINE_FILE}.tmp.XXXXXX")"
  if ! build_baseline_candidate "${inventory_file}" "${temporary_file}"; then
    rm -f "${inventory_file}" "${temporary_file}"
    return 1
  fi
  chmod 644 "${temporary_file}"
  rm -f "${inventory_file}"
  mv "${temporary_file}" "${BASELINE_FILE}"
  echo "사용자 systemd 기준선 저장 완료 (${baseline_candidate_count}개 unit)" || true
  return 0
}

read_baseline() {
  local hash role unit extra timer_count=0
  [[ -s "${BASELINE_FILE}" ]] || return 1
  while read -r hash role unit extra; do
    [[ "${hash}" =~ ^[a-f0-9]{64}$ && -z "${extra:-}" ]] || return 1
    valid_unit_name "${unit:-}" || return 1
    [[ "${role}" == "timer" && "${unit}" == *.timer || \
      "${role}" == "service" && "${unit}" == *.service ]] || return 1
    [[ -z "${baseline_hashes[${unit}]+x}" ]] || return 1
    baseline_units+=("${unit}")
    baseline_hashes["${unit}"]="${hash}"
    baseline_roles["${unit}"]="${role}"
    [[ "${role}" == "timer" ]] && timer_count=$((timer_count + 1))
  done < "${BASELINE_FILE}"
  [[ "${timer_count}" -gt 0 ]]
}

update_baseline() {
  local mode="$1"
  shift
  local inventory_file temporary_file hash role unit extra failure_reason=""
  local -A selected_units=()
  local -A candidate_units=()

  [[ "${mode}" == refresh || "${mode}" == retire ]] || return 2

  read_baseline || {
    echo "기존 사용자 systemd 기준선이 없거나 올바르지 않습니다" >&2
    return 1
  }
  for unit in "$@"; do
    valid_unit_name "${unit}" || {
      echo "허용 unit 이름이 올바르지 않습니다: ${unit}" >&2
      return 1
    }
    [[ -z "${selected_units[${unit}]+x}" ]] || {
      echo "대상 unit이 중복되었습니다: ${unit}" >&2
      return 1
    }
    selected_units["${unit}"]=1
  done

  inventory_file="$(mktemp "${STATE_DIR}/user-systemd-units.XXXXXX")"
  temporary_file="$(mktemp "${BASELINE_FILE}.tmp.XXXXXX")"
  if ! build_baseline_candidate "${inventory_file}" "${temporary_file}"; then
    rm -f "${inventory_file}" "${temporary_file}"
    return 1
  fi

  while read -r hash role unit extra; do
    if [[ ! "${hash}" =~ ^[a-f0-9]{64}$ || -n "${extra:-}" ]] \
      || ! valid_unit_name "${unit:-}"; then
      failure_reason="새 기준선 후보가 올바르지 않습니다"
      break
    fi
    candidate_units["${unit}"]=1
    if [[ -z "${baseline_hashes[${unit}]+x}" ]]; then
      [[ "${mode}" == refresh && -n "${selected_units[${unit}]+x}" ]] \
        || failure_reason="허용되지 않은 unit 추가: ${unit}"
    elif [[ "${baseline_roles[${unit}]}" != "${role}" ]]; then
      failure_reason="unit 역할 변경은 허용되지 않습니다: ${unit}"
    elif [[ "${baseline_hashes[${unit}]}" != "${hash}" \
      && ( "${mode}" != refresh || -z "${selected_units[${unit}]+x}" ) ]]; then
      failure_reason="허용되지 않은 unit 변경: ${unit}"
    fi
    [[ -z "${failure_reason}" ]] || break
  done < "${temporary_file}"

  if [[ -z "${failure_reason}" ]]; then
    for unit in "${baseline_units[@]}"; do
      if [[ -z "${candidate_units[${unit}]+x}" ]]; then
        [[ "${mode}" == retire && -n "${selected_units[${unit}]+x}" ]] \
          || failure_reason="기존 unit 삭제는 허용되지 않습니다: ${unit}"
        [[ -z "${failure_reason}" ]] || break
      fi
    done
  fi
  if [[ -z "${failure_reason}" ]]; then
    for unit in "${!selected_units[@]}"; do
      if [[ "${mode}" == refresh && -z "${candidate_units[${unit}]+x}" ]]; then
        failure_reason="갱신 대상 unit이 활성 기준선에 없습니다: ${unit}"
      elif [[ "${mode}" == retire && -z "${baseline_hashes[${unit}]+x}" ]]; then
        failure_reason="폐기 대상 unit이 기존 기준선에 없습니다: ${unit}"
      elif [[ "${mode}" == retire && -n "${candidate_units[${unit}]+x}" ]]; then
        failure_reason="폐기 대상 unit이 아직 활성 기준선에 있습니다: ${unit}"
      fi
      if [[ -n "${failure_reason}" ]]; then
        break
      fi
    done
  fi
  if [[ -n "${failure_reason}" ]]; then
    echo "${failure_reason}" >&2
    rm -f "${inventory_file}" "${temporary_file}"
    return 1
  fi

  chmod 644 "${temporary_file}"
  rm -f "${inventory_file}"
  mv "${temporary_file}" "${BASELINE_FILE}"
  if [[ "${mode}" == refresh ]]; then
    echo "사용자 systemd 기준선 제한 갱신 완료 (${baseline_candidate_count}개 unit)" || true
  else
    echo "사용자 systemd 기준선 제한 폐기 완료 (${baseline_candidate_count}개 unit)" || true
  fi
  return 0
}

refresh_baseline() {
  update_baseline refresh "$@"
}

retire_baseline() {
  update_baseline retire "$@"
}

add_issue() {
  [[ -n "${issue_seen[$1]+x}" ]] && return
  issue_seen["$1"]=1
  issues+=("$1")
}

check_units() {
  local current_timers timer unit role load active enabled result current_hash
  if ! read_baseline; then
    add_issue "baseline-invalid"
    return
  fi
  if current_timers="$(list_active_enabled_timers)"; then
    while read -r timer; do
      [[ -n "${timer}" ]] || continue
      if [[ "${baseline_roles[${timer}]:-}" != "timer" ]]; then
        add_issue "unexpected-timer:${timer}"
      fi
    done <<< "${current_timers}"
  else
    add_issue "systemctl-unavailable"
  fi

  for unit in "${baseline_units[@]}"; do
    role="${baseline_roles[${unit}]}"
    if ! load="$(get_property "${unit}" LoadState)" || [[ "${load}" != "loaded" ]]; then
      add_issue "unit-not-loaded:${unit}"
      continue
    fi
    active="$(get_property "${unit}" ActiveState 2>/dev/null || true)"
    if [[ "${role}" == "timer" ]]; then
      enabled="$("${SYSTEMCTL_BIN}" --user is-enabled "${unit}" 2>/dev/null || true)"
      [[ "${enabled}" == enabled* ]] || add_issue "timer-disabled:${unit}"
      [[ "${active}" == "active" ]] || add_issue "timer-inactive:${unit}"
    else
      if [[ "${unit}" != "${WATCHDOG_SERVICE_NAME}" ]]; then
        result="$(get_property "${unit}" Result 2>/dev/null || true)"
        [[ "${active}" != "failed" ]] || add_issue "service-failed:${unit}"
        [[ -z "${result}" || "${result}" == "success" ]] \
          || add_issue "service-result:${unit}"
      fi
    fi
    if current_hash="$(hash_unit "${unit}")"; then
      [[ "${current_hash}" == "${baseline_hashes[${unit}]}" ]] \
        || add_issue "unit-drift:${unit}"
    else
      add_issue "unit-unreadable:${unit}"
    fi
  done
}

read_state() {
  [[ -f "${STATE_FILE}" ]] || return 0
  awk -F= -v target="$1" '$1 == target { print substr($0, index($0, "=") + 1); exit }' \
    "${STATE_FILE}"
}

write_state() {
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  {
    printf 'status=%s\n' "$1"
    printf 'alert_active=%s\n' "$2"
    printf 'last_alert_at=%s\n' "$3"
    printf 'consecutive_failures=%s\n' "$4"
    printf 'last_check_at=%s\n' "$5"
    printf 'detail=%s\n' "$6"
  } > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}

for value in "${FAILURE_THRESHOLD}" "${COOLDOWN_SECONDS}"; do
  [[ "${value}" =~ ^[1-9][0-9]*$ ]] || {
    echo "watchdog 설정은 양의 정수여야 합니다: ${value}" >&2
    exit 2
  }
done
[[ "${BASELINE_FILE}" == /* ]] || { echo "기준선 경로는 절대 경로여야 합니다" >&2; exit 2; }
for command_name in awk chmod flock mktemp mv sort "${SYSTEMCTL_BIN}" "${SHA256SUM_BIN}"; do
  command -v "${command_name}" >/dev/null || {
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  }
done

mkdir -p "${STATE_DIR}" "${BASELINE_FILE%/*}"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  if [[ "${1:-}" =~ ^--(write|refresh|retire)-baseline$ ]]; then
    echo "사용자 systemd 기준선이 다른 점검에서 사용 중입니다" >&2
    exit 1
  fi
  exit 0
fi

if [[ "${1:-}" == "--write-baseline" ]]; then
  [[ $# -eq 1 ]] || { echo "사용법: $0 --write-baseline" >&2; exit 2; }
  write_baseline
  exit 0
fi
if [[ "${1:-}" == "--refresh-baseline" ]]; then
  shift
  [[ $# -gt 0 ]] || {
    echo "사용법: $0 --refresh-baseline <timer-or-service> [...]" >&2
    exit 2
  }
  refresh_baseline "$@"
  exit 0
fi
if [[ "${1:-}" == "--retire-baseline" ]]; then
  shift
  [[ $# -gt 0 ]] || {
    echo "사용법: $0 --retire-baseline <inactive-timer-or-service> [...]" >&2
    exit 2
  }
  retire_baseline "$@"
  exit 0
fi
[[ $# -eq 0 ]] || {
  echo "사용법: $0 [--write-baseline|--refresh-baseline <unit> [...]|--retire-baseline <unit> [...]]" >&2
  exit 2
}
command -v "${ALERT_SCRIPT}" >/dev/null || {
  echo "알림 스크립트를 찾을 수 없습니다: ${ALERT_SCRIPT}" >&2
  exit 1
}

previous_status="$(read_state status)"
alert_active="$(read_state alert_active)"
last_alert_at="$(read_state last_alert_at)"
consecutive_failures="$(read_state consecutive_failures)"
[[ "${previous_status}" =~ ^(healthy|unhealthy)$ ]] || previous_status="unknown"
[[ "${alert_active}" =~ ^[01]$ ]] || alert_active="0"
[[ "${last_alert_at}" =~ ^[0-9]+$ ]] || last_alert_at="0"
[[ "${consecutive_failures}" =~ ^[0-9]+$ ]] || consecutive_failures="0"

check_units
now_epoch="${TM_USER_SYSTEMD_NOW_EPOCH:-$(date +%s)}"
[[ "${now_epoch}" =~ ^[0-9]+$ ]] || { echo "현재 시각이 올바르지 않습니다" >&2; exit 2; }
if [[ "${#issues[@]}" -eq 0 ]]; then
  current_status="healthy"
  current_failures="0"
  detail="ok:${#baseline_units[@]}-units"
else
  current_status="unhealthy"
  [[ "${previous_status}" == "unhealthy" ]] \
    && current_failures=$((consecutive_failures + 1)) \
    || current_failures=1
  detail="$(IFS=,; printf '%s' "${issues[*]}")"
  detail="${detail:0:500}"
fi

action="none"
if [[ "${current_status}" == "healthy" && "${previous_status}" == "unhealthy" && \
  "${alert_active}" == "1" ]]; then
  action="recovery"
elif [[ "${current_status}" == "unhealthy" && "${current_failures}" -ge "${FAILURE_THRESHOLD}" ]]; then
  if [[ "${alert_active}" == "0" || $((now_epoch - last_alert_at)) -ge "${COOLDOWN_SECONDS}" ]]; then
    action="failure"
  fi
fi

if [[ "${action}" == "failure" ]]; then
  if "${ALERT_SCRIPT}" "${ALERT_SOURCE}" \
    "연속 이상 ${current_failures}회 · ${issues[0]}" failure >/dev/null; then
    alert_active="1"
    last_alert_at="${now_epoch}"
  else
    write_state "${current_status}" "${alert_active}" "${last_alert_at}" \
      "${current_failures}" "${now_epoch}" "${detail}"
    echo "사용자 systemd 장애 알림 전송 실패" >&2
    exit 1
  fi
elif [[ "${action}" == "recovery" ]]; then
  if "${ALERT_SCRIPT}" "${ALERT_SOURCE}" \
    "정상 복구 · 장애 중 연속 이상 ${consecutive_failures}회" recovery >/dev/null; then
    alert_active="0"
  else
    write_state unhealthy 1 "${last_alert_at}" "${consecutive_failures}" \
      "${now_epoch}" "recovery-alert-failed"
    echo "사용자 systemd 복구 알림 전송 실패" >&2
    exit 1
  fi
fi

write_state "${current_status}" "${alert_active}" "${last_alert_at}" \
  "${current_failures}" "${now_epoch}" "${detail}"
echo "$(date --iso-8601=seconds) 사용자 systemd ${current_status} (${detail})"
