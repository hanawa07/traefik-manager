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
data_dir="${temporary_dir}/data"
crontab_file="${temporary_dir}/crontab"
systemctl_log="${temporary_dir}/systemctl.log"
analyze_log="${temporary_dir}/systemd-analyze.log"
mkdir -p "${fake_bin}" "${home_dir}"

cat > "${fake_bin}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_TEST_SYSTEMCTL_LOG}"
exit 0
SCRIPT
cat > "${fake_bin}/systemd-analyze" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_TEST_ANALYZE_LOG}"
exit 0
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
    XDG_DATA_HOME="${data_dir}" \
    TM_MANAGER_DEPLOY_STATE_DIR="${state_dir}" \
    TM_TEST_CRONTAB_FILE="${crontab_file}" \
    TM_TEST_SYSTEMCTL_LOG="${systemctl_log}" \
    TM_TEST_ANALYZE_LOG="${analyze_log}" \
    PATH="${fake_bin}:${PATH}" \
    "${SCRIPT_DIR}/install-smoke-rotation-timer.sh"
}

cat > "${crontab_file}" <<'CRON'
# unrelated before
*/5 * * * * /usr/local/bin/health-check
# BEGIN TRAEFIK_MANAGER_SMOKE_ROTATION
SHELL=/bin/bash
17 4 1 * * /old/rotate-smoke-viewer-password.sh
# END TRAEFIK_MANAGER_SMOKE_ROTATION
# unrelated after
50 2 * * * /usr/local/bin/backup
CRON

run_installer

service_unit="${config_dir}/systemd/user/traefik-manager-smoke-rotation.service"
timer_unit="${config_dir}/systemd/user/traefik-manager-smoke-rotation.timer"
stamp_file="${data_dir}/systemd/timers/stamp-traefik-manager-smoke-rotation.timer"
grep -Fxq "WorkingDirectory=$(cd -- "${SCRIPT_DIR}/.." && pwd)" "${service_unit}"
grep -Fxq "ConditionFileIsExecutable=${SCRIPT_DIR}/rotate-smoke-viewer-password.sh" "${service_unit}"
grep -Fxq "ReadWritePaths=${state_dir} /var/run/docker.sock" "${service_unit}"
grep -Fxq "StandardOutput=append:${state_dir}/smoke-password-rotation.log" "${service_unit}"
grep -Fxq 'OnCalendar=*-*-01 04:17:00 Asia/Seoul' "${timer_unit}"
grep -Fxq 'Persistent=true' "${timer_unit}"
grep -Fq 'enable --now traefik-manager-smoke-rotation.timer' "${systemctl_log}"
grep -Fq "calendar *-*-01 04:17:00 Asia/Seoul" "${analyze_log}"
grep -Fq -- "--user verify" "${analyze_log}"
[[ -f "${stamp_file}" ]]
grep -Fq '# unrelated before' "${crontab_file}"
grep -Fq '# unrelated after' "${crontab_file}"
if grep -Fq 'TRAEFIK_MANAGER_SMOKE_ROTATION' "${crontab_file}"; then
  echo "기존 smoke rotation cron 블록이 남아 있습니다" >&2
  exit 1
fi
if grep -Fq 'start traefik-manager-smoke-rotation.service' "${systemctl_log}"; then
  echo "설치 중 실제 회전 service를 시작했습니다" >&2
  exit 1
fi

cat > "${crontab_file}" <<'CRON'
# BEGIN TRAEFIK_MANAGER_SMOKE_ROTATION
17 4 1 * * /old/rotate-smoke-viewer-password.sh
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

echo "스모크 계정 회전 timer 설치 self-test 통과"
