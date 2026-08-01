#!/usr/bin/env bash

decide_action() {
  local current_status="$1"
  local previous_status="$2"
  local alert_active="$3"
  local last_alert_at="$4"
  local now_epoch="$5"
  local cooldown_seconds="$6"

  if [[ "${current_status}" == "healthy" ]]; then
    if [[ "${previous_status}" == "unhealthy" && "${alert_active}" == "1" ]]; then
      printf 'recovery\n'
    else
      printf 'none\n'
    fi
    return
  fi

  if (( last_alert_at == 0 || now_epoch - last_alert_at >= cooldown_seconds )); then
    if [[ "${previous_status}" == "unhealthy" && "${alert_active}" == "1" ]]; then
      printf 'failure_repeat\n'
    else
      printf 'failure\n'
    fi
  else
    printf 'none\n'
  fi
}

assert_decision() {
  local expected="$1"
  shift
  local actual
  actual="$(decide_action "$@")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "watchdog self-test 실패: expected=${expected}, actual=${actual}" >&2
    exit 1
  fi
}

run_self_test() {
  assert_decision none healthy unknown 0 0 1000 3600
  assert_decision failure unhealthy unknown 0 0 1000 3600
  assert_decision none unhealthy healthy 0 900 1000 3600
  assert_decision failure_repeat unhealthy unhealthy 1 1000 5000 3600
  assert_decision recovery healthy unhealthy 1 1000 1100 3600
  assert_decision none healthy unhealthy 0 1000 1100 3600
  echo "Manager 외부 health watchdog self-test 통과"
}
