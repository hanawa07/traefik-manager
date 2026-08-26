#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

state_dir="${temporary_dir}/state"
request_dir="${state_dir}/traefik-update-requests"
compose_dir="${temporary_dir}/traefik"
compose_base_filename="compose.yml"
compose_overlay_filename="compose.prod.yml"
compose_filenames="${compose_base_filename},${compose_overlay_filename}"
acme_filename="certificates/acme-prod.json"
compose_service="edge-proxy"
traefik_container="edge-traefik"
traefik_network="edge_net"
fake_docker="${temporary_dir}/docker"
fake_curl="${temporary_dir}/curl"
fake_alert="${temporary_dir}/host-alert"
alert_capture="${temporary_dir}/host-alert-arguments"
alert_call_log="${temporary_dir}/host-alert-calls"
docker_log="${temporary_dir}/docker.log"
container_id_file="${temporary_dir}/container-id"
container_id_counter="${temporary_dir}/container-id-counter"
mkdir -p "${request_dir}" "${compose_dir}/certificates"
: > "${alert_call_log}"
printf '%s\n' 'traefik:v3.7.8' > "${temporary_dir}/image"
printf '%064x\n' 1 > "${container_id_file}"
printf '%s\n' 1 > "${container_id_counter}"
printf '%s\n' 'acme-state' > "${compose_dir}/${acme_filename}"
printf '%s\n' 'services:' "  ${compose_service}:" '    command: --api.insecure=true' \
  > "${compose_dir}/${compose_base_filename}"
printf '%s\n' 'services:' "  ${compose_service}:" '    image: traefik:v3.7.8' \
  > "${compose_dir}/${compose_overlay_filename}"

cat > "${fake_docker}" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "inspect" ]]; then
  printf 'inspect|%s|%s\n' "${3:-}" "${4:-}" >> "${TM_TEST_DOCKER_LOG}"
  [[ "${4:-}" == "${TM_TEST_CONTAINER}" ]] || exit 45
  case "${3:-}" in
    '{{.Config.Image}}') cat "${TM_TEST_IMAGE_FILE}" ;;
    '{{.Id}}') cat "${TM_TEST_CONTAINER_ID_FILE}" ;;
    '{{.Id}}|{{.Created}}|{{.Config.Image}}')
      printf '%s|2026-08-25T00:00:00Z|%s\n' \
        "$(cat "${TM_TEST_CONTAINER_ID_FILE}")" \
        "$(cat "${TM_TEST_IMAGE_FILE}")"
      ;;
    '{{.State.Running}}') printf '%s\n' 'true' ;;
    '{{json .NetworkSettings.Networks}}') printf '{"%s":{}}\n' "${TM_TEST_NETWORK}" ;;
    *) awk -F: '{print $NF}' "${TM_TEST_IMAGE_FILE}" ;;
  esac
  exit 0
fi
if [[ "${1:-}" == "compose" ]]; then
  shift
  compose_files=()
  while [[ "${1:-}" == "-f" ]]; do
    compose_files+=("${2}")
    shift 2
  done
  action="${1:-}"
  shift
  printf '%s|%s|%s\n' "${action}" "${compose_files[*]}" "$*" >> "${TM_TEST_DOCKER_LOG}"
  case "${action}" in
    config)
      printf '%s\n' "${TM_TEST_SERVICE}"
      ;;
    pull)
      if [[ "${TM_TEST_MUTATE_BASE_ON_PULL:-false}" == "true" ]]; then
        printf '%s\n' '# mutated-by-pull' >> "${compose_files[0]}"
      fi
      [[ "${TM_TEST_FAIL_PULL:-false}" != "true" ]] || exit 42
      ;;
    up)
      [[ "${TM_TEST_FAIL_UP:-false}" != "true" ]] || exit 43
      for compose_file in "${compose_files[@]}"; do
        image="$(awk '/^[[:space:]]*image: traefik:v/ {print $2; exit}' "${compose_file}")"
        if [[ -n "${image}" ]]; then
          printf '%s\n' "${image}" > "${TM_TEST_IMAGE_FILE}"
          next_id="$(( $(cat "${TM_TEST_CONTAINER_ID_COUNTER}") + 1 ))"
          printf '%s\n' "${next_id}" > "${TM_TEST_CONTAINER_ID_COUNTER}"
          printf '%064x\n' "${next_id}" > "${TM_TEST_CONTAINER_ID_FILE}"
          exit 0
        fi
      done
      echo "compose image not found" >&2
      exit 1
      ;;
    *)
      echo "unexpected compose action: ${action}" >&2
      exit 1
      ;;
  esac
  exit 0
