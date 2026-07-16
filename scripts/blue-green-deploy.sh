#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ROUTE_FILE="${REPO_ROOT}/traefik-config/dynamic/traefik-manager-self.yml"
readonly STATE_DIR="${TM_MANAGER_DEPLOY_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/traefik-manager}"
readonly STATE_FILE="${STATE_DIR}/blue-green-deployment.state"
readonly LOCK_FILE="${STATE_DIR}/blue-green-deployment.lock"
readonly HISTORY_FILE="${STATE_DIR}/blue-green-deployments.jsonl"
readonly HISTORY_SCRIPT="${SCRIPT_DIR}/manager-deployment-history.sh"
readonly PROBE_SCRIPT="${SCRIPT_DIR}/manager-deployment-probe.sh"
readonly HOST_ALERT_SCRIPT="${TM_HOST_OPERATION_ALERT_SCRIPT:-${SCRIPT_DIR}/request-host-operation-alert.sh}"
readonly PROBE_INTERVAL_SECONDS="${TM_DEPLOY_PROBE_INTERVAL_SECONDS:-0.2}"
readonly HEALTH_TIMEOUT_SECONDS="${TM_BLUE_GREEN_HEALTH_TIMEOUT_SECONDS:-180}"
readonly DRAIN_SECONDS="${TM_BLUE_GREEN_DRAIN_SECONDS:-2}"
readonly HISTORY_MAX_ENTRIES="${TM_DEPLOY_HISTORY_MAX_ENTRIES:-200}"
readonly HISTORY_RETAIN_ENTRIES="${TM_DEPLOY_HISTORY_RETAIN_ENTRIES:-100}"

probe_pid=""
probe_file=""
probe_stop_file=""
state_backup_file=""
state_existed=0
switched=0
candidate_started=0
history_record_enabled=0
history_recorded=0
deployment_started_at=""
deployment_stage="prepare"
alert_request_status="not_needed"
alert_run_url=""
previous_slot=""
candidate_slot=""
revision=""

read_env_value() {
  local key="$1"
  local raw
  raw="$(grep -E "^${key}=" "${REPO_ROOT}/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  raw="${raw%$'\r'}"
  raw="${raw#\"}"
  raw="${raw%\"}"
  raw="${raw#\'}"
  raw="${raw%\'}"
  printf '%s\n' "${raw}"
}

resolve_health_url() {
  local base_url="${TM_BLUE_GREEN_BASE_URL:-}"
  if [[ -z "${base_url}" ]]; then
    base_url="$(read_env_value FRONTEND_DOMAIN)"
  fi
  if [[ -z "${base_url}" ]]; then
    echo "TM_BLUE_GREEN_BASE_URL 또는 .env의 FRONTEND_DOMAIN이 필요합니다" >&2
    return 1
  fi
  if [[ "${base_url}" != http://* && "${base_url}" != https://* ]]; then
    base_url="https://${base_url}"
  fi
  printf '%s/api/health\n' "${base_url%/}"
}

infer_active_slot() {
  local route_file="$1"
  if [[ ! -f "${route_file}" ]]; then
    printf 'unknown\n'
  elif grep -Fq 'url: "http://traefik-manager-frontend-blue:3000"' "${route_file}"; then
    printf 'blue\n'
  elif grep -Fq 'url: "http://traefik-manager-frontend-green:3000"' "${route_file}"; then
    printf 'green\n'
  elif grep -Fq 'url: "http://traefik-manager-frontend:3000"' "${route_file}"; then
    printf 'single\n'
  else
    printf 'unknown\n'
  fi
}

opposite_slot() {
  case "$1" in
    blue) printf 'green\n' ;;
    green|single) printf 'blue\n' ;;
    *) return 1 ;;
  esac
}

upstream_for_slot() {
  case "$1" in
    single) printf 'http://traefik-manager-frontend:3000\n' ;;
    blue|green) printf 'http://traefik-manager-frontend-%s:3000\n' "$1" ;;
    *) return 1 ;;
  esac
}

backend_for_slot() {
  case "$1" in
    single) printf 'traefik-manager-backend\n' ;;
    blue|green) printf 'traefik-manager-backend-%s\n' "$1" ;;
    *) return 1 ;;
  esac
}

frontend_for_slot() {
  case "$1" in
    single) printf 'traefik-manager-frontend\n' ;;
    blue|green) printf 'traefik-manager-frontend-%s\n' "$1" ;;
    *) return 1 ;;
  esac
}

compose() {
  docker compose --project-directory "${REPO_ROOT}" --profile blue-green "$@"
}

