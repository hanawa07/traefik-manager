#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT
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
readonly HISTORY_DAILY_RETAIN_ENTRIES="${TM_DEPLOY_HISTORY_DAILY_RETAIN_ENTRIES:-365}"
# shellcheck source=scripts/manager-deployment-stage-timing.sh
source "${SCRIPT_DIR}/manager-deployment-stage-timing.sh"
# shellcheck source=scripts/manager-blue-green-runtime.sh
source "${SCRIPT_DIR}/manager-blue-green-runtime.sh"
# shellcheck source=scripts/manager-blue-green-recovery.sh
source "${SCRIPT_DIR}/manager-blue-green-recovery.sh"

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

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  return 0
fi

if [[ "${1:-}" == "--self-test" ]]; then
  # shellcheck source=scripts/blue-green-deploy-self-test.sh
  source "${SCRIPT_DIR}/blue-green-deploy-self-test.sh"
  run_blue_green_deploy_self_test
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
manager_deployment_stage_start prepare
ensure_docker_proxy
manager_deployment_stage_start build
compose build "backend-${candidate_slot}" "frontend-${candidate_slot}"
manager_deployment_stage_start migration_preflight
run_migration_preflight "${candidate_slot}"
manager_deployment_stage_start candidate_health
start_candidate "${candidate_slot}"
manager_deployment_stage_start route_switch
start_probe
switched=1
render_route "${candidate_upstream}"
wait_traefik_route "$(backend_for_slot "${candidate_slot}")" "${candidate_upstream}"
manager_deployment_stage_start leader_handover
sleep "${DRAIN_SECONDS}"
docker stop --time 15 "$(backend_for_slot "${previous_slot}")" >/dev/null
wait_background_leader "$(backend_for_slot "${candidate_slot}")" "${candidate_slot}"
manager_deployment_stage_start public_probe
curl --silent --show-error --fail --max-time 5 "${health_url}" >/dev/null
sleep 1
stop_probe
"${PROBE_SCRIPT}" assert "${probe_file}" 5
manager_deployment_stage_start state_write
write_state "${candidate_slot}" "${revision}" "${version}"
manager_deployment_stage_finish
docker stop --time 15 "$(frontend_for_slot "${previous_slot}")" >/dev/null
record_deployment_history success "${candidate_slot}" 0
trap - EXIT
rm -f "${probe_file}" "${probe_stop_file}" || true
[[ -z "${state_backup_file}" ]] || rm -f "${state_backup_file}" || true
probe_file=""
state_backup_file=""
echo "Manager blue-green 배포 완료: active=${candidate_slot}, version=${version}"