fi
echo "unexpected docker arguments: $*" >&2
exit 1
SCRIPT
cat > "${fake_curl}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' '{"status":"정상"}'
SCRIPT
cat > "${fake_alert}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' 'called' >> "${TM_TEST_ALERT_CALL_LOG}"
[[ "${TM_TEST_FAIL_ALERT:-false}" != "true" ]] || exit 44
printf '%s\n' "$@" > "${TM_TEST_ALERT_CAPTURE}"
printf '%s\n' 'anubis'
SCRIPT
chmod 700 "${fake_docker}" "${fake_curl}" "${fake_alert}"

write_request() {
  local request_id="$1"
  local target_version="$2"
  printf '%s\n' \
    "{\"schema_version\":1,\"operation\":\"traefik_patch_update\",\"request_id\":\"${request_id}\",\"target_version\":\"${target_version}\",\"actor\":\"self-test\",\"requested_at\":\"2026-07-20T00:00:00Z\"}" \
    > "${request_dir}/traefik-update-request.json"
}

write_alert_retry_request() {
  local request_id="$1"
  local source_request_id="$2"
  local target_version="$3"
  printf '%s\n' \
    "{\"schema_version\":1,\"operation\":\"traefik_rollback_alert_retry\",\"request_id\":\"${request_id}\",\"source_request_id\":\"${source_request_id}\",\"target_version\":\"${target_version}\",\"actor\":\"self-test\",\"requested_at\":\"2026-07-20T00:00:00Z\"}" \
    > "${request_dir}/traefik-update-request.json"
}

run_runner() {
  local mode="${1:-multiple}"
  local -a compose_environment
  if [[ "${mode}" == "legacy" ]]; then
    compose_environment=("TM_TRAEFIK_UPDATE_COMPOSE_FILE=${compose_overlay_filename}")
  else
    compose_environment=("TM_TRAEFIK_UPDATE_COMPOSE_FILES=${compose_filenames}")
  fi
  env -u TM_TRAEFIK_UPDATE_COMPOSE_FILES -u TM_TRAEFIK_UPDATE_COMPOSE_FILE \
    TM_MANAGER_DEPLOY_STATE_DIR="${state_dir}" \
    TM_TRAEFIK_UPDATE_REQUEST_DIR="${request_dir}" \
    TM_TRAEFIK_UPDATE_COMPOSE_DIR="${compose_dir}" \
    TM_TRAEFIK_UPDATE_ACME_FILE="${acme_filename}" \
    TM_TRAEFIK_UPDATE_SERVICE="${compose_service}" \
    TM_TRAEFIK_UPDATE_CONTAINER="${traefik_container}" \
    TM_TRAEFIK_UPDATE_NETWORK="${traefik_network}" \
    TM_TRAEFIK_RECREATE_GUARD_SECONDS=0 \
    TM_TRAEFIK_MANAGER_HEALTH_URL="https://manager.example.com/api/health" \
    TM_TRAEFIK_UPDATE_DOCKER_BIN="${fake_docker}" \
    TM_TRAEFIK_UPDATE_CURL_BIN="${fake_curl}" \
    TM_HOST_OPERATION_ALERT_SCRIPT="${fake_alert}" \
    TM_TEST_ALERT_CAPTURE="${alert_capture}" \
    TM_TEST_ALERT_CALL_LOG="${alert_call_log}" \
    TM_TEST_FAIL_PULL="${TM_TEST_FAIL_PULL:-false}" \
    TM_TEST_FAIL_UP="${TM_TEST_FAIL_UP:-false}" \
    TM_TEST_FAIL_ALERT="${TM_TEST_FAIL_ALERT:-false}" \
    TM_TEST_MUTATE_BASE_ON_PULL="${TM_TEST_MUTATE_BASE_ON_PULL:-false}" \
    TM_TEST_IMAGE_FILE="${temporary_dir}/image" \
    TM_TEST_CONTAINER_ID_FILE="${container_id_file}" \
    TM_TEST_CONTAINER_ID_COUNTER="${container_id_counter}" \
    TM_TEST_DOCKER_LOG="${docker_log}" \
    TM_TEST_SERVICE="${compose_service}" \
    TM_TEST_CONTAINER="${traefik_container}" \
    TM_TEST_NETWORK="${traefik_network}" \
    "${compose_environment[@]}" \
    "${SCRIPT_DIR}/traefik-update-runner.py"
}

