#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

state_dir="${temporary_dir}/state"
request_dir="${state_dir}/traefik-update-requests"
compose_dir="${temporary_dir}/traefik"
fake_docker="${temporary_dir}/docker"
fake_curl="${temporary_dir}/curl"
fake_alert="${temporary_dir}/host-alert"
alert_capture="${temporary_dir}/host-alert-arguments"
mkdir -p "${request_dir}" "${compose_dir}/letsencrypt"
printf '%s\n' 'traefik:v3.7.8' > "${temporary_dir}/image"
printf '%s\n' 'acme-state' > "${compose_dir}/letsencrypt/acme.json"
printf '%s\n' 'services:' '  traefik:' '    image: traefik:v3.7.8' > "${compose_dir}/docker-compose.yml"

cat > "${fake_docker}" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "inspect" ]]; then
  case "${3:-}" in
    '{{.Config.Image}}') cat "${TM_TEST_IMAGE_FILE}" ;;
    '{{.State.Running}}') printf '%s\n' 'true' ;;
    '{{json .NetworkSettings.Networks}}') printf '%s\n' '{"proxy_net":{}}' ;;
    *) awk -F: '{print $NF}' "${TM_TEST_IMAGE_FILE}" ;;
  esac
  exit 0
fi
if [[ "${1:-}" == "compose" && "${4:-}" == "config" ]]; then
  printf '%s\n' 'traefik'
  exit 0
fi
if [[ "${1:-}" == "compose" && "${4:-}" == "pull" ]]; then
  [[ "${TM_TEST_FAIL_PULL:-false}" != "true" ]] || exit 42
  exit 0
fi
if [[ "${1:-}" == "compose" && "${4:-}" == "up" ]]; then
  [[ "${TM_TEST_FAIL_UP:-false}" != "true" ]] || exit 43
  awk '/^[[:space:]]*image: traefik:v/ {print $2; exit}' "${3}" > "${TM_TEST_IMAGE_FILE}"
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
printf '%s\n' "$@" > "${TM_TEST_ALERT_CAPTURE}"
printf '%s\n' 'https://github.com/hanawa07/traefik-manager/actions/runs/123'
SCRIPT
chmod 700 "${fake_docker}" "${fake_curl}" "${fake_alert}"

write_request() {
  local request_id="$1"
  local target_version="$2"
  printf '%s\n' \
    "{\"schema_version\":1,\"operation\":\"traefik_patch_update\",\"request_id\":\"${request_id}\",\"target_version\":\"${target_version}\",\"actor\":\"self-test\",\"requested_at\":\"2026-07-20T00:00:00Z\"}" \
    > "${request_dir}/traefik-update-request.json"
}

run_runner() {
  TM_MANAGER_DEPLOY_STATE_DIR="${state_dir}" \
  TM_TRAEFIK_UPDATE_REQUEST_DIR="${request_dir}" \
  TM_TRAEFIK_UPDATE_COMPOSE_DIR="${compose_dir}" \
  TM_TRAEFIK_MANAGER_HEALTH_URL="https://manager.example.com/api/health" \
  TM_TRAEFIK_UPDATE_DOCKER_BIN="${fake_docker}" \
  TM_TRAEFIK_UPDATE_CURL_BIN="${fake_curl}" \
  TM_HOST_OPERATION_ALERT_SCRIPT="${fake_alert}" \
  TM_TEST_ALERT_CAPTURE="${alert_capture}" \
  TM_TEST_FAIL_PULL="${TM_TEST_FAIL_PULL:-false}" \
  TM_TEST_FAIL_UP="${TM_TEST_FAIL_UP:-false}" \
  TM_TEST_IMAGE_FILE="${temporary_dir}/image" \
    "${SCRIPT_DIR}/traefik-update-runner.py"
}

write_request '11111111-1111-4111-8111-111111111111' 'v3.7.9'
run_runner
grep -Fq 'image: traefik:v3.7.9' "${compose_dir}/docker-compose.yml"
grep -Fq '"status":"success"' "${state_dir}/traefik-updates.jsonl"
grep -Fq '"status":"ready"' "${state_dir}/traefik-update-runner.json"
[[ ! -e "${request_dir}/traefik-update-request.json" ]]
find "${compose_dir}/backups" -type f -name acme.json -print -quit | grep -q .

write_request '22222222-2222-4222-8222-222222222222' 'v3.8.0'
run_runner
grep -Fq '"status":"rejected"' "${state_dir}/traefik-updates.jsonl"
grep -Fq 'image: traefik:v3.7.9' "${compose_dir}/docker-compose.yml"

write_request '33333333-3333-4333-8333-333333333333' 'v3.7.10'
if TM_TEST_FAIL_PULL=true TM_TEST_FAIL_UP=true run_runner; then
  echo "자동 롤백 실패가 성공으로 종료되었습니다" >&2
  exit 1
fi
tail -n 1 "${state_dir}/traefik-updates.jsonl" | grep -Fq '"status":"rollback_failed"'
grep -Fq 'image: traefik:v3.7.9' "${compose_dir}/docker-compose.yml"
grep -Fxq 'Traefik 패치 업데이트 자동 롤백' "${alert_capture}"
grep -Fxq 'v3.7.10 업데이트와 자동 롤백 실패 · 요청 33333333-3333-4333-8333-333333333333' "${alert_capture}"
grep -Fxq 'failure' "${alert_capture}"
grep -Fq '호스트 운영 알림 요청 완료' "${state_dir}/traefik-update-runner.json"
[[ ! -e "${request_dir}/traefik-update-request.json" ]]
echo "Traefik 안전 업데이트 실행기 self-test 통과"
