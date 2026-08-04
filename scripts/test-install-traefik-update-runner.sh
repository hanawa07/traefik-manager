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
traefik_dir="${temporary_dir}/traefik"
systemctl_log="${temporary_dir}/systemctl.log"
compose_file="deploy/compose.prod.yml"
mkdir -p "${fake_bin}" "${home_dir}" "${traefik_dir}/deploy"
printf '%s\n' 'services:' '  traefik:' '    image: traefik:v3.7.10' \
  > "${traefik_dir}/${compose_file}"

cat > "${fake_bin}/docker" <<'SCRIPT'
#!/usr/bin/env bash
exit 0
SCRIPT
cat > "${fake_bin}/setfacl" <<'SCRIPT'
#!/usr/bin/env bash
exit 0
SCRIPT
cat > "${fake_bin}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_TEST_SYSTEMCTL_LOG}"
if [[ "$*" == *" show "* || "$*" == *" show"* ]]; then
  printf '%s\n' 'success'
fi
SCRIPT
chmod 700 "${fake_bin}/docker" "${fake_bin}/setfacl" "${fake_bin}/systemctl"

run_installer() {
  HOME="${home_dir}" \
  XDG_CONFIG_HOME="${config_dir}" \
  TM_MANAGER_DEPLOY_STATE_DIR="${state_dir}" \
  TM_TRAEFIK_UPDATE_COMPOSE_DIR="${traefik_dir}" \
  TM_TRAEFIK_UPDATE_COMPOSE_FILE="${TM_TEST_COMPOSE_FILE:-${compose_file}}" \
  TM_TEST_SYSTEMCTL_LOG="${systemctl_log}" \
  PATH="${fake_bin}:${PATH}" \
    "${SCRIPT_DIR}/install-traefik-update-runner.sh"
}

run_installer
service_unit="${config_dir}/systemd/user/traefik-manager-traefik-update.service"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_COMPOSE_DIR=${traefik_dir}" "${service_unit}"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_COMPOSE_FILE=${compose_file}" "${service_unit}"
grep -Fq 'enable --now traefik-manager-traefik-update.path traefik-manager-traefik-update.timer' "${systemctl_log}"
grep -Fq 'start traefik-manager-traefik-update.service' "${systemctl_log}"

if TM_TEST_COMPOSE_FILE='../outside.yml' run_installer > "${temporary_dir}/invalid.out" 2>&1; then
  echo "Compose 디렉터리 이탈 경로가 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'Compose 파일 경로는 Traefik 디렉터리 내부여야 합니다' "${temporary_dir}/invalid.out"

echo "Traefik 업데이트 실행기 설치 self-test 통과"
