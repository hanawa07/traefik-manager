#!/usr/bin/env bash
set -euo pipefail

TEST_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_SCRIPT_DIR
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT
export TM_MANAGER_DEPLOY_STATE_DIR="${temporary_dir}/state"
export TM_HOST_OPERATION_ALERT_SCRIPT="${temporary_dir}/alert.sh"
export TM_TEST_ALERT_ARGS="${temporary_dir}/alert-args"
mkdir -p "${TM_MANAGER_DEPLOY_STATE_DIR}"

cat > "${TM_HOST_OPERATION_ALERT_SCRIPT}" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$@" > "${TM_TEST_ALERT_ARGS}"
printf 'https://github.com/hanawa07/traefik-manager/actions/runs/123\n'
SCRIPT
chmod 700 "${TM_HOST_OPERATION_ALERT_SCRIPT}"

# Source the production state machine, then replace only host-facing recovery calls.
# shellcheck source=scripts/blue-green-deploy.sh
source "${TEST_SCRIPT_DIR}/blue-green-deploy.sh"
start_existing_slot() {
  touch "${temporary_dir}/recovery-attempted"
  return 1
}
infer_active_slot() { printf 'green\n'; }
stop_slot() { touch "${temporary_dir}/candidate-stopped"; }
render_route() { touch "${temporary_dir}/route-rendered"; }

previous_slot="blue"
candidate_slot="green"
version="v1.2.3"
revision="1111111111111111111111111111111111111111"
deployment_started_at="2026-07-16T00:00:00Z"
deployment_stage="public_probe"
history_record_enabled=1
switched=1
candidate_started=1
state_backup_file="${temporary_dir}/state.backup"
probe_file="${temporary_dir}/probe.log"
probe_stop_file="${probe_file}.stop"
touch "${state_backup_file}"
printf '1.0 503 0.01\n1.2 503 0.01\n1.4 503 0.01\n1.6 503 0.01\n1.8 503 0.01\n' \
  > "${probe_file}"

set +e
(rollback 17) >/dev/null 2>&1
exit_code=$?
set -e

[[ "${exit_code}" == "17" ]]
[[ -f "${temporary_dir}/recovery-attempted" ]]
[[ ! -e "${temporary_dir}/candidate-stopped" ]]
[[ ! -e "${temporary_dir}/route-rendered" ]]
[[ -f "${state_backup_file}" ]]
grep -Fq '"status":"rollback_failed"' "${HISTORY_FILE}"
grep -Fq '"active_slot":"green"' "${HISTORY_FILE}"
grep -Fq '"failure_stage":"public_probe"' "${HISTORY_FILE}"
grep -Fq 'HTTP 비정상 5/5건 · 자동 rollback 미완료' "${HISTORY_FILE}"
grep -Fq '"alert_request_status":"requested"' "${HISTORY_FILE}"
grep -Fq '"alert_run_url":"https://github.com/hanawa07/traefik-manager/actions/runs/123"' \
  "${HISTORY_FILE}"
grep -Fxq 'Manager blue-green rollback' "${TM_TEST_ALERT_ARGS}"
grep -Fxq 'failure' "${TM_TEST_ALERT_ARGS}"
echo "Manager rollback_failed 격리 통합 시험 통과"