run_safe_recreate() {
  TM_MANAGER_DEPLOY_STATE_DIR="${state_dir}" \
  TM_TRAEFIK_UPDATE_COMPOSE_DIR="${compose_dir}" \
  TM_TRAEFIK_UPDATE_COMPOSE_FILES="${compose_filenames}" \
  TM_TRAEFIK_UPDATE_SERVICE="${compose_service}" \
  TM_TRAEFIK_UPDATE_CONTAINER="${traefik_container}" \
  TM_TRAEFIK_UPDATE_DOCKER_BIN="${fake_docker}" \
  TM_TRAEFIK_RECREATE_GUARD_SECONDS=0 \
  TM_TEST_IMAGE_FILE="${temporary_dir}/image" \
  TM_TEST_CONTAINER_ID_FILE="${container_id_file}" \
  TM_TEST_CONTAINER_ID_COUNTER="${container_id_counter}" \
  TM_TEST_DOCKER_LOG="${docker_log}" \
  TM_TEST_SERVICE="${compose_service}" \
  TM_TEST_CONTAINER="${traefik_container}" \
  TM_TEST_NETWORK="${traefik_network}" \
    "${SCRIPT_DIR}/run-traefik-recreate-safely.sh" "$@"
}

for history_index in $(seq 1 205); do
  printf '{"fixture":%s}\n' "${history_index}" >> "${state_dir}/traefik-updates.jsonl"
done
write_request '11111111-1111-4111-8111-111111111111' 'v3.7.9'
run_runner
grep -Fq 'command: --api.insecure=true' "${compose_dir}/${compose_base_filename}"
grep -Fq 'image: traefik:v3.7.9' "${compose_dir}/${compose_overlay_filename}"
grep -Fq '"status":"success"' "${state_dir}/traefik-updates.jsonl"
grep -Fq '"status":"managed"' "${state_dir}/traefik-recreations.jsonl"
grep -Fq '"source":"patch_update"' "${state_dir}/traefik-recreations.jsonl"
grep -Fq '"status":"ready"' "${state_dir}/traefik-update-runner.json"
[[ ! -e "${request_dir}/traefik-update-request.json" ]]
find "${compose_dir}/backups" -type f -name acme.json -print -quit | grep -q .
find "${compose_dir}/backups" -type f -path "*/compose/${compose_base_filename}" -print -quit | grep -q .
find "${compose_dir}/backups" -type f -path "*/compose/${compose_overlay_filename}" -print -quit | grep -q .
grep -Fq "config|${compose_dir}/${compose_base_filename} ${compose_dir}/${compose_overlay_filename}|--services" "${docker_log}"
grep -Fq "pull|${compose_dir}/${compose_base_filename} ${compose_dir}/${compose_overlay_filename}|${compose_service}" "${docker_log}"
grep -Fq "up|${compose_dir}/${compose_base_filename} ${compose_dir}/${compose_overlay_filename}|-d ${compose_service}" "${docker_log}"
grep -Fq "inspect|{{.Config.Image}}|${traefik_container}" "${docker_log}"
grep -Fq "inspect|{{json .NetworkSettings.Networks}}|${traefik_container}" "${docker_log}"
[[ "$(wc -l < "${state_dir}/traefik-updates.jsonl")" -eq 200 ]]

write_request '22222222-2222-4222-8222-222222222222' 'v3.8.0'
run_runner
grep -Fq '"status":"rejected"' "${state_dir}/traefik-updates.jsonl"
grep -Fq 'image: traefik:v3.7.9' "${compose_dir}/${compose_overlay_filename}"

printf '%s\n' 'services:' "  ${compose_service}:" '    image: traefik:v3.7.9' \
  > "${compose_dir}/${compose_base_filename}"
write_request '22222222-2222-4222-8222-222222222223' 'v3.7.10'
run_runner
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"status":"rejected"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '정확히 한 곳에서 찾지 못했습니다'
printf '%s\n' 'services:' "  ${compose_service}:" '    command: --api.insecure=true' \
  > "${compose_dir}/${compose_base_filename}"

write_request '33333333-3333-4333-8333-333333333333' 'v3.7.10'
if TM_TEST_FAIL_PULL=true TM_TEST_FAIL_UP=true TM_TEST_MUTATE_BASE_ON_PULL=true run_runner; then
  echo "자동 롤백 실패가 성공으로 종료되었습니다" >&2
  exit 1
fi
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"status":"rollback_failed"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_request_status":"requested"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_channel":"anubis"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_run_url":null'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_retry_request_id":null'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_retry_actor":null'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_retry_requested_at":null'
grep -Fq 'command: --api.insecure=true' "${compose_dir}/${compose_base_filename}"
if grep -Fq 'mutated-by-pull' "${compose_dir}/${compose_base_filename}"; then
  echo "롤백 후 base Compose 파일에 테스트 변조가 남았습니다" >&2
  exit 1
fi
grep -Fq 'image: traefik:v3.7.9' "${compose_dir}/${compose_overlay_filename}"
grep -Fxq 'Traefik 패치 업데이트 자동 롤백' "${alert_capture}"
grep -Fxq 'v3.7.10 업데이트와 자동 롤백 실패 · 요청 33333333-3333-4333-8333-333333333333' "${alert_capture}"
grep -Fxq 'failure' "${alert_capture}"
grep -Fq '호스트 운영 알림 요청 완료' "${state_dir}/traefik-update-runner.json"
[[ ! -e "${request_dir}/traefik-update-request.json" ]]