wait_container_healthy() {
  local container_name="$1"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local status
  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_name}" 2>/dev/null || true)"
    if [[ "${status}" == "healthy" ]]; then
      return 0
    fi
    if [[ "${status}" == "exited" || "${status}" == "dead" ]]; then
      echo "컨테이너가 준비 전에 종료됐습니다: ${container_name}" >&2
      docker logs --tail 50 "${container_name}" >&2 || true
      return 1
    fi
    sleep 1
  done
  echo "컨테이너 health 대기 시간 초과: ${container_name}" >&2
  docker logs --tail 50 "${container_name}" >&2 || true
  return 1
}

ensure_docker_proxy() {
  compose up -d dockerproxy
  wait_container_healthy traefik-manager-dockerproxy
}

run_migration_preflight() {
  local slot="$1"
  compose run --rm --no-deps --entrypoint python "backend-${slot}" \
    -m app.infrastructure.persistence.blue_green_preflight
}

verify_candidate_chain() {
  local frontend_container="$1"
  docker exec "${frontend_container}" node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(v=>{if(v.status!=='정상')process.exit(1)}).catch(()=>process.exit(1))"
}

attach_candidate_backend() {
  local backend_container="$1"
  docker network connect \
    --alias traefik-manager-backend \
    --alias "${backend_container}" \
    proxy_net "${backend_container}"
  wait_container_healthy "${backend_container}"
}

render_route() {
  local upstream="$1"
  TRAEFIK_MANAGER_FRONTEND_UPSTREAM="${upstream}" \
    compose run --rm --no-deps \
      -e TRAEFIK_MANAGER_FRONTEND_UPSTREAM \
      init-traefik-config >/dev/null
}

wait_traefik_route() {
  local backend_container="$1"
  local expected_upstream="$2"
  local deadline=$((SECONDS + 30))
  while (( SECONDS < deadline )); do
    if docker exec "${backend_container}" python -c \
      'import json,os,sys,urllib.request; base=os.environ["TRAEFIK_API_URL"].rstrip("/"); services=json.load(urllib.request.urlopen(base+"/api/http/services",timeout=3)); item=next((x for x in services if x.get("name")=="traefik-manager-frontend-file@file"),{}); expected=sys.argv[1]; ok=item.get("status")=="enabled" and item.get("serverStatus",{}).get(expected)=="UP"; raise SystemExit(0 if ok else 1)' \
      "${expected_upstream}" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done
  echo "Traefik이 새 Manager upstream을 UP으로 반영하지 못했습니다: ${expected_upstream}" >&2
  return 1
}

wait_background_leader() {
  local backend_container="$1"
  local slot="$2"
  local deadline=$((SECONDS + 30))
  while (( SECONDS < deadline )); do
    if docker logs "${backend_container}" 2>&1 | grep -Fq "background task leader 활성화: slot=${slot}"; then
      return 0
    fi
    sleep 1
  done
  echo "새 backend가 background leader를 승계하지 못했습니다: ${slot}" >&2
  return 1
}

start_candidate() {
  local slot="$1"
  local backend_service="backend-${slot}"
  local frontend_service="frontend-${slot}"
  local backend_container frontend_container
  backend_container="$(backend_for_slot "${slot}")"
  frontend_container="$(frontend_for_slot "${slot}")"

  candidate_started=1
  compose up -d --no-deps --force-recreate "${backend_service}"
  wait_container_healthy "${backend_container}"
  compose up -d --no-deps --force-recreate "${frontend_service}"
  wait_container_healthy "${frontend_container}"
  for _ in 1 2 3; do
    verify_candidate_chain "${frontend_container}"
    sleep 0.2
  done
  attach_candidate_backend "${backend_container}"
  for _ in 1 2 3; do
    verify_candidate_chain "${frontend_container}"
    sleep 0.2
  done
}

stop_slot() {
  local slot="$1"
  docker stop --time 15 "$(backend_for_slot "${slot}")" >/dev/null 2>&1 || true
  docker stop --time 15 "$(frontend_for_slot "${slot}")" >/dev/null 2>&1 || true
}

start_existing_slot() {
  local slot="$1"
  local backend_container frontend_container
  backend_container="$(backend_for_slot "${slot}")"
  frontend_container="$(frontend_for_slot "${slot}")"
  docker start "${backend_container}" >/dev/null || return 1
  wait_container_healthy "${backend_container}" || return 1
  docker start "${frontend_container}" >/dev/null || return 1
  wait_container_healthy "${frontend_container}" || return 1
}

write_state() {
  local slot="$1"
  local revision="$2"
  local version="$3"
  local temporary_file
  temporary_file="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  printf 'slot=%s\nrevision=%s\nversion=%s\nupdated_at=%s\n' \
    "${slot}" "${revision}" "${version}" "$(date --iso-8601=seconds)" \
    > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv "${temporary_file}" "${STATE_FILE}"
}

