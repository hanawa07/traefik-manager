#!/usr/bin/env bash

# Loaded by manager-deployment-bottleneck-alert.sh after runtime functions and configuration.
# shellcheck disable=SC2154

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
  local storage_history storage_state storage_status storage_events storage_capture
  local occurred_at index temporary_events
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

  storage_history="${temporary_dir}/storage-history.jsonl"
  storage_state="${temporary_dir}/storage-alert.state"
  storage_status="${temporary_dir}/storage-alert.status"
  storage_events="${temporary_dir}/storage-alert.events.jsonl"
  storage_capture="${temporary_dir}/storage-capture"
  occurred_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for ((index = 0; index < EVENT_WARNING_COUNT; index++)); do
    printf '{"event":"cleared","occurred_at":"%s"}\n' "${occurred_at}" >> "${storage_events}"
  done
  run_fixture_check \
    "${storage_history}" "${storage_state}" "${storage_status}" \
    "${fake_alert}" "${storage_capture}" "${storage_events}"
  [[ "$(wc -l < "${storage_capture}")" == "1" ]]
  [[ -f "${storage_events}.storage-warning.state" ]]
  grep -Fq '보관량 80/100건' "${storage_capture}"
  grep -Fq 'warning' "${storage_capture}"
  run_fixture_check \
    "${storage_history}" "${storage_state}" "${storage_status}" \
    "${fake_alert}" "${storage_capture}" "${storage_events}"
  [[ "$(wc -l < "${storage_capture}")" == "1" ]]
  temporary_events="${storage_events}.trim"
  head -n $((EVENT_WARNING_COUNT - 1)) "${storage_events}" > "${temporary_events}"
  mv -f "${temporary_events}" "${storage_events}"
  run_fixture_check \
    "${storage_history}" "${storage_state}" "${storage_status}" \
    "${fake_alert}" "${storage_capture}" "${storage_events}"
  [[ "$(wc -l < "${storage_capture}")" == "2" ]]
  [[ ! -e "${storage_events}.storage-warning.state" ]]
  grep -Fq 'recovery' "${storage_capture}"
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
