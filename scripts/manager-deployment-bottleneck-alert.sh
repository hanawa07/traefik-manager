#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="${SCRIPT_DIR}/$(basename -- "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR
readonly SCRIPT_PATH
readonly ALERT_SCRIPT="${TM_HOST_OPERATION_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
readonly CONFIG_FILE="${TM_DEPLOY_BOTTLENECK_CONFIG_FILE:-${SCRIPT_DIR}/../traefik-config/.runtime/manager-deployment-bottleneck.conf}"
readonly STAGE_PAIR_PATTERN='"(prepare|build|migration_preflight|candidate_health|route_switch|leader_handover|public_probe|state_write)":[0-9]+'
THRESHOLD_MS="${TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS:-60000}"
CONSECUTIVE_COUNT="${TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE:-3}"
EVENT_RETENTION_DAYS="${TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS:-90}"
THRESHOLD_SOURCE="settings"
CONSECUTIVE_SOURCE="settings"
EVENT_RETENTION_SOURCE="settings"
[[ -z "${TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS:-}" ]] || THRESHOLD_SOURCE="environment"
[[ -z "${TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE:-}" ]] || CONSECUTIVE_SOURCE="environment"
[[ -z "${TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS:-}" ]] || EVENT_RETENTION_SOURCE="environment"
# shellcheck source=scripts/manager-deployment-bottleneck-events.sh
source "${SCRIPT_DIR}/manager-deployment-bottleneck-events.sh"

read_state_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}=//p" "${file}" | head -n 1
}

load_config() {
  local value
  [[ -f "${CONFIG_FILE}" ]] || return 0
  if [[ -z "${TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS:-}" ]]; then
    value="$(read_state_value "${CONFIG_FILE}" threshold_ms)"
    [[ -z "${value}" ]] || THRESHOLD_MS="${value}"
  fi
  if [[ -z "${TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE:-}" ]]; then
    value="$(read_state_value "${CONFIG_FILE}" consecutive_count)"
    [[ -z "${value}" ]] || CONSECUTIVE_COUNT="${value}"
  fi
  if [[ -z "${TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS:-}" ]]; then
    value="$(read_state_value "${CONFIG_FILE}" event_retention_days)"
    [[ -z "${value}" ]] || EVENT_RETENTION_DAYS="${value}"
  fi
}

validate_config() {
  if ! [[ "${THRESHOLD_MS}" =~ ^[1-9][0-9]*$ ]] \
    || (( THRESHOLD_MS < 1000 || THRESHOLD_MS > 900000 )); then
    echo "배포 병목 알림 기준은 1000~900000ms 정수여야 합니다" >&2
    return 1
  fi
  if ! [[ "${CONSECUTIVE_COUNT}" =~ ^[1-9][0-9]*$ ]] \
    || (( CONSECUTIVE_COUNT > 20 )); then
    echo "배포 병목 연속 횟수는 1~20 정수여야 합니다" >&2
    return 1
  fi
  if ! [[ "${EVENT_RETENTION_DAYS}" =~ ^[1-9][0-9]*$ ]] \
    || (( EVENT_RETENTION_DAYS > 3650 )); then
    echo "배포 병목 이벤트 보관 기간은 1~3650일 정수여야 합니다" >&2
    return 1
  fi
}

analyze_streak() {
  local history_file="$1"
  local line pair stage duration revision version
  local count=0
  local incident_key=""
  local latest_version=""
  local slowest_stage=""
  local slowest_ms=0
  local line_slowest_ms line_slowest_stage

  while IFS= read -r line; do
    [[ "${line}" == *'"status":"success"'* ]] || break
    line_slowest_ms=0
    line_slowest_stage=""
    while IFS= read -r pair; do
      stage="${pair%%\":*}"
      stage="${stage#\"}"
      duration="${pair##*:}"
      if (( duration > line_slowest_ms )); then
        line_slowest_ms="${duration}"
        line_slowest_stage="${stage}"
      fi
    done < <(grep -oE "${STAGE_PAIR_PATTERN}" <<< "${line}" || true)
    (( line_slowest_ms > THRESHOLD_MS )) || break

    count=$((count + 1))
    revision="${line#*\"revision\":\"}"
    revision="${revision%%\"*}"
    version="${line#*\"version\":\"}"
    version="${version%%\"*}"
    incident_key="${revision}"
    if (( count == 1 )); then
      latest_version="${version}"
    fi
    if (( line_slowest_ms > slowest_ms )); then
      slowest_ms="${line_slowest_ms}"
      slowest_stage="${line_slowest_stage}"
    fi
  done < <(tac "${history_file}")

  printf '%s|%s|%s|%s|%s\n' \
    "${count}" "${incident_key}" "${latest_version}" "${slowest_stage}" "${slowest_ms}"
}

write_check_status() {
  local status_file="$1"
  local status="$2"
  local count="$3"
  local incident_key="$4"
  local latest_version="$5"
  local slowest_stage="$6"
  local slowest_ms="$7"
  local alert_channel="$8"
  local run_url="$9"
  local alerted_at="${10}"
  local temporary_file
  temporary_file="$(mktemp "${status_file}.tmp.XXXXXX")"
  printf 'status=%s\nchecked_at=%s\neffective_threshold_ms=%s\neffective_consecutive_count=%s\neffective_event_retention_days=%s\nthreshold_source=%s\nconsecutive_source=%s\nevent_retention_source=%s\ncurrent_consecutive_count=%s\nincident_key=%s\nlatest_version=%s\nslowest_stage=%s\nslowest_ms=%s\nalert_channel=%s\nrun_url=%s\nalerted_at=%s\n' \
    "${status}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${THRESHOLD_MS}" "${CONSECUTIVE_COUNT}" \
    "${EVENT_RETENTION_DAYS}" "${THRESHOLD_SOURCE}" "${CONSECUTIVE_SOURCE}" \
    "${EVENT_RETENTION_SOURCE}" "${count}" "${incident_key}" "${latest_version}" \
    "${slowest_stage}" "${slowest_ms}" "${alert_channel}" "${run_url}" \
    "${alerted_at}" > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${status_file}"
}

