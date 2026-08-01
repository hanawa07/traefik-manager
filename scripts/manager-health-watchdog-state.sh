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
  local last_dispatch_run_url="$8"
  local dispatch_history="$9"
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  printf 'status=%s\nalert_active=%s\nlast_alert_at=%s\nconsecutive_failures=%s\nlast_dispatch_event=%s\nlast_dispatch_success=%s\nlast_dispatch_at=%s\nlast_dispatch_run_url=%s\ndispatch_history=%s\n' \
    "${status}" "${alert_active}" "${last_alert_at}" "${consecutive_failures}" \
    "${last_dispatch_event}" "${last_dispatch_success}" "${last_dispatch_at}" \
    "${last_dispatch_run_url}" "${dispatch_history}" \
    > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}

prepend_dispatch_history() {
  local event="$1"
  local dispatched_at="$2"
  local run_url="$3"
  local history="$4"
  if [[ "${run_url}" != https://github.com/*/actions/runs/* ]]; then
    printf '%s\n' "${history}"
    return
  fi
  printf '%s\n' "${event}|${dispatched_at}|${run_url}${history:+,${history}}" \
    | awk -F, '{ for (i = 1; i <= NF && i <= 5; i++) printf "%s%s", (i > 1 ? "," : ""), $i; print "" }'
}
