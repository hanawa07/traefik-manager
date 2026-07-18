#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(dirname -- "${SCRIPT_PATH}")"
readonly ALERT_SCRIPT="${TM_HOST_OPERATION_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
readonly CONFIG_FILE="${TM_DEPLOY_BOTTLENECK_CONFIG_FILE:-${SCRIPT_DIR}/../traefik-config/.runtime/manager-deployment-bottleneck.conf}"
readonly STAGE_PAIR_PATTERN='"(prepare|build|migration_preflight|candidate_health|route_switch|leader_handover|public_probe|state_write)":[0-9]+'
readonly MAX_EVENT_LINES=100
THRESHOLD_MS="${TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS:-60000}"
CONSECUTIVE_COUNT="${TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE:-3}"
EVENT_RETENTION_DAYS="${TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS:-90}"
THRESHOLD_SOURCE="settings"
CONSECUTIVE_SOURCE="settings"
EVENT_RETENTION_SOURCE="settings"
[[ -z "${TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS:-}" ]] || THRESHOLD_SOURCE="environment"
[[ -z "${TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE:-}" ]] || CONSECUTIVE_SOURCE="environment"
[[ -z "${TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS:-}" ]] || EVENT_RETENTION_SOURCE="environment"

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
  [[ "${THRESHOLD_MS}" =~ ^[1-9][0-9]*$ ]] \
    && (( THRESHOLD_MS >= 1000 && THRESHOLD_MS <= 900000 )) \
    || { echo "배포 병목 알림 기준은 1000~900000ms 정수여야 합니다" >&2; return 1; }
  [[ "${CONSECUTIVE_COUNT}" =~ ^[1-9][0-9]*$ ]] \
    && (( CONSECUTIVE_COUNT <= 20 )) \
    || { echo "배포 병목 연속 횟수는 1~20 정수여야 합니다" >&2; return 1; }
  [[ "${EVENT_RETENTION_DAYS}" =~ ^[1-9][0-9]*$ ]] \
    && (( EVENT_RETENTION_DAYS <= 3650 )) \
    || { echo "배포 병목 이벤트 보관 기간은 1~3650일 정수여야 합니다" >&2; return 1; }
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

write_alert_state() {
  local state_file="$1"
  local incident_key="$2"
  local run_url="$3"
  local temporary_file
  temporary_file="$(mktemp "${state_file}.tmp.XXXXXX")"
  printf 'incident_key=%s\nrun_url=%s\nalerted_at=%s\n' \
    "${incident_key}" "${run_url}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${state_file}"
}

write_check_status() {
  local status_file="$1"
  local status="$2"
  local count="$3"
  local incident_key="$4"
  local latest_version="$5"
  local slowest_stage="$6"
  local slowest_ms="$7"
  local run_url="$8"
  local alerted_at="$9"
  local temporary_file
  temporary_file="$(mktemp "${status_file}.tmp.XXXXXX")"
  printf 'status=%s\nchecked_at=%s\neffective_threshold_ms=%s\neffective_consecutive_count=%s\neffective_event_retention_days=%s\nthreshold_source=%s\nconsecutive_source=%s\nevent_retention_source=%s\ncurrent_consecutive_count=%s\nincident_key=%s\nlatest_version=%s\nslowest_stage=%s\nslowest_ms=%s\nrun_url=%s\nalerted_at=%s\n' \
    "${status}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${THRESHOLD_MS}" "${CONSECUTIVE_COUNT}" \
    "${EVENT_RETENTION_DAYS}" "${THRESHOLD_SOURCE}" "${CONSECUTIVE_SOURCE}" \
    "${EVENT_RETENTION_SOURCE}" "${count}" "${incident_key}" "${latest_version}" \
    "${slowest_stage}" "${slowest_ms}" "${run_url}" "${alerted_at}" > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${status_file}"
}

json_escape() {
  local value="${1//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/}"
  value="${value//$'\r'/}"
  value="${value//$'\t'/ }"
  printf '%s' "${value}"
}

