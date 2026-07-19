#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly CONFIG_DIR="${TM_MAINTENANCE_SMOKE_CONFIG_DIR:-${REPO_ROOT}/traefik-config/dynamic}"
readonly SELF_CONFIG="${CONFIG_DIR}/traefik-manager-self.yml"
readonly SMOKE_DOMAIN="${TM_MAINTENANCE_SMOKE_DOMAIN:-manager-maintenance-smoke.invalid}"
readonly BASE_URL="${TM_MAINTENANCE_SMOKE_BASE_URL:-http://127.0.0.1}"
readonly TIMEOUT_SECONDS="${TM_MAINTENANCE_SMOKE_TIMEOUT_SECONDS:-10}"

temporary_config=""
route_config=""
response_body=""

cleanup() {
  [[ -z "${route_config}" ]] || rm -f -- "${route_config}"
  [[ -z "${temporary_config}" ]] || rm -f -- "${temporary_config}"
  [[ -z "${response_body}" ]] || rm -f -- "${response_body}"
}
trap cleanup EXIT

if [[ ! "${SMOKE_DOMAIN}" =~ ^[a-z0-9][a-z0-9.-]*\.invalid$ ]]; then
  echo "점검 안내 스모크 도메인은 .invalid로 끝나야 합니다: ${SMOKE_DOMAIN}" >&2
  exit 2
fi
if [[ ! -f "${SELF_CONFIG}" ]]; then
  echo "Manager self route 설정을 찾을 수 없습니다: ${SELF_CONFIG}" >&2
  exit 1
fi

active_slot="$(
  sed -nE 's#.*url: "http://traefik-manager-frontend-(blue|green):3000".*#\1#p' \
    "${SELF_CONFIG}" | head -n 1
)"
if [[ -z "${active_slot}" ]]; then
  echo "현재 active Manager 슬롯을 확인하지 못했습니다" >&2
  exit 1
fi

backend_container="traefik-manager-backend-${active_slot}"
if [[ "$(docker inspect --format '{{.State.Running}}' "${backend_container}" 2>/dev/null || true)" != "true" ]]; then
  echo "active backend 컨테이너가 실행 중이 아닙니다: ${backend_container}" >&2
  exit 1
fi

temporary_config="$(mktemp "${CONFIG_DIR}/.maintenance-smoke.XXXXXX.tmp")"
route_config="${CONFIG_DIR}/maintenance-smoke-${BASHPID}.yml"
response_body="$(mktemp)"

docker exec -i "${backend_container}" python - "${SMOKE_DOMAIN}" > "${temporary_config}" <<'PY'
import sys

from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.config_generator import TraefikConfigGenerator

service = Service.create(
    name="maintenance-smoke",
    domain=sys.argv[1],
    upstream_host="unused.invalid",
    upstream_port=80,
    routing_mode="maintenance",
    tls_enabled=False,
    https_redirect_enabled=False,
)
print(TraefikConfigGenerator().to_yaml(service), end="")
PY

grep -q "${SMOKE_DOMAIN}" "${temporary_config}"
grep -q '/maintenance' "${temporary_config}"
mv -- "${temporary_config}" "${route_config}"
temporary_config=""

deadline=$((SECONDS + TIMEOUT_SECONDS))
status="000"
while (( SECONDS < deadline )); do
  status="$(
    curl --silent --show-error --max-time 2 --output "${response_body}" \
      --write-out '%{http_code}' --header "Host: ${SMOKE_DOMAIN}" \
      "${BASE_URL%/}/smoke-check" 2>/dev/null || printf '000'
  )"
  if [[ "${status}" == "200" ]] && grep -q '더 나은 상태로' "${response_body}"; then
    break
  fi
  sleep 0.2
done
if [[ "${status}" != "200" ]] || ! grep -q '더 나은 상태로' "${response_body}"; then
  echo "점검 안내 라우팅 스모크 실패: HTTP ${status}" >&2
  exit 1
fi

rm -f -- "${route_config}"
route_config=""

deadline=$((SECONDS + TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  status="$(
    curl --silent --show-error --max-time 2 --output /dev/null \
      --write-out '%{http_code}' --header "Host: ${SMOKE_DOMAIN}" \
      "${BASE_URL%/}/smoke-check" 2>/dev/null || printf '000'
  )"
  [[ "${status}" == "404" ]] && break
  sleep 0.2
done
if [[ "${status}" != "404" ]]; then
  echo "점검 안내 스모크 라우터 제거 확인 실패: HTTP ${status}" >&2
  exit 1
fi

echo "점검 안내 Traefik 스모크 통과: ${SMOKE_DOMAIN} 200 -> ${status}"
