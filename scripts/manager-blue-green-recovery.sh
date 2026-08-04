#!/usr/bin/env bash

# Deployment state is initialized by blue-green-deploy.sh before these functions run.
# shellcheck disable=SC2154

write_state() {
  local slot="$1"
  local revision="$2"
  local version="$3"
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  printf 'slot=%s\nrevision=%s\nversion=%s\nupdated_at=%s\n' \
    "${slot}" "${revision}" "${version}" "$(date --iso-8601=seconds)" \
    > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}

record_deployment_history() {
  local status="$1"
  local active_slot="$2"
  local exit_code="${3:-0}"
  local probe_total=0
  local probe_failures=0
  local failure_stage=""
  local failure_reason=""
  local stage_durations_json="{}"
  if (( history_record_enabled == 0 || history_recorded == 1 )); then
    return
  fi
  manager_deployment_stage_finish
  stage_durations_json="$(manager_deployment_stage_timing_json)"
  if [[ -n "${probe_file}" && -f "${probe_file}" ]]; then
    read -r probe_total probe_failures <<< "$("${PROBE_SCRIPT}" summary "${probe_file}")"
  fi
  if [[ "${status}" != "success" ]]; then
    failure_stage="${deployment_stage}"
    if (( probe_failures > 0 )); then
      failure_reason="HTTP 비정상 ${probe_failures}/${probe_total}건"
    else
      failure_reason="명령 종료 코드 ${exit_code}"
    fi
    case "${status}" in
      failed_before_switch) failure_reason+=" · 후보 전환 전 중단" ;;
      rolled_back) failure_reason+=" · 자동 rollback 완료" ;;
      rollback_failed) failure_reason+=" · 자동 rollback 미완료" ;;
    esac
  fi
  if ! TM_DEPLOY_HISTORY_MAX_ENTRIES="${HISTORY_MAX_ENTRIES}" \
    TM_DEPLOY_HISTORY_RETAIN_ENTRIES="${HISTORY_RETAIN_ENTRIES}" \
    TM_DEPLOY_HISTORY_DAILY_RETAIN_ENTRIES="${HISTORY_DAILY_RETAIN_ENTRIES}" \
    "${HISTORY_SCRIPT}" append \
    "${HISTORY_FILE}" "${status}" "${previous_slot}" "${candidate_slot}" "${active_slot}" \
    "${version}" "${revision}" "${deployment_started_at}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "${probe_total}" "${probe_failures}" "${failure_stage}" "${failure_reason}" \
    "${alert_request_status}" "${alert_channel}" "${alert_run_url}" \
    "${stage_durations_json}"; then
    echo "배포 이력을 기록하지 못했습니다: ${HISTORY_FILE}" >&2
  elif ! "${SCRIPT_DIR}/manager-deployment-bottleneck-alert.sh" "${HISTORY_FILE}"; then
    echo "연속 병목 운영 알림을 확인하지 못했습니다" >&2
  fi
  history_recorded=1
}

notify_rollback_failure() {
  local active_slot="$1"
  "${HOST_ALERT_SCRIPT}" \
    "Manager blue-green rollback" \
    "자동 rollback 실패: previous=${previous_slot}, candidate=${candidate_slot}, active=${active_slot}, version=${version}, revision=${revision}" \
    failure
}

snapshot_state() {
  if [[ ! -f "${STATE_FILE}" ]]; then
    return
  fi
  state_backup_file="$(mktemp "${STATE_FILE}.backup.XXXXXX")"
  cp --preserve=mode,timestamps "${STATE_FILE}" "${state_backup_file}"
  state_existed=1
}

restore_state() {
  if (( state_existed == 1 )); then
    if ! mv "${state_backup_file}" "${STATE_FILE}"; then
      echo "배포 상태 백업을 복원하지 못했습니다: ${state_backup_file}" >&2
      return 1
    fi
    state_backup_file=""
  else
    rm -f "${STATE_FILE}"
  fi
}

start_probe() {
  probe_file="$(mktemp "${STATE_DIR}/deployment-probe.XXXXXX")"
  probe_stop_file="${probe_file}.stop"
  TM_DEPLOY_PROBE_CURL_RESOLVE="${health_curl_resolve:-}" \
    "${PROBE_SCRIPT}" run "${health_url}" "${probe_file}" "${probe_stop_file}" \
      "${PROBE_INTERVAL_SECONDS}" &
  probe_pid=$!
  sleep 0.5
}

stop_probe() {
  if [[ -n "${probe_pid}" ]]; then
    touch "${probe_stop_file}"
    wait "${probe_pid}" 2>/dev/null || true
    probe_pid=""
  fi
}

rollback() {
  local exit_code="$1"
  local rollback_succeeded=1
  local history_status="failed_before_switch"
  local history_active_slot="${previous_slot:-unknown}"
  trap - EXIT
  set +e
  manager_deployment_stage_finish
  stop_probe
  if (( switched == 1 )); then
    echo "배포 실패, ${previous_slot} 슬롯으로 rollback합니다" >&2
    if ! start_existing_slot "${previous_slot}" \
      || ! render_route "$(upstream_for_slot "${previous_slot}")" \
      || ! wait_traefik_route "$(backend_for_slot "${previous_slot}")" "$(upstream_for_slot "${previous_slot}")" \
      || ! restore_state; then
      rollback_succeeded=0
      history_status="rollback_failed"
      history_active_slot="$(infer_active_slot "${ROUTE_FILE}")"
      echo "자동 rollback이 완료되지 않아 후보 슬롯을 유지합니다" >&2
      if alert_channel="$(notify_rollback_failure "${history_active_slot}")"; then
        alert_request_status="requested"
        alert_run_url=""
      else
        alert_request_status="request_failed"
        alert_channel=""
        alert_run_url=""
        echo "rollback 실패 운영 알림을 요청하지 못했습니다" >&2
      fi
    else
      history_status="rolled_back"
    fi
  fi
  if (( candidate_started == 1 && (switched == 0 || rollback_succeeded == 1) )); then
    stop_slot "${candidate_slot}"
  fi
  record_deployment_history "${history_status}" "${history_active_slot}" "${exit_code}"
  [[ -z "${probe_file}" ]] || rm -f "${probe_file}" "${probe_stop_file}"
  if (( switched == 0 )) && [[ -n "${state_backup_file}" ]]; then
    rm -f "${state_backup_file}"
  fi
  if [[ -n "${state_backup_file}" ]]; then
    echo "배포 상태 백업을 보존했습니다: ${state_backup_file}" >&2
  fi
  exit "${exit_code}"
}
