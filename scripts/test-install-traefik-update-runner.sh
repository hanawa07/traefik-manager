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
compose_base_file="deploy/compose.yml"
compose_overlay_file="deploy/compose.prod.yml"
compose_files="${compose_base_file},${compose_overlay_file}"
acme_file="certificates/acme-prod.json"
compose_service="edge-proxy"
traefik_container="edge-traefik"
traefik_network="edge_net"
mkdir -p "${fake_bin}" "${home_dir}" "${traefik_dir}/deploy" "${traefik_dir}/certificates"
printf '%s\n' 'services:' "  ${compose_service}:" > "${traefik_dir}/${compose_base_file}"
printf '%s\n' 'services:' "  ${compose_service}:" '    image: traefik:v3.7.10' \
  > "${traefik_dir}/${compose_overlay_file}"
printf '%s\n' 'acme-state' > "${traefik_dir}/${acme_file}"
touch "${traefik_dir}/certificates/empty.json"

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
  local -a compose_environment
  if [[ "${TM_TEST_USE_LEGACY:-false}" == "true" ]]; then
    compose_environment=("TM_TRAEFIK_UPDATE_COMPOSE_FILE=${compose_overlay_file}")
  else
    compose_environment=("TM_TRAEFIK_UPDATE_COMPOSE_FILES=${TM_TEST_COMPOSE_FILES:-${compose_files}}")
  fi
  env -u TM_TRAEFIK_UPDATE_COMPOSE_FILES -u TM_TRAEFIK_UPDATE_COMPOSE_FILE \
    -u TM_TRAEFIK_UPDATE_ACME_FILE -u TM_TRAEFIK_UPDATE_SERVICE \
    -u TM_TRAEFIK_UPDATE_CONTAINER -u TM_TRAEFIK_UPDATE_NETWORK \
    -u TM_TRAEFIK_MANAGER_HEALTH_URL \
    HOME="${home_dir}" \
    XDG_CONFIG_HOME="${config_dir}" \
    TM_MANAGER_DEPLOY_STATE_DIR="${state_dir}" \
    TM_TRAEFIK_UPDATE_COMPOSE_DIR="${traefik_dir}" \
    TM_TRAEFIK_UPDATE_ACME_FILE="${TM_TEST_ACME_FILE:-${acme_file}}" \
    TM_TRAEFIK_UPDATE_SERVICE="${TM_TEST_SERVICE:-${compose_service}}" \
    TM_TRAEFIK_UPDATE_CONTAINER="${TM_TEST_CONTAINER:-${traefik_container}}" \
    TM_TRAEFIK_UPDATE_NETWORK="${TM_TEST_NETWORK:-${traefik_network}}" \
    TM_TRAEFIK_MANAGER_HEALTH_URL="${TM_TEST_HEALTH_URL:-https://server-name.example.ts.net:8444/api/health}" \
    TM_TEST_SYSTEMCTL_LOG="${systemctl_log}" \
    PATH="${fake_bin}:${PATH}" \
    "${compose_environment[@]}" \
    "${SCRIPT_DIR}/install-traefik-update-runner.sh"
}

run_installer
service_unit="${config_dir}/systemd/user/traefik-manager-traefik-update.service"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_COMPOSE_DIR=${traefik_dir}" "${service_unit}"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_COMPOSE_FILES=${compose_files}" "${service_unit}"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_ACME_FILE=${acme_file}" "${service_unit}"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_SERVICE=${compose_service}" "${service_unit}"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_CONTAINER=${traefik_container}" "${service_unit}"
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_NETWORK=${traefik_network}" "${service_unit}"
grep -Fxq 'Environment=TM_TRAEFIK_MANAGER_HEALTH_URL=https://server-name.example.ts.net:8444/api/health' "${service_unit}"
grep -Fq 'enable --now traefik-manager-traefik-update.path traefik-manager-traefik-update.timer' "${systemctl_log}"
grep -Fq 'start traefik-manager-traefik-update.service' "${systemctl_log}"

if TM_TEST_COMPOSE_FILES='../outside.yml' run_installer > "${temporary_dir}/invalid.out" 2>&1; then
  echo "Compose 디렉터리 이탈 경로가 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'Compose 파일 경로는 Traefik 디렉터리 내부여야 합니다' "${temporary_dir}/invalid.out"

if TM_TEST_COMPOSE_FILES="${compose_base_file},${compose_base_file}" \
  run_installer > "${temporary_dir}/duplicate.out" 2>&1; then
  echo "중복 Compose 파일 목록이 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'Compose 파일 목록에 중복 항목이 있습니다' "${temporary_dir}/duplicate.out"

if TM_TEST_ACME_FILE='../acme.json' run_installer > "${temporary_dir}/invalid-acme.out" 2>&1; then
  echo "ACME 디렉터리 이탈 경로가 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'ACME 파일 경로는 Traefik 디렉터리 내부여야 합니다' "${temporary_dir}/invalid-acme.out"

if TM_TEST_ACME_FILE='certificates/empty.json' run_installer > "${temporary_dir}/empty-acme.out" 2>&1; then
  echo "비어 있는 ACME 파일이 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'Traefik ACME 파일이 없거나 비어 있습니다' "${temporary_dir}/empty-acme.out"

if TM_TEST_SERVICE='edge/proxy' run_installer > "${temporary_dir}/invalid-service.out" 2>&1; then
  echo "잘못된 Compose 서비스 이름이 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'Compose 서비스 이름이 올바르지 않습니다' "${temporary_dir}/invalid-service.out"

TM_TEST_USE_LEGACY=true run_installer
grep -Fxq "Environment=TM_TRAEFIK_UPDATE_COMPOSE_FILES=${compose_overlay_file}" "${service_unit}"

if TM_TEST_HEALTH_URL='https://server-name.example.ts.net:8444/not-health' \
  run_installer > "${temporary_dir}/invalid-health.out" 2>&1; then
  echo "잘못된 Manager health URL이 허용되었습니다" >&2
  exit 1
fi
grep -Fq 'Manager health URL이 올바르지 않습니다' "${temporary_dir}/invalid-health.out"

echo "Traefik 업데이트 실행기 설치 self-test 통과"
