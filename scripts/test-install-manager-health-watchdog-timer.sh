#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

fake_bin="${temporary_dir}/bin"
home_dir="${temporary_dir}/home"
state_dir="${temporary_dir}/state"
config_dir="${temporary_dir}/config"
crontab_file="${temporary_dir}/crontab"
systemctl_log="${temporary_dir}/systemctl.log"
analyze_log="${temporary_dir}/systemd-analyze.log"
mkdir -p "${fake_bin}" "${home_dir}"

cat > "${fake_bin}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_TEST_SYSTEMCTL_LOG}"
SCRIPT
cat > "${fake_bin}/systemd-analyze" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_TEST_ANALYZE_LOG}"
SCRIPT
cat > "${fake_bin}/crontab" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "-l" ]]; then
  if [[ ! -f "${TM_TEST_CRONTAB_FILE}" ]]; then
    echo "no crontab for test" >&2
    exit 1
  fi
  cat "${TM_TEST_CRONTAB_FILE}"
  exit 0
fi
cp "$1" "${TM_TEST_CRONTAB_FILE}"
SCRIPT
chmod 700 "${fake_bin}/systemctl" "${fake_bin}/systemd-analyze" "${fake_bin}/crontab"

run_installer() {
  HOME="${home_dir}" \
    XDG_CONFIG_HOME="${config_dir}" \
    TM_MANAGER_WATCHDOG_STATE_DIR="${state_dir}" \
    TM_TEST_CRONTAB_FILE="${crontab_file}" \
    TM_TEST_SYSTEMCTL_LOG="${systemctl_log}" \
    TM_TEST_ANALYZE_LOG="${analyze_log}" \
    PATH="${fake_bin}:${PATH}" \
    "${SCRIPT_DIR}/install-manager-health-watchdog-timer.sh"
}

cat > "${crontab_file}" <<'CRON'
# unrelated before
50 2 * * * /usr/local/bin/backup
# BEGIN TRAEFIK_MANAGER_HEALTH_WATCHDOG
*/5 * * * * cd /old/manager && /usr/bin/bash scripts/manager-health-watchdog.sh
# END TRAEFIK_MANAGER_HEALTH_WATCHDOG
# unrelated after
CRON

run_installer

service_unit="${config_dir}/systemd/user/traefik-manager-health-watchdog.service"
timer_unit="${config_dir}/systemd/user/traefik-manager-health-watchdog.timer"
grep -Fxq "WorkingDirectory=$(cd -- "${SCRIPT_DIR}/.." && pwd)" "${service_unit}"
grep -Fxq "ConditionFileIsExecutable=${SCRIPT_DIR}/manager-health-watchdog.sh" "${service_unit}"
grep -Fxq "Environment=TM_MANAGER_WATCHDOG_STATE_DIR=${state_dir}" "${service_unit}"
grep -Fxq "StandardOutput=append:${state_dir}/manager-health-watchdog.log" "${service_unit}"
grep -Fxq 'TimeoutStartSec=1min' "${service_unit}"
grep -Fxq 'OnActiveSec=3min' "${timer_unit}"
grep -Fxq 'OnUnitInactiveSec=5min' "${timer_unit}"
grep -Fq 'enable --now traefik-manager-health-watchdog.timer' "${systemctl_log}"
grep -Fq -- '--user verify' "${analyze_log}"
grep -Fq '# unrelated before' "${crontab_file}"
grep -Fq '# unrelated after' "${crontab_file}"
if grep -Fq 'TRAEFIK_MANAGER_HEALTH_WATCHDOG' "${crontab_file}"; then
  echo "기존 Manager health watchdog cron 블록이 남아 있습니다" >&2
  exit 1
fi
if grep -Fq 'start traefik-manager-health-watchdog.service' "${systemctl_log}"; then
  echo "설치 중 watchdog service를 직접 시작했습니다" >&2
  exit 1
fi

cat > "${crontab_file}" <<'CRON'
# BEGIN TRAEFIK_MANAGER_HEALTH_WATCHDOG
*/5 * * * * /old/manager-health-watchdog.sh
CRON
if run_installer > "${temporary_dir}/malformed.out" 2>&1; then
  echo "불완전한 cron 마커가 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'cron 마커 쌍이 올바르지 않습니다' "${temporary_dir}/malformed.out"

printf '%s\n' '# unrelated only' > "${crontab_file}"
run_installer
grep -Fxq '# unrelated only' "${crontab_file}"

rm -f "${crontab_file}"
run_installer
[[ ! -e "${crontab_file}" ]]

echo "Manager health watchdog timer 설치 self-test 통과"
