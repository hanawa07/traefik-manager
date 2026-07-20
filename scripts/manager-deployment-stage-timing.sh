#!/usr/bin/env bash
set -euo pipefail

readonly -a MANAGER_DEPLOYMENT_STAGE_NAMES=(
  prepare
  build
  migration_preflight
  candidate_health
  route_switch
  leader_handover
  public_probe
  state_write
)

declare -Ag MANAGER_DEPLOYMENT_STAGE_DURATIONS_MS=()
MANAGER_DEPLOYMENT_CURRENT_STAGE=""
MANAGER_DEPLOYMENT_CURRENT_STAGE_STARTED_MS=""

manager_deployment_stage_timing_reset() {
  MANAGER_DEPLOYMENT_STAGE_DURATIONS_MS=()
  MANAGER_DEPLOYMENT_CURRENT_STAGE=""
  MANAGER_DEPLOYMENT_CURRENT_STAGE_STARTED_MS=""
}

manager_deployment_stage_now_ms() {
  if [[ -n "${TM_DEPLOY_STAGE_NOW_MS:-}" ]]; then
    printf '%s\n' "${TM_DEPLOY_STAGE_NOW_MS}"
    return
  fi
  date +%s%3N
}

manager_deployment_stage_finish() {
  local completed_ms duration_ms
  if [[ -z "${MANAGER_DEPLOYMENT_CURRENT_STAGE}" ]]; then
    return
  fi
  completed_ms="$(manager_deployment_stage_now_ms)"
  duration_ms=$((completed_ms - MANAGER_DEPLOYMENT_CURRENT_STAGE_STARTED_MS))
  if (( duration_ms < 0 )); then
    duration_ms=0
  fi
  MANAGER_DEPLOYMENT_STAGE_DURATIONS_MS["${MANAGER_DEPLOYMENT_CURRENT_STAGE}"]="${duration_ms}"
  MANAGER_DEPLOYMENT_CURRENT_STAGE=""
  MANAGER_DEPLOYMENT_CURRENT_STAGE_STARTED_MS=""
}

manager_deployment_stage_start() {
  local stage="$1"
  if [[ " ${MANAGER_DEPLOYMENT_STAGE_NAMES[*]} " != *" ${stage} "* ]]; then
    echo "알 수 없는 Manager 배포 단계입니다: ${stage}" >&2
    return 1
  fi
  manager_deployment_stage_finish
  # Caller-owned state consumed by the blue-green rollback handler.
  # shellcheck disable=SC2034
  deployment_stage="${stage}"
  MANAGER_DEPLOYMENT_CURRENT_STAGE="${stage}"
  MANAGER_DEPLOYMENT_CURRENT_STAGE_STARTED_MS="$(manager_deployment_stage_now_ms)"
}

manager_deployment_stage_timing_json() {
  local stage duration separator="" output="{"
  for stage in "${MANAGER_DEPLOYMENT_STAGE_NAMES[@]}"; do
    duration="${MANAGER_DEPLOYMENT_STAGE_DURATIONS_MS[${stage}]:-}"
    if [[ -z "${duration}" ]]; then
      continue
    fi
    output+="${separator}\"${stage}\":${duration}"
    separator=","
  done
  printf '%s}\n' "${output}"
}

manager_deployment_stage_timing_self_test() {
  manager_deployment_stage_timing_reset
  TM_DEPLOY_STAGE_NOW_MS=1000
  manager_deployment_stage_start prepare
  TM_DEPLOY_STAGE_NOW_MS=1250
  manager_deployment_stage_start build
  TM_DEPLOY_STAGE_NOW_MS=2000
  manager_deployment_stage_finish
  [[ "$(manager_deployment_stage_timing_json)" == '{"prepare":250,"build":750}' ]]
  unset TM_DEPLOY_STAGE_NOW_MS
  manager_deployment_stage_timing_reset
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  manager_deployment_stage_timing_self_test
  echo "Manager 배포 단계 시간 self-test 통과"
fi