record_deployment_history() {
  local status="$1"
  local active_slot="$2"
  local exit_code="${3:-0}"
  local probe_total=0
  local probe_failures=0
  local failure_stage=""
  local failure_reason=""
  if (( history_record_enabled == 0 || history_recorded == 1 )); then
    return
  fi
  if [[ -n "${probe_file}" && -f "${probe_file}" ]]; then
    read -r probe_total probe_failures <<< "$("${PROBE_SCRIPT}" summary "${probe_file}")"
  fi
  if [[ "${status}" != "success" ]]; then
    failure_stage="${deployment_stage}"
    if (( probe_failures > 0 )); then
      failure_reason="HTTP 비정상 ${probe_failures}/${probe_total}건"
    else
      failure_reason="명령 종료 코드 ${exit_code}"
    fi
    case "${status}" in
      failed_before_switch) failure_reason+=" · 후보 전환 전 중단" ;;
      rolled_back) failure_reason+=" · 자동 rollback 완료" ;;
      rollback_failed) failure_reason+=" · 자동 rollback 미완료" ;;
    esac
  fi
  if ! TM_DEPLOY_HISTORY_MAX_ENTRIES="${HISTORY_MAX_ENTRIES}" \
    TM_DEPLOY_HISTORY_RETAIN_ENTRIES="${HISTORY_RETAIN_ENTRIES}" \
    "${HISTORY_SCRIPT}" append \
    "${HISTORY_FILE}" "${status}" "${previous_slot}" "${candidate_slot}" "${active_slot}" \
    "${version}" "${revision}" "${deployment_started_at}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "${probe_total}" "${probe_failures}" "${failure_stage}" "${failure_reason}" \
    "${alert_request_status}" "${alert_run_url}"; then
    echo "배포 이력을 기록하지 못했습니다: ${HISTORY_FILE}" >&2
  fi
  history_recorded=1
}

notify_rollback_failure() {
  local active_slot="$1"
  "${HOST_ALERT_SCRIPT}" \
    "Manager blue-green rollback" \
    "자동 rollback 실패: previous=${previous_slot}, candidate=${candidate_slot}, active=${active_slot}, version=${version}, revision=${revision}" \
    failure
}

snapshot_state() {
  if [[ ! -f "${STATE_FILE}" ]]; then
    return
  fi
  state_backup_file="$(mktemp "${STATE_FILE}.backup.XXXXXX")"
  cp --preserve=mode,timestamps "${STATE_FILE}" "${state_backup_file}"
  state_existed=1
}

restore_state() {
  if (( state_existed == 1 )); then
    if ! mv "${state_backup_file}" "${STATE_FILE}"; then
      echo "배포 상태 백업을 복원하지 못했습니다: ${state_backup_file}" >&2
      return 1
    fi
    state_backup_file=""
  else
    rm -f "${STATE_FILE}"
  fi
}

start_probe() {
  probe_file="$(mktemp "${STATE_DIR}/deployment-probe.XXXXXX")"
  probe_stop_file="${probe_file}.stop"
  "${PROBE_SCRIPT}" run "${health_url}" "${probe_file}" "${probe_stop_file}" \
    "${PROBE_INTERVAL_SECONDS}" &
  probe_pid=$!
  sleep 0.5
}

stop_probe() {
  if [[ -n "${probe_pid}" ]]; then
    touch "${probe_stop_file}"
    wait "${probe_pid}" 2>/dev/null || true
    probe_pid=""
  fi
}

rollback() {
  local exit_code="$1"
  local rollback_succeeded=1
  local history_status="failed_before_switch"
  local history_active_slot="${previous_slot:-unknown}"
  trap - EXIT
  set +e
  stop_probe
  if (( switched == 1 )); then
    echo "배포 실패, ${previous_slot} 슬롯으로 rollback합니다" >&2
    if ! start_existing_slot "${previous_slot}" \
      || ! render_route "$(upstream_for_slot "${previous_slot}")" \
      || ! wait_traefik_route "$(backend_for_slot "${previous_slot}")" "$(upstream_for_slot "${previous_slot}")" \
      || ! restore_state; then
      rollback_succeeded=0
      history_status="rollback_failed"
      history_active_slot="$(infer_active_slot "${ROUTE_FILE}")"
      echo "자동 rollback이 완료되지 않아 후보 슬롯을 유지합니다" >&2
      if alert_run_url="$(notify_rollback_failure "${history_active_slot}")"; then
        alert_request_status="requested"
      else
        alert_request_status="request_failed"
        alert_run_url=""
        echo "rollback 실패 운영 알림을 요청하지 못했습니다" >&2
      fi
    else
      history_status="rolled_back"
    fi
  fi
  if (( candidate_started == 1 && (switched == 0 || rollback_succeeded == 1) )); then
    stop_slot "${candidate_slot}"
  fi
  record_deployment_history "${history_status}" "${history_active_slot}" "${exit_code}"
  [[ -z "${probe_file}" ]] || rm -f "${probe_file}" "${probe_stop_file}"
  if (( switched == 0 )) && [[ -n "${state_backup_file}" ]]; then
    rm -f "${state_backup_file}"
  fi
  if [[ -n "${state_backup_file}" ]]; then
    echo "배포 상태 백업을 보존했습니다: ${state_backup_file}" >&2
  fi
  exit "${exit_code}"
}

