#!/usr/bin/env bash

readonly MAX_EVENT_LINES=100
readonly EVENT_WARNING_COUNT=80

# Runtime configuration is initialized by manager-deployment-bottleneck-alert.sh.
# shellcheck disable=SC2154

write_alert_state() {
  local state_file="$1"
  local incident_key="$2"
  local alert_channel="$3"
  local run_url="$4"
  local temporary_file
  temporary_file="$(mktemp "${state_file}.tmp.XXXXXX")"
  printf 'incident_key=%s\nalert_channel=%s\nrun_url=%s\nalerted_at=%s\n' \
    "${incident_key}" "${alert_channel}" "${run_url}" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${state_file}"
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
    if ! [[ "${occurred_epoch}" =~ ^[0-9]+$ ]] || (( occurred_epoch < cutoff )); then
      continue
    fi
    printf '%s\n' "${line}" >> "${temporary_file}"
  done < <(tail -n "${MAX_EVENT_LINES}" "${events_file}")
  chmod 644 "${temporary_file}"
  mv -f "${temporary_file}" "${events_file}"
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
  mv -f "${temporary_file}" "${events_file}"
}

append_alert_event() {
  local events_file="$1"
  local event="$2"
  local count="$3"
  local latest_version="$4"
  local slowest_stage="$5"
  local slowest_ms="$6"
  local alert_channel="$7"
  local run_url="$8"
  local temporary_file
  temporary_file="$(mktemp "${events_file}.tmp.XXXXXX")"
  if [[ -f "${events_file}" ]]; then
    tail -n $((MAX_EVENT_LINES - 1)) "${events_file}" > "${temporary_file}"
  fi
  printf '{"event":"%s","occurred_at":"%s","threshold_ms":%s,"required_consecutive_count":%s,"current_consecutive_count":%s,"latest_version":"%s","slowest_stage":"%s","slowest_ms":%s,"alert_channel":"%s","run_url":"%s"}\n' \
    "${event}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${THRESHOLD_MS}" "${CONSECUTIVE_COUNT}" \
    "${count}" "$(json_escape "${latest_version}")" "$(json_escape "${slowest_stage}")" \
    "${slowest_ms}" "$(json_escape "${alert_channel}")" \
    "$(json_escape "${run_url}")" >> "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv -f "${temporary_file}" "${events_file}"
}

check_event_storage_alert() {
  local events_file="$1"
  local warning_state_file="${events_file}.storage-warning.state"
  local event_count=0
  local alert_channel run_url
  if [[ -f "${events_file}" ]]; then
    event_count="$(wc -l < "${events_file}")" || event_count=0
  fi

  if (( event_count >= EVENT_WARNING_COUNT )); then
    [[ ! -f "${warning_state_file}" ]] || return 0
    if alert_channel="$(
      "${ALERT_SCRIPT}" \
        "Manager deployment bottleneck event storage" \
        "이벤트 보관량 ${event_count}/${MAX_EVENT_LINES}건: ${EVENT_WARNING_COUNT}건 경고 기준 도달" \
        warning
    )"; then
      run_url=""
      if write_alert_state "${warning_state_file}" "${event_count}" \
        "${alert_channel}" "${run_url}"; then
        echo "Manager 병목 이벤트 보관 경고 요청: ${alert_channel}"
      else
        echo "Manager 병목 이벤트 보관 경고 상태를 기록하지 못했습니다" >&2
      fi
    else
      echo "Manager 병목 이벤트 보관 경고를 요청하지 못했습니다" >&2
    fi
    return 0
  fi

  [[ -f "${warning_state_file}" ]] || return 0
  if "${ALERT_SCRIPT}" \
    "Manager deployment bottleneck event storage" \
    "이벤트 보관량 ${event_count}/${MAX_EVENT_LINES}건: ${EVENT_WARNING_COUNT}건 미만으로 복구" \
    recovery >/dev/null; then
    rm -f "${warning_state_file}"
    echo "Manager 병목 이벤트 보관 복구 알림 요청"
  else
    echo "Manager 병목 이벤트 보관 복구 알림을 요청하지 못했습니다" >&2
  fi
  return 0
}
