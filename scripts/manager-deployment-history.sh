#!/usr/bin/env bash
set -euo pipefail

readonly MAX_ENTRIES="${TM_DEPLOY_HISTORY_MAX_ENTRIES:-200}"
readonly RETAIN_ENTRIES="${TM_DEPLOY_HISTORY_RETAIN_ENTRIES:-100}"

validate_limits() {
  [[ "${MAX_ENTRIES}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 이력 최대 건수는 양의 정수여야 합니다" >&2; return 1; }
  [[ "${RETAIN_ENTRIES}" =~ ^[1-9][0-9]*$ ]] \
    || { echo "배포 이력 유지 건수는 양의 정수여야 합니다" >&2; return 1; }
  (( RETAIN_ENTRIES < MAX_ENTRIES )) \
    || { echo "배포 이력 유지 건수는 최대 건수보다 작아야 합니다" >&2; return 1; }
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
    || ! cp "${output_file}" "${backup_file}"; then
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
  printf '{"status":"%s","from_slot":"%s","to_slot":"%s","active_slot":"%s","version":"%s","revision":"%s","started_at":"%s","completed_at":"%s","probe_total":%s,"probe_failures":%s}\n' \
    "${status}" "${from_slot}" "${to_slot}" "${active_slot}" \
    "${deployed_version}" "${deployed_revision}" "${started_at}" "${completed_at}" \
    "${probe_total}" "${probe_failures}" >> "${output_file}"
  chmod 644 "${output_file}"
  rotate_history "${output_file}"
}

run_self_test() {
  local temporary_dir history_file revision index
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  history_file="${temporary_dir}/history.jsonl"
  revision="1111111111111111111111111111111111111111"
  for index in 1 2 3 4; do
    append_history \
      "${history_file}" success blue green green v1.2.3 "${revision}" \
      2026-07-16T00:00:00Z "2026-07-16T00:0${index}:00Z" 10 0
  done
  [[ "$(wc -l < "${history_file}")" == "2" ]]
  [[ "$(wc -l < "${history_file}.1")" == "4" ]]
  grep -Fq '2026-07-16T00:04:00Z' "${history_file}"
  echo "Manager 배포 이력 회전 self-test 통과"
}

case "${1:-}" in
  append)
    [[ $# -eq 12 ]] || { echo "배포 이력 append 인자 수가 올바르지 않습니다" >&2; exit 2; }
    validate_limits
    append_history "${@:2}"
    ;;
  --self-test)
    TM_DEPLOY_HISTORY_MAX_ENTRIES=3 TM_DEPLOY_HISTORY_RETAIN_ENTRIES=2 \
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