run_self_test() {
  local temporary_dir route_file
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  route_file="${temporary_dir}/route.yml"
  printf 'url: "http://traefik-manager-frontend-blue:3000"\n' > "${route_file}"
  [[ "$(infer_active_slot "${route_file}")" == "blue" ]]
  [[ "$(opposite_slot blue)" == "green" ]]
  [[ "$(opposite_slot green)" == "blue" ]]
  [[ "$(upstream_for_slot green)" == "http://traefik-manager-frontend-green:3000" ]]
  [[ "$(backend_for_slot single)" == "traefik-manager-backend" ]]
  "${HISTORY_SCRIPT}" --self-test >/dev/null
  echo "Manager blue-green 배포 self-test 통과"
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  return 0
fi

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

version="${1:-}"
if [[ ! "${version}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "사용법: $0 vX.Y.Z" >&2
  exit 2
fi
if [[ ! "${PROBE_INTERVAL_SECONDS}" =~ ^0\.[0-9]+$ ]]; then
  echo "probe 간격은 1초 미만 소수여야 합니다: ${PROBE_INTERVAL_SECONDS}" >&2
  exit 2
fi
if [[ ! "${DRAIN_SECONDS}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "drain 시간은 0 이상의 숫자여야 합니다: ${DRAIN_SECONDS}" >&2
  exit 2
fi
for command_name in awk curl docker flock git grep mktemp; do
  command -v "${command_name}" >/dev/null || { echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2; exit 1; }
done

cd "${REPO_ROOT}"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "커밋되지 않은 변경이 있어 배포를 중단합니다" >&2
  exit 1
fi
mkdir -p "${STATE_DIR}"
exec 9>"${LOCK_FILE}"
flock -n 9 || { echo "다른 Manager 배포가 실행 중입니다" >&2; exit 1; }
trap 'rollback $?' EXIT

health_url="$(resolve_health_url)"
curl --silent --show-error --fail --max-time 5 "${health_url}" >/dev/null
previous_slot="$(infer_active_slot "${ROUTE_FILE}")"
if [[ "${previous_slot}" == "unknown" ]]; then
  echo "현재 Manager active route를 판별하지 못했습니다" >&2
  exit 1
fi
candidate_slot="$(opposite_slot "${previous_slot}")"
candidate_upstream="$(upstream_for_slot "${candidate_slot}")"
snapshot_state
revision="$(git rev-parse HEAD)"
build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
deployment_started_at="${build_date}"
history_record_enabled=1
export TRAEFIK_MANAGER_VERSION="${version}"
export TRAEFIK_MANAGER_GIT_SHA="${revision}"
export TRAEFIK_MANAGER_BUILD_DATE="${build_date}"

echo "Manager blue-green 배포: ${previous_slot} -> ${candidate_slot} (${version}, ${revision:0:12})"
deployment_stage="prepare"
ensure_docker_proxy
deployment_stage="build"
compose build "backend-${candidate_slot}" "frontend-${candidate_slot}"
deployment_stage="migration_preflight"
run_migration_preflight "${candidate_slot}"
deployment_stage="candidate_health"
start_candidate "${candidate_slot}"
deployment_stage="route_switch"
start_probe
switched=1
render_route "${candidate_upstream}"
wait_traefik_route "$(backend_for_slot "${candidate_slot}")" "${candidate_upstream}"
deployment_stage="leader_handover"
sleep "${DRAIN_SECONDS}"
docker stop --time 15 "$(backend_for_slot "${previous_slot}")" >/dev/null
wait_background_leader "$(backend_for_slot "${candidate_slot}")" "${candidate_slot}"
deployment_stage="public_probe"
curl --silent --show-error --fail --max-time 5 "${health_url}" >/dev/null
sleep 1
stop_probe
"${PROBE_SCRIPT}" assert "${probe_file}" 5
deployment_stage="state_write"
write_state "${candidate_slot}" "${revision}" "${version}"
docker stop --time 15 "$(frontend_for_slot "${previous_slot}")" >/dev/null
record_deployment_history success "${candidate_slot}" 0
trap - EXIT
rm -f "${probe_file}" "${probe_stop_file}" || true
[[ -z "${state_backup_file}" ]] || rm -f "${state_backup_file}" || true
probe_file=""
state_backup_file=""
echo "Manager blue-green 배포 완료: active=${candidate_slot}, version=${version}"