prune_alert_events() {
  local events_file="$1"
  [[ -f "${events_file}" ]] || return 0
  local cutoff line occurred_at occurred_epoch temporary_file
  cutoff="$(date -u -d "${EVENT_RETENTION_DAYS} days ago" +%s)"
  temporary_file="$(mktemp "${events_file}.tmp.XXXXXX")"
  while IFS= read -r line; do
    occurred_at="${line#*\"occurred_at\":\"}"
    [[ "${occurred_at}" != "${line}" ]] || continue
    occurred_at="${occurred_at%%\"*}"
    occurred_epoch="$(date -u -d "${occurred_at}" +%s 2>/dev/null || true)"
    [[ "${occurred_epoch}" =~ ^[0-9]+$ ]] && (( occurred_epoch >= cutoff )) || continue
    printf '%s\n' "${line}" >> "${temporary_file}"
  done < <(tail -n "${MAX_EVENT_LINES}" "${events_file}")
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${events_file}"
}

migrate_legacy_alert_events() {
  local legacy_events_file="$1"
  local events_file="$2"
  [[ "${legacy_events_file}" != "${events_file}" ]] || return 0
  [[ ! -e "${events_file}" && -f "${legacy_events_file}" ]] || return 0
  local temporary_file
  temporary_file="$(mktemp "${events_file}.tmp.XXXXXX")"
  tail -n "${MAX_EVENT_LINES}" "${legacy_events_file}" > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${events_file}"
}

append_alert_event() {
  local events_file="$1"
  local event="$2"
  local count="$3"
  local latest_version="$4"
  local slowest_stage="$5"
  local slowest_ms="$6"
  local run_url="$7"
  local temporary_file
  temporary_file="$(mktemp "${events_file}.tmp.XXXXXX")"
  if [[ -f "${events_file}" ]]; then
    tail -n $((MAX_EVENT_LINES - 1)) "${events_file}" > "${temporary_file}"
  fi
  printf '{"event":"%s","occurred_at":"%s","threshold_ms":%s,"required_consecutive_count":%s,"current_consecutive_count":%s,"latest_version":"%s","slowest_stage":"%s","slowest_ms":%s,"run_url":"%s"}\n' \
    "${event}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${THRESHOLD_MS}" "${CONSECUTIVE_COUNT}" \
    "${count}" "$(json_escape "${latest_version}")" "$(json_escape "${slowest_stage}")" \
    "${slowest_ms}" "$(json_escape "${run_url}")" >> "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${events_file}"
}

check_history() (
  local history_file="$1"
  local state_file="${TM_DEPLOY_BOTTLENECK_ALERT_STATE_FILE:-${history_file}.bottleneck-alert.state}"
  local status_file="${TM_DEPLOY_BOTTLENECK_ALERT_STATUS_FILE:-${history_file}.bottleneck-alert.status}"
  local events_file="${TM_DEPLOY_BOTTLENECK_ALERT_EVENTS_FILE:-${CONFIG_FILE}.events.jsonl}"
  local legacy_events_file="${history_file}.bottleneck-alert.events.jsonl"
  local analysis count incident_key latest_version slowest_stage slowest_ms
  local alerted_incident alerted_at run_url status
  mkdir -p "$(dirname "${events_file}")"
  exec 9>"${events_file}.lock"
  flock -x 9
  migrate_legacy_alert_events "${legacy_events_file}" "${events_file}"
  if ! prune_alert_events "${events_file}"; then
    echo "Manager 병목 이벤트 보관 기간 정리를 수행하지 못했습니다" >&2
  fi
  if [[ ! -f "${history_file}" ]]; then
    if [[ -f "${state_file}" ]]; then
      run_url="$(read_state_value "${state_file}" run_url)"
      if ! append_alert_event "${events_file}" cleared 0 "" "" 0 "${run_url}"; then
        echo "Manager 병목 해제 이력을 기록하지 못했습니다" >&2
      fi
      rm -f "${state_file}"
    fi
    write_check_status "${status_file}" no_history 0 "" "" "" 0 "" ""
    return 0
  fi
  analysis="$(analyze_streak "${history_file}")"
  IFS='|' read -r count incident_key latest_version slowest_stage slowest_ms <<< "${analysis}"
  if (( count < CONSECUTIVE_COUNT )); then
    if [[ -f "${state_file}" ]]; then
      run_url="$(read_state_value "${state_file}" run_url)"
      if ! append_alert_event "${events_file}" cleared "${count}" \
        "${latest_version}" "${slowest_stage}" "${slowest_ms}" "${run_url}"; then
        echo "Manager 병목 해제 이력을 기록하지 못했습니다" >&2
      fi
    fi
    rm -f "${state_file}"
    status="normal"
    (( count == 0 )) || status="pending"
    write_check_status "${status_file}" "${status}" "${count}" "${incident_key}" \
      "${latest_version}" "${slowest_stage}" "${slowest_ms}" "" ""
    return 0
  fi

  alerted_incident=""
  if [[ -f "${state_file}" ]]; then
    alerted_incident="$(read_state_value "${state_file}" incident_key)"
  fi
  if [[ -n "${alerted_incident}" && "${alerted_incident}" == "${incident_key}" ]]; then
    run_url="$(read_state_value "${state_file}" run_url)"
    alerted_at="$(read_state_value "${state_file}" alerted_at)"
    write_check_status "${status_file}" alerted "${count}" "${incident_key}" \
      "${latest_version}" "${slowest_stage}" "${slowest_ms}" "${run_url}" "${alerted_at}"
    return 0
  fi
  if ! run_url="$(
    "${ALERT_SCRIPT}" \
      "Manager deployment bottleneck" \
      "연속 병목 ${count}회: threshold_ms=${THRESHOLD_MS}, latest=${latest_version}, slowest_stage=${slowest_stage}, slowest_ms=${slowest_ms}" \
      failure
  )"; then
    write_check_status "${status_file}" request_failed "${count}" "${incident_key}" \
      "${latest_version}" "${slowest_stage}" "${slowest_ms}" "" ""
    return 1
  fi
  write_alert_state "${state_file}" "${incident_key}" "${run_url}"
  alerted_at="$(read_state_value "${state_file}" alerted_at)"
  write_check_status "${status_file}" alerted "${count}" "${incident_key}" \
    "${latest_version}" "${slowest_stage}" "${slowest_ms}" "${run_url}" "${alerted_at}"
  if ! append_alert_event "${events_file}" alerted "${count}" \
    "${latest_version}" "${slowest_stage}" "${slowest_ms}" "${run_url}"; then
    echo "Manager 병목 발생 이력을 기록하지 못했습니다" >&2
  fi
  echo "Manager 연속 병목 운영 알림 요청: ${run_url}"
)

