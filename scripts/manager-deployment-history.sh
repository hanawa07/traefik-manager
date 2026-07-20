#!/usr/bin/env bash
set -euo pipefail

readonly MAX_ENTRIES="${TM_DEPLOY_HISTORY_MAX_ENTRIES:-200}"
readonly RETAIN_ENTRIES="${TM_DEPLOY_HISTORY_RETAIN_ENTRIES:-100}"
readonly DAILY_RETAIN_ENTRIES="${TM_DEPLOY_HISTORY_DAILY_RETAIN_ENTRIES:-365}"
readonly STAGE_DURATIONS_PATTERN='^\{"(prepare|build|migration_preflight|candidate_health|route_switch|leader_handover|public_probe|state_write)":[0-9]+(,"(prepare|build|migration_preflight|candidate_health|route_switch|leader_handover|public_probe|state_write)":[0-9]+)*\}$'

validate_limits() {
  [[ "${MAX_ENTRIES}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 이력 최대 건수는 양의 정수여야 합니다" >&2; return 1; }
  [[ "${RETAIN_ENTRIES}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 이력 유지 건수는 양의 정수여야 합니다" >&2; return 1; }
  [[ "${DAILY_RETAIN_ENTRIES}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 일별 이력 유지 건수는 양의 정수여야 합니다" >&2; return 1; }
  (( RETAIN_ENTRIES < MAX_ENTRIES )) \
    || { echo "배포 이력 유지 건수는 최대 건수보다 작아야 합니다" >&2; return 1; }
}

compact_daily_history() {
  local output_file="$1"
  local source_file="$2"
  local archive_file="${output_file}.1"
  local daily_file="${output_file}.daily"
  local compacted_file
  local -a sources=()
  compacted_file="$(mktemp "${daily_file}.tmp.XXXXXX")"
  if [[ -f "${daily_file}" ]]; then
    sources+=("${daily_file}")
  fi
  if [[ -f "${archive_file}" ]]; then
    sources+=("${archive_file}")
  fi
  sources+=("${source_file}")
  if ! awk '
      BEGIN { marker = "\"completed_at\":\"" }
      {
        position = index($0, marker)
        if (!position) next
        day = substr($0, position + length(marker), 10)
        if (day !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/) next
        entry[day] = $0
      }
      END { for (day in entry) print day "\t" entry[day] }
    ' "${sources[@]}" \
      | LC_ALL=C sort -k1,1 \
      | tail -n "${DAILY_RETAIN_ENTRIES}" \
      | cut -f2- > "${compacted_file}"; then
    rm -f "${compacted_file}"
    return 1
  fi
  chmod 644 "${compacted_file}"
  mv "${compacted_file}" "${daily_file}"
}

rotate_history() {
  local output_file="$1"
  local line_count trimmed_file backup_file
  line_count="$(wc -l < "${output_file}")"
  if (( line_count <= MAX_ENTRIES )); then
    return
  fi

  trimmed_file="$(mktemp "${output_file}.trimmed.XXXXXX")"
  backup_file="$(mktemp "${output_file}.1.tmp.XXXXXX")"
  if ! tail -n "${RETAIN_ENTRIES}" "${output_file}" > "${trimmed_file}" \
    || ! cp "${output_file}" "${backup_file}" \
    || ! compact_daily_history "${output_file}" "${backup_file}"; then
    rm -f "${trimmed_file}" "${backup_file}"
    return 1
  fi
  chmod 644 "${trimmed_file}" "${backup_file}"
  mv "${backup_file}" "${output_file}.1"
  mv "${trimmed_file}" "${output_file}"
}

append_history() {
  local output_file="$1"
  local status="$2"
  local from_slot="$3"
  local to_slot="$4"
  local active_slot="$5"
  local deployed_version="$6"
  local deployed_revision="$7"
  local started_at="$8"
  local completed_at="$9"
  local probe_total="${10}"
  local probe_failures="${11}"
  local failure_stage="${12}"
  local failure_reason="${13}"
  local alert_request_status="${14}"
  local alert_run_url="${15}"
  local stage_durations_json="${16}"
  if [[ "${stage_durations_json}" != "{}" && ! "${stage_durations_json}" =~ ${STAGE_DURATIONS_PATTERN} ]]; then
    echo "배포 단계 시간 JSON이 올바르지 않습니다" >&2
    return 1
  fi
  printf '{"status":"%s","from_slot":"%s","to_slot":"%s","active_slot":"%s","version":"%s","revision":"%s","started_at":"%s","completed_at":"%s","probe_total":%s,"probe_failures":%s,"failure_stage":"%s","failure_reason":"%s","alert_request_status":"%s","alert_run_url":"%s","stage_durations_ms":%s}\n' \
    "${status}" "${from_slot}" "${to_slot}" "${active_slot}" \
    "${deployed_version}" "${deployed_revision}" "${started_at}" "${completed_at}" \
    "${probe_total}" "${probe_failures}" "${failure_stage}" "${failure_reason}" \
    "${alert_request_status}" "${alert_run_url}" "${stage_durations_json}" \
    >> "${output_file}"
  chmod 644 "${output_file}"
  rotate_history "${output_file}"
}

run_self_test() {
  local temporary_dir history_file revision index
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  history_file="${temporary_dir}/history.jsonl"
  revision="1111111111111111111111111111111111111111"
  for index in 9 10; do
    append_history \
      "${history_file}.1" success blue green green v1.2.2 "${revision}" \
      "2026-07-${index}T00:00:00Z" "2026-07-${index}T00:01:00Z" 10 0 "" "" not_needed "" '{}'
  done
  for index in 1 2 3 4; do
    append_history \
      "${history_file}" success blue green green v1.2.3 "${revision}" \
      "2026-07-1${index}T00:00:00Z" "2026-07-1${index}T00:01:00Z" 10 0 "" "" not_needed "" '{}'
  done
  append_history \
    "${history_file}" rollback_failed green blue unknown v1.2.4 "${revision}" \
    2026-07-16T00:05:00Z 2026-07-16T00:06:00Z 5 2 route_switch \
    "HTTP 비정상 2/5건 · 자동 rollback 미완료" requested \
    "https://github.com/hanawa07/traefik-manager/actions/runs/101" \
    '{"prepare":250,"build":750}'
  [[ "$(wc -l < "${history_file}")" == "3" ]]
  [[ "$(wc -l < "${history_file}.1")" == "4" ]]
  [[ "$(wc -l < "${history_file}.daily")" == "5" ]]
  if grep -Fq '"completed_at":"2026-07-09T00:01:00Z"' "${history_file}.daily"; then
    echo "보관 기한이 지난 일별 이력이 남아 있습니다" >&2
    return 1
  fi
  grep -Fq '"completed_at":"2026-07-10T00:01:00Z"' "${history_file}.daily"
  grep -Fq '"completed_at":"2026-07-13T00:01:00Z"' "${history_file}.daily"
  grep -Fq '"completed_at":"2026-07-14T00:01:00Z"' "${history_file}.daily"
  grep -Fq '"alert_request_status":"requested"' "${history_file}"
  grep -Fq '"alert_run_url":"https://github.com/hanawa07/traefik-manager/actions/runs/101"' "${history_file}"
  grep -Fq '"stage_durations_ms":{"prepare":250,"build":750}' "${history_file}"
  echo "Manager 배포 이력 회전 self-test 통과"
}

case "${1:-}" in
  append)
    [[ $# -eq 17 ]] || { echo "배포 이력 append 인자 수가 올바르지 않습니다" >&2; exit 2; }
    validate_limits
    append_history "${@:2}"
    ;;
  --self-test)
    TM_DEPLOY_HISTORY_MAX_ENTRIES=3 TM_DEPLOY_HISTORY_RETAIN_ENTRIES=2 \
      TM_DEPLOY_HISTORY_DAILY_RETAIN_ENTRIES=5 \
      "${BASH_SOURCE[0]}" _self-test
    ;;
  _self-test)
    validate_limits
    run_self_test
    ;;
  *)
    echo "사용법: $0 append ... | --self-test" >&2
    exit 2
    ;;
esac
