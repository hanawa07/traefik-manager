#!/usr/bin/env bash

# Watchdog paths are initialized by manager-health-watchdog.sh.
# shellcheck disable=SC2154

read_state_value() {
  local key="$1"
  if [[ ! -f "${STATE_FILE}" ]]; then
    return
  fi
  awk -F= -v target="${key}" '$1 == target {print substr($0, index($0, "=") + 1); exit}' "${STATE_FILE}"
}

write_state() {
  local status="$1"
  local alert_active="$2"
  local last_alert_at="$3"
  local consecutive_failures="$4"
  local last_dispatch_event="$5"
  local last_dispatch_success="$6"
  local last_dispatch_at="$7"
  local last_dispatch_channel="$8"
  local last_dispatch_run_url="$9"
  local dispatch_history="${10}"
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  printf 'status=%s\nalert_active=%s\nlast_alert_at=%s\nconsecutive_failures=%s\nlast_dispatch_event=%s\nlast_dispatch_success=%s\nlast_dispatch_at=%s\nlast_dispatch_channel=%s\nlast_dispatch_run_url=%s\ndispatch_history=%s\n' \
    "${status}" "${alert_active}" "${last_alert_at}" "${consecutive_failures}" \
    "${last_dispatch_event}" "${last_dispatch_success}" "${last_dispatch_at}" \
    "${last_dispatch_channel}" "${last_dispatch_run_url}" "${dispatch_history}" \
    > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}