append_fixture() {
  local history_file="$1"
  local revision="$2"
  local duration="$3"
  local status="${4:-success}"
  printf '{"status":"%s","version":"v1.0.%s","revision":"%s","completed_at":"2026-07-17T00:00:00Z","stage_durations_ms":{"build":%s}}\n' \
    "${status}" "${revision}" "${revision}" "${duration}" >> "${history_file}"
}

run_self_test() {
  local temporary_dir history_file state_file status_file events_file fake_alert capture_file
  local config_history config_state config_status config_events config_file config_capture
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  history_file="${temporary_dir}/history.jsonl"
  state_file="${temporary_dir}/alert.state"
  status_file="${temporary_dir}/alert.status"
  events_file="${temporary_dir}/alert.events.jsonl"
  fake_alert="${temporary_dir}/alert"
  capture_file="${temporary_dir}/capture"
  cat > "${fake_alert}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_DEPLOY_BOTTLENECK_ALERT_CAPTURE}"
printf 'https://github.com/hanawa07/traefik-manager/actions/runs/101\n'
SCRIPT
  chmod 700 "${fake_alert}"

  append_fixture "${history_file}" 1 70001
  append_fixture "${history_file}" 2 70002
  run_fixture_check "${history_file}" "${state_file}" "${status_file}" "${fake_alert}" "${capture_file}" "${events_file}"
  [[ ! -e "${capture_file}" && ! -e "${state_file}" ]]
  [[ ! -e "${events_file}" ]]
  grep -Fq 'status=pending' "${status_file}"
  grep -Fq 'threshold_source=environment' "${status_file}"
  grep -Fq 'consecutive_source=environment' "${status_file}"
  grep -Fq 'event_retention_source=environment' "${status_file}"
  append_fixture "${history_file}" 3 70003
  run_fixture_check "${history_file}" "${state_file}" "${status_file}" "${fake_alert}" "${capture_file}" "${events_file}"
  [[ "$(wc -l < "${capture_file}")" == "1" && -f "${state_file}" ]]
  [[ "$(wc -l < "${events_file}")" == "1" ]]
  grep -Fq '"event":"alerted"' "${events_file}"
  grep -Fq 'status=alerted' "${status_file}"
  run_fixture_check "${history_file}" "${state_file}" "${status_file}" "${fake_alert}" "${capture_file}" "${events_file}"
  [[ "$(wc -l < "${capture_file}")" == "1" ]]
  [[ "$(wc -l < "${events_file}")" == "1" ]]
  append_fixture "${history_file}" 4 1000
  run_fixture_check "${history_file}" "${state_file}" "${status_file}" "${fake_alert}" "${capture_file}" "${events_file}"
  [[ ! -e "${state_file}" ]]
  [[ "$(wc -l < "${events_file}")" == "2" ]]
  grep -Fq '"event":"cleared"' "${events_file}"
  grep -Fq 'status=normal' "${status_file}"
  grep -Fq 'current_consecutive_count=0' "${status_file}"
  grep -Fq 'slowest_ms=0' "${status_file}"
  append_fixture "${history_file}" 5 80001
  append_fixture "${history_file}" 6 80002
  append_fixture "${history_file}" 7 80003
  run_fixture_check "${history_file}" "${state_file}" "${status_file}" "${fake_alert}" "${capture_file}" "${events_file}"
  [[ "$(wc -l < "${capture_file}")" == "2" ]]
  [[ "$(wc -l < "${events_file}")" == "3" ]]
  grep -Fq '연속 병목 3회' "${capture_file}"
  rm "${history_file}"
  run_fixture_check "${history_file}" "${state_file}" "${status_file}" "${fake_alert}" "${capture_file}" "${events_file}"
  [[ ! -e "${state_file}" && "$(wc -l < "${events_file}")" == "4" ]]
  grep -Fq 'status=no_history' "${status_file}"

  config_history="${temporary_dir}/config-history.jsonl"
  config_state="${temporary_dir}/config-alert.state"
  config_status="${temporary_dir}/config-alert.status"
  config_file="${temporary_dir}/bottleneck.conf"
  config_events="${config_file}.events.jsonl"
  config_capture="${temporary_dir}/config-capture"
  printf 'threshold_ms=75000\nconsecutive_count=2\nevent_retention_days=30\n' > "${config_file}"
  printf '{"event":"alerted","occurred_at":"2000-01-01T00:00:00Z"}\n' > "${config_history}.bottleneck-alert.events.jsonl"
  append_fixture "${config_history}" 8 76001
  append_fixture "${config_history}" 9 76002
  (
    unset TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE
    unset TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS
    TM_DEPLOY_BOTTLENECK_CONFIG_FILE="${config_file}" \
    TM_DEPLOY_BOTTLENECK_ALERT_STATE_FILE="${config_state}" \
    TM_DEPLOY_BOTTLENECK_ALERT_STATUS_FILE="${config_status}" \
    TM_DEPLOY_BOTTLENECK_ALERT_CAPTURE="${config_capture}" \
    TM_HOST_OPERATION_ALERT_SCRIPT="${fake_alert}" \
      "${SCRIPT_PATH}" "${config_history}" >/dev/null
  )
  grep -Fq 'effective_threshold_ms=75000' "${config_status}"
  grep -Fq 'effective_consecutive_count=2' "${config_status}"
  grep -Fq 'effective_event_retention_days=30' "${config_status}"
  grep -Fq 'threshold_source=settings' "${config_status}"
  grep -Fq 'consecutive_source=settings' "${config_status}"
  grep -Fq 'event_retention_source=settings' "${config_status}"
  [[ "$(wc -l < "${config_capture}")" == "1" ]]
  [[ "$(wc -l < "${config_events}")" == "1" ]]
  echo "Manager 연속 병목 알림 self-test 통과"
}

run_fixture_check() {
  TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS=60000 \
  TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE=3 \
  TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS=90 \
  TM_DEPLOY_BOTTLENECK_ALERT_STATE_FILE="$2" \
  TM_DEPLOY_BOTTLENECK_ALERT_STATUS_FILE="$3" \
  TM_DEPLOY_BOTTLENECK_ALERT_CAPTURE="$5" \
  TM_DEPLOY_BOTTLENECK_ALERT_EVENTS_FILE="$6" \
  TM_HOST_OPERATION_ALERT_SCRIPT="$4" \
    "${SCRIPT_PATH}" "$1" >/dev/null
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

[[ -n "${1:-}" ]] \
  || { echo "사용법: $0 HISTORY_FILE" >&2; exit 2; }
load_config
validate_config
check_history "$1"
