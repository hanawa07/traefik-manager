#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(dirname -- "${SCRIPT_PATH}")"
readonly ALERT_SCRIPT="${TM_HOST_OPERATION_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
readonly THRESHOLD_MS="${TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS:-60000}"
readonly CONSECUTIVE_COUNT="${TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE:-3}"
readonly STAGE_PAIR_PATTERN='"(prepare|build|migration_preflight|candidate_health|route_switch|leader_handover|public_probe|state_write)":[0-9]+'

validate_config() {
  [[ "${THRESHOLD_MS}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 병목 알림 기준은 양의 정수여야 합니다" >&2; return 1; }
  [[ "${CONSECUTIVE_COUNT}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 병목 연속 횟수는 양의 정수여야 합니다" >&2; return 1; }
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

  printf '%s\t%s\t%s\t%s\t%s\n' \
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

check_history() {
  local history_file="$1"
  local state_file="${TM_DEPLOY_BOTTLENECK_ALERT_STATE_FILE:-${history_file}.bottleneck-alert.state}"
  local analysis count incident_key latest_version slowest_stage slowest_ms alerted_incident run_url
  [[ -f "${history_file}" ]] || return 0
  analysis="$(analyze_streak "${history_file}")"
  IFS=$'\t' read -r count incident_key latest_version slowest_stage slowest_ms <<< "${analysis}"
  if (( count < CONSECUTIVE_COUNT )); then
    rm -f "${state_file}"
    return 0
  fi

  alerted_incident=""
  if [[ -f "${state_file}" ]]; then
    alerted_incident="$(sed -n 's/^incident_key=//p' "${state_file}" | head -n 1)"
  fi
  [[ -z "${alerted_incident}" || "${alerted_incident}" != "${incident_key}" ]] || return 0
  run_url="$(
    "${ALERT_SCRIPT}" \
      "Manager deployment bottleneck" \
      "연속 병목 ${count}회: threshold_ms=${THRESHOLD_MS}, latest=${latest_version}, slowest_stage=${slowest_stage}, slowest_ms=${slowest_ms}" \
      failure
  )"
  write_alert_state "${state_file}" "${incident_key}" "${run_url}"
  echo "Manager 연속 병목 운영 알림 요청: ${run_url}"
}

append_fixture() {
  local history_file="$1"
  local revision="$2"
  local duration="$3"
  local status="${4:-success}"
  printf '{"status":"%s","version":"v1.0.%s","revision":"%s","completed_at":"2026-07-17T00:00:00Z","stage_durations_ms":{"build":%s}}\n' \
    "${status}" "${revision}" "${revision}" "${duration}" >> "${history_file}"
}

run_self_test() {
  local temporary_dir history_file state_file fake_alert capture_file
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  history_file="${temporary_dir}/history.jsonl"
  state_file="${temporary_dir}/alert.state"
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
  run_fixture_check "${history_file}" "${state_file}" "${fake_alert}" "${capture_file}"
  [[ ! -e "${capture_file}" && ! -e "${state_file}" ]]
  append_fixture "${history_file}" 3 70003
  run_fixture_check "${history_file}" "${state_file}" "${fake_alert}" "${capture_file}"
  [[ "$(wc -l < "${capture_file}")" == "1" && -f "${state_file}" ]]
  run_fixture_check "${history_file}" "${state_file}" "${fake_alert}" "${capture_file}"
  [[ "$(wc -l < "${capture_file}")" == "1" ]]
  append_fixture "${history_file}" 4 1000
  run_fixture_check "${history_file}" "${state_file}" "${fake_alert}" "${capture_file}"
  [[ ! -e "${state_file}" ]]
  append_fixture "${history_file}" 5 80001
  append_fixture "${history_file}" 6 80002
  append_fixture "${history_file}" 7 80003
  run_fixture_check "${history_file}" "${state_file}" "${fake_alert}" "${capture_file}"
  [[ "$(wc -l < "${capture_file}")" == "2" ]]
  grep -Fq '연속 병목 3회' "${capture_file}"
  echo "Manager 연속 병목 알림 self-test 통과"
}

run_fixture_check() {
  TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS=60000 \
  TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE=3 \
  TM_DEPLOY_BOTTLENECK_ALERT_STATE_FILE="$2" \
  TM_DEPLOY_BOTTLENECK_ALERT_CAPTURE="$4" \
  TM_HOST_OPERATION_ALERT_SCRIPT="$3" \
    "${SCRIPT_PATH}" "$1" >/dev/null
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

validate_config
[[ -n "${1:-}" ]] \
  || { echo "사용법: $0 HISTORY_FILE" >&2; exit 2; }
check_history "$1"
