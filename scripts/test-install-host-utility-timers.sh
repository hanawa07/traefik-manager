#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR REPO_ROOT TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly HOME_DIR="${TEMP_DIR}/home"
readonly CONFIG_DIR="${TEMP_DIR}/config"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
readonly ANALYZE_LOG="${TEMP_DIR}/systemd-analyze.log"
readonly BASELINE_LOG="${TEMP_DIR}/baseline.log"
readonly -a TARGETS=(docker-dns-probe nvme-life-alert openclaw-postboot-healthcheck)
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${HOME_DIR}"
cat > "${FAKE_BIN}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_HOST_UTILITY_TEST_SYSTEMCTL_LOG}"
if [[ -n "${TM_HOST_UTILITY_TEST_SYSTEMCTL_FAIL_MATCH:-}" \
  && "$*" == *"${TM_HOST_UTILITY_TEST_SYSTEMCTL_FAIL_MATCH}"* \
  && ! -e "${TM_HOST_UTILITY_TEST_SYSTEMCTL_FAIL_MARKER}" ]]; then
  : > "${TM_HOST_UTILITY_TEST_SYSTEMCTL_FAIL_MARKER}"
  exit 55
fi
SCRIPT
cat > "${FAKE_BIN}/systemd-analyze" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_HOST_UTILITY_TEST_ANALYZE_LOG}"
SCRIPT
cat > "${FAKE_BIN}/baseline-refresh" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_HOST_UTILITY_TEST_BASELINE_LOG}"
[[ "${TM_HOST_UTILITY_TEST_BASELINE_FAIL:-0}" != 1 ]]
SCRIPT
chmod 700 "${FAKE_BIN}/systemctl" "${FAKE_BIN}/systemd-analyze" \
  "${FAKE_BIN}/baseline-refresh"

HOME="${HOME_DIR}" \
XDG_CONFIG_HOME="${CONFIG_DIR}" \
TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${FAKE_BIN}/baseline-refresh" \
TM_HOST_UTILITY_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
TM_HOST_UTILITY_TEST_ANALYZE_LOG="${ANALYZE_LOG}" \
TM_HOST_UTILITY_TEST_BASELINE_LOG="${BASELINE_LOG}" \
PATH="${FAKE_BIN}:${PATH}" \
  "${SCRIPT_DIR}/install-host-utility-timers.sh"

unit_dir="${CONFIG_DIR}/systemd/user"
for target in "${TARGETS[@]}"; do
  cmp -s "${REPO_ROOT}/deploy/systemd-user/${target}.service" "${unit_dir}/${target}.service"
  cmp -s "${REPO_ROOT}/deploy/systemd-user/${target}.timer" "${unit_dir}/${target}.timer"
  grep -Fq "enable --now ${target}.timer" "${SYSTEMCTL_LOG}"
done
[[ "$(grep -Fc 'enable --now ' "${SYSTEMCTL_LOG}")" == 3 ]]
grep -Fq -- '--user verify' "${ANALYZE_LOG}"
grep -Fxq -- '--refresh-baseline docker-dns-probe.timer docker-dns-probe.service nvme-life-alert.timer nvme-life-alert.service openclaw-postboot-healthcheck.timer openclaw-postboot-healthcheck.service' \
  "${BASELINE_LOG}"
if grep -Eq 'start (docker-dns-probe|nvme-life-alert|openclaw-postboot-healthcheck)\.service' \
  "${SYSTEMCTL_LOG}"; then
  echo "설치기가 호스트 점검 service를 직접 실행했습니다" >&2
  exit 1
fi

rollback_config="${TEMP_DIR}/rollback-config"
rollback_unit_dir="${rollback_config}/systemd/user"
mkdir -p "${rollback_unit_dir}"
for target in "${TARGETS[@]}"; do
  printf 'old %s service\n' "${target}" > "${rollback_unit_dir}/${target}.service"
  printf 'old %s timer\n' "${target}" > "${rollback_unit_dir}/${target}.timer"
done
if HOME="${HOME_DIR}" \
  XDG_CONFIG_HOME="${rollback_config}" \
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${FAKE_BIN}/baseline-refresh" \
  TM_HOST_UTILITY_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
  TM_HOST_UTILITY_TEST_ANALYZE_LOG="${ANALYZE_LOG}" \
  TM_HOST_UTILITY_TEST_BASELINE_LOG="${BASELINE_LOG}" \
  TM_HOST_UTILITY_TEST_BASELINE_FAIL=1 \
  PATH="${FAKE_BIN}:${PATH}" \
  "${SCRIPT_DIR}/install-host-utility-timers.sh" > /dev/null 2>&1; then
  echo "기준선 실패 설치가 성공으로 처리되었습니다" >&2
  exit 1
fi
for target in "${TARGETS[@]}"; do
  grep -Fxq "old ${target} service" "${rollback_unit_dir}/${target}.service"
  grep -Fxq "old ${target} timer" "${rollback_unit_dir}/${target}.timer"
done

failure_stages=(
  daemon-reload
  'enable --now docker-dns-probe.timer'
  'is-enabled --quiet docker-dns-probe.timer'
  'is-active --quiet docker-dns-probe.timer'
)
for stage_index in "${!failure_stages[@]}"; do
  failure_config="${TEMP_DIR}/failure-config-${stage_index}"
  failure_marker="${TEMP_DIR}/failure-marker-${stage_index}"
  failure_output="${TEMP_DIR}/failure-output-${stage_index}"
  if HOME="${HOME_DIR}" \
    XDG_CONFIG_HOME="${failure_config}" \
    TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
    TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${FAKE_BIN}/baseline-refresh" \
    TM_HOST_UTILITY_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    TM_HOST_UTILITY_TEST_SYSTEMCTL_FAIL_MATCH="${failure_stages[${stage_index}]}" \
    TM_HOST_UTILITY_TEST_SYSTEMCTL_FAIL_MARKER="${failure_marker}" \
    TM_HOST_UTILITY_TEST_ANALYZE_LOG="${ANALYZE_LOG}" \
    TM_HOST_UTILITY_TEST_BASELINE_LOG="${BASELINE_LOG}" \
    PATH="${FAKE_BIN}:${PATH}" \
      "${SCRIPT_DIR}/install-host-utility-timers.sh" docker-dns-probe \
      > "${failure_output}" 2>&1; then
    echo "systemctl 실패 단계가 설치 성공으로 처리되었습니다: ${failure_stages[${stage_index}]}" >&2
    exit 1
  fi
  [[ -e "${failure_marker}" ]]
  failure_unit_dir="${failure_config}/systemd/user"
  [[ ! -e "${failure_unit_dir}/docker-dns-probe.service" ]]
  [[ ! -e "${failure_unit_dir}/docker-dns-probe.timer" ]]
  grep -Fq '기존 unit 상태를 복구합니다' "${failure_output}"
done

if HOME="${HOME_DIR}" \
  XDG_CONFIG_HOME="${CONFIG_DIR}" \
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_WATCHDOG_SCRIPT="${FAKE_BIN}/baseline-refresh" \
  PATH="${FAKE_BIN}:${PATH}" \
  "${SCRIPT_DIR}/install-host-utility-timers.sh" unknown > /dev/null 2>&1; then
  echo "지원하지 않는 호스트 timer가 허용되었습니다" >&2
  exit 1
fi

echo "호스트 utility timer 설치 self-test 통과"
