#!/usr/bin/env bash
set -euo pipefail

readonly CURL_BIN="${TM_DEPLOY_PROBE_CURL_BIN:-curl}"
readonly DEFAULT_INTERVAL_SECONDS="${TM_DEPLOY_PROBE_INTERVAL_SECONDS:-0.2}"
readonly DEFAULT_TIMEOUT_SECONDS="${TM_DEPLOY_PROBE_TIMEOUT_SECONDS:-3}"

run_probe() {
  local url="$1"
  local output_file="$2"
  local stop_file="$3"
  local interval_seconds="${4:-${DEFAULT_INTERVAL_SECONDS}}"
  local timeout_seconds="${5:-${DEFAULT_TIMEOUT_SECONDS}}"
  local result status duration

  : > "${output_file}"
  while [[ ! -e "${stop_file}" ]]; do
    result="$(
      "${CURL_BIN}" --silent --show-error --output /dev/null \
        --max-time "${timeout_seconds}" \
        --write-out '%{http_code} %{time_total}' \
        "${url}" 2>/dev/null
    )" || result="000 0"
    read -r status duration <<< "${result}"
    printf '%s %s %s\n' "$(date +%s.%3N)" "${status:-000}" "${duration:-0}" \
      >> "${output_file}"
    sleep "${interval_seconds}"
  done
}

summarize_probe() {
  local output_file="$1"
  if [[ ! -f "${output_file}" ]]; then
    printf '0 0\n'
    return
  fi
  awk '{ total += 1; if ($2 != "200") failures += 1 } END { print total + 0, failures + 0 }' \
    "${output_file}"
}

assert_probe() {
  local output_file="$1"
  local minimum_samples="${2:-5}"
  local total failures codes
  read -r total failures <<< "$(summarize_probe "${output_file}")"
  if (( total < minimum_samples )); then
    echo "배포 probe 표본이 부족합니다: ${total}/${minimum_samples}" >&2
    return 1
  fi
  if (( failures > 0 )); then
    codes="$(awk '$2 != "200" { counts[$2] += 1 } END { separator = ""; for (code in counts) { printf "%s%s=%s", separator, code, counts[code]; separator = " " }; print "" }' "${output_file}")"
    echo "배포 probe 실패: total=${total}, non_200=${failures}, ${codes}" >&2
    return 1
  fi
  echo "배포 probe 통과: ${total}건 모두 HTTP 200"
}

run_self_test() {
  local temporary_dir success_file failure_file
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  success_file="${temporary_dir}/success.log"
  failure_file="${temporary_dir}/failure.log"
  printf '1.000 200 0.01\n1.200 200 0.01\n1.400 200 0.01\n' > "${success_file}"
  printf '1.000 200 0.01\n1.200 503 0.01\n1.400 200 0.01\n' > "${failure_file}"
  [[ "$(summarize_probe "${failure_file}")" == "3 1" ]]
  assert_probe "${success_file}" 3 >/dev/null
  if assert_probe "${failure_file}" 3 >/dev/null 2>&1; then
    echo "배포 probe self-test가 503을 감지하지 못했습니다" >&2
    return 1
  fi
  echo "Manager 0.2초 배포 probe self-test 통과"
}

case "${1:-}" in
  run)
    [[ $# -ge 4 ]] || { echo "사용법: $0 run URL OUTPUT_FILE STOP_FILE [INTERVAL] [TIMEOUT]" >&2; exit 2; }
    run_probe "$2" "$3" "$4" "${5:-}" "${6:-}"
    ;;
  assert)
    [[ $# -ge 2 ]] || { echo "사용법: $0 assert OUTPUT_FILE [MINIMUM_SAMPLES]" >&2; exit 2; }
    assert_probe "$2" "${3:-5}"
    ;;
  summary)
    [[ $# -eq 2 ]] || { echo "사용법: $0 summary OUTPUT_FILE" >&2; exit 2; }
    summarize_probe "$2"
    ;;
  --self-test)
    run_self_test
    ;;
  *)
    echo "사용법: $0 run|assert|summary|--self-test" >&2
    exit 2
    ;;
esac