write_request '44444444-4444-4444-8444-444444444444' 'v3.7.10'
if TM_TEST_FAIL_PULL=true TM_TEST_FAIL_UP=true TM_TEST_FAIL_ALERT=true run_runner; then
  echo "알림 요청 실패가 성공으로 종료되었습니다" >&2
  exit 1
fi
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_request_status":"request_failed"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_channel":null'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_run_url":null'

write_alert_retry_request \
  '55555555-5555-4555-8555-555555555554' \
  '44444444-4444-4444-8444-444444444444' \
  'v3.7.11'
if run_runner; then
  echo "원본과 다른 버전의 알림 재시도가 성공으로 종료되었습니다" >&2
  exit 1
fi
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_request_status":"request_failed"'

write_alert_retry_request \
  '55555555-5555-4555-8555-555555555555' \
  '44444444-4444-4444-8444-444444444444' \
  'v3.7.10'
run_runner
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_request_status":"requested"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_channel":"anubis"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_run_url":null'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_retry_request_id":"55555555-5555-4555-8555-555555555555"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_retry_actor":"self-test"'
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"alert_retry_requested_at":"2026-07-20T00:00:00Z"'
grep -Fxq 'v3.7.10 업데이트와 자동 롤백 실패 · 요청 44444444-4444-4444-8444-444444444444' "${alert_capture}"
grep -Fq '롤백 실패 알림 재시도 완료' "${state_dir}/traefik-update-runner.json"

write_request '66666666-6666-4666-8666-666666666666' 'v3.7.9'
run_runner legacy
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"status":"success"'
grep -Fq '대상 버전이 이미 적용되어' "${state_dir}/traefik-updates.jsonl"

run_safe_recreate
grep -Fq "up|${compose_dir}/${compose_base_filename} ${compose_dir}/${compose_overlay_filename}|-d ${compose_service}" \
  "${docker_log}"
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"source":"manual_safe"'

run_safe_recreate --force-recreate
grep -Fq "up|${compose_dir}/${compose_base_filename} ${compose_dir}/${compose_overlay_filename}|-d --force-recreate ${compose_service}" \
  "${docker_log}"
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"source":"manual_safe"'

docker_calls_before="$(wc -l < "${docker_log}")"
if run_safe_recreate --unknown; then
  echo "지원하지 않는 안전 재생성 인자가 허용되었습니다" >&2
  exit 1
fi
[[ "$(wc -l < "${docker_log}")" -eq "${docker_calls_before}" ]]

alert_calls_before="$(wc -l < "${alert_call_log}")"
printf '%s\n' 'abcdef012345abcdef012345abcdef012345abcdef012345abcdef012345abcd' \
  > "${container_id_file}"
if run_runner; then
  echo "안전 경로 밖의 Traefik 재생성이 정상으로 처리되었습니다" >&2
  exit 1
fi
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"status":"unmanaged"'
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"source":"direct_or_unknown"'
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"alert_request_status":"requested"'
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"alert_channel":"anubis"'
grep -Fxq 'Traefik 비관리 재생성' "${alert_capture}"
grep -Fxq '컨테이너 ID abcdef012345' "${alert_capture}"
grep -Fxq 'failure' "${alert_capture}"
[[ "$(wc -l < "${alert_call_log}")" -eq "$((alert_calls_before + 1))" ]]
grep -Fq '안전 경로 밖에서 Traefik 컨테이너가 재생성되었습니다' \
  "${state_dir}/traefik-update-runner.json"
grep -Fq 'Anubis 알림 전송 완료' "${state_dir}/traefik-update-runner.json"
run_runner
grep -Fq '"status":"ready"' "${state_dir}/traefik-update-runner.json"
[[ "$(wc -l < "${alert_call_log}")" -eq "$((alert_calls_before + 1))" ]]

printf '%s\n' 'fedcba987654fedcba987654fedcba987654fedcba987654fedcba987654fedc' \
  > "${container_id_file}"
if TM_TEST_FAIL_ALERT=true run_runner; then
  echo "실패한 비관리 재생성 알림이 정상으로 처리되었습니다" >&2
  exit 1
fi
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"alert_request_status":"request_failed"'
tail -n 1 "${state_dir}/traefik-recreations.jsonl" | grep -Fq '"alert_channel":null'
grep -Fq 'Anubis 알림 전송 실패' "${state_dir}/traefik-update-runner.json"
[[ "$(wc -l < "${alert_call_log}")" -eq "$((alert_calls_before + 2))" ]]
run_runner
[[ "$(wc -l < "${alert_call_log}")" -eq "$((alert_calls_before + 2))" ]]
echo "Traefik 안전 업데이트 실행기 self-test 통과"