check_history() (
  local history_file="$1"
  local state_file="${TM_DEPLOY_BOTTLENECK_ALERT_STATE_FILE:-${history_file}.bottleneck-alert.state}"
  local status_file="${TM_DEPLOY_BOTTLENECK_ALERT_STATUS_FILE:-${history_file}.bottleneck-alert.status}"
  local events_file="${TM_DEPLOY_BOTTLENECK_ALERT_EVENTS_FILE:-${CONFIG_FILE}.events.jsonl}"
  local legacy_events_file="${history_file}.bottleneck-alert.events.jsonl"
  local analysis count incident_key latest_version slowest_stage slowest_ms
  local alerted_incident alerted_at alert_channel run_url status
  mkdir -p "$(dirname "${events_file}")"
  exec 9>"${events_file}.lock"
  flock -x 9
  migrate_legacy_alert_events "${legacy_events_file}" "${events_file}"
  if ! prune_alert_events "${events_file}"; then
    echo "Manager 병목 이벤트 보관 기간 정리를 수행하지 못했습니다" >&2
  fi
  if [[ ! -f "${history_file}" ]]; then
    if [[ -f "${state_file}" ]]; then
      alert_channel="$(read_state_value "${state_file}" alert_channel)"
      run_url="$(read_state_value "${state_file}" run_url)"
      if ! append_alert_event "${events_file}" cleared 0 "" "" 0 \
        "${alert_channel}" "${run_url}"; then
        echo "Manager 병목 해제 이력을 기록하지 못했습니다" >&2
      fi
      rm -f "${state_file}"
    fi
    write_check_status "${status_file}" no_history 0 "" "" "" 0 "" "" ""
    check_event_storage_alert "${events_file}"
    return 0
  fi
  analysis="$(analyze_streak "${history_file}")"
  IFS='|' read -r count incident_key latest_version slowest_stage slowest_ms <<< "${analysis}"
  if (( count < CONSECUTIVE_COUNT )); then
    if [[ -f "${state_file}" ]]; then
      alert_channel="$(read_state_value "${state_file}" alert_channel)"
      run_url="$(read_state_value "${state_file}" run_url)"
      if ! append_alert_event "${events_file}" cleared "${count}" \
        "${latest_version}" "${slowest_stage}" "${slowest_ms}" \
        "${alert_channel}" "${run_url}"; then
        echo "Manager 병목 해제 이력을 기록하지 못했습니다" >&2
      fi
    fi
    rm -f "${state_file}"
    status="normal"
    (( count == 0 )) || status="pending"
    write_check_status "${status_file}" "${status}" "${count}" "${incident_key}" \
      "${latest_version}" "${slowest_stage}" "${slowest_ms}" "" "" ""
    check_event_storage_alert "${events_file}"
    return 0
  fi

  alerted_incident=""
  if [[ -f "${state_file}" ]]; then
    alerted_incident="$(read_state_value "${state_file}" incident_key)"
  fi
  if [[ -n "${alerted_incident}" && "${alerted_incident}" == "${incident_key}" ]]; then
    alert_channel="$(read_state_value "${state_file}" alert_channel)"
    run_url="$(read_state_value "${state_file}" run_url)"
    alerted_at="$(read_state_value "${state_file}" alerted_at)"
    write_check_status "${status_file}" alerted "${count}" "${incident_key}" \
      "${latest_version}" "${slowest_stage}" "${slowest_ms}" \
      "${alert_channel}" "${run_url}" "${alerted_at}"
    check_event_storage_alert "${events_file}"
    return 0
  fi
  if ! alert_channel="$(
    "${ALERT_SCRIPT}" \
      "Manager deployment bottleneck" \
      "연속 병목 ${count}회: threshold_ms=${THRESHOLD_MS}, latest=${latest_version}, slowest_stage=${slowest_stage}, slowest_ms=${slowest_ms}" \
      failure
  )"; then
    write_check_status "${status_file}" request_failed "${count}" "${incident_key}" \
      "${latest_version}" "${slowest_stage}" "${slowest_ms}" "" "" ""
    check_event_storage_alert "${events_file}"
    return 1
  fi
  run_url=""
  write_alert_state "${state_file}" "${incident_key}" "${alert_channel}" "${run_url}"
  alerted_at="$(read_state_value "${state_file}" alerted_at)"
  write_check_status "${status_file}" alerted "${count}" "${incident_key}" \
    "${latest_version}" "${slowest_stage}" "${slowest_ms}" \
    "${alert_channel}" "${run_url}" "${alerted_at}"
  if ! append_alert_event "${events_file}" alerted "${count}" \
    "${latest_version}" "${slowest_stage}" "${slowest_ms}" \
    "${alert_channel}" "${run_url}"; then
    echo "Manager 병목 발생 이력을 기록하지 못했습니다" >&2
  fi
  check_event_storage_alert "${events_file}"
  echo "Manager 연속 병목 운영 알림 요청: ${alert_channel}"
)

if [[ "${1:-}" == "--self-test" ]]; then
  # shellcheck source=scripts/manager-deployment-bottleneck-alert-self-test.sh
  source "${SCRIPT_DIR}/manager-deployment-bottleneck-alert-self-test.sh"
  run_self_test
  exit 0
fi

[[ -n "${1:-}" ]] \
  || { echo "사용법: $0 HISTORY_FILE" >&2; exit 2; }
load_config
validate_config
check_history "$1"
