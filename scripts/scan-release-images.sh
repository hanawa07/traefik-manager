#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT

# Trivy 0.74.0 multi-arch manifest. Pinning prevents a mutable scanner from
# changing the release result without a repository change.
readonly TRIVY_IMAGE="aquasec/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969"
readonly COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"
readonly COMPOSE_ENV_FILE="${REPO_ROOT}/.env.example"

for command_name in docker python3; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf '필수 명령을 찾을 수 없습니다: %s\n' "${command_name}" >&2
    exit 2
  fi
done

temporary_dir="$(mktemp -d)"
scan_suffix="${GITHUB_RUN_ID:-local}-$$"
backend_image="traefik-manager-backend:security-scan-${scan_suffix}"
frontend_image="traefik-manager-frontend:security-scan-${scan_suffix}"
readonly temporary_dir
readonly backend_image
readonly frontend_image

cleanup() {
  docker image rm "${backend_image}" "${frontend_image}" >/dev/null 2>&1 || true
  rm -rf "${temporary_dir}"
}
trap cleanup EXIT

readarray -t compose_runtime_images < <(
  APP_ENV_FILE="${COMPOSE_ENV_FILE}" docker compose \
    --file "${COMPOSE_FILE}" \
    --env-file "${COMPOSE_ENV_FILE}" \
    config --format json \
    | python3 -c '
import json
import sys

services = json.load(sys.stdin)["services"]
for service_name in ("dockerproxy", "init-traefik-config"):
    print(services[service_name]["image"])
'
)
if (( ${#compose_runtime_images[@]} != 2 )); then
  printf 'Compose 런타임 이미지 두 개를 확인하지 못했습니다.\n' >&2
  exit 1
fi
readonly docker_proxy_image="${compose_runtime_images[0]}"
readonly init_image="${compose_runtime_images[1]}"

scan_image() {
  local label="$1"
  local image="$2"
  local archive_name="$3"
  local archive_path="${temporary_dir}/${archive_name}.tar"

  printf '\n[%s] %s\n' "${label}" "${image}"
  docker image inspect "${image}" >/dev/null
  docker save --output "${archive_path}" "${image}"
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "${temporary_dir}/trivy-cache:/cache" \
    --volume "${archive_path}:/scan/image.tar:ro" \
    "${TRIVY_IMAGE}" image \
    --cache-dir /cache \
    --exit-code 1 \
    --ignore-unfixed \
    --no-progress \
    --scanners vuln \
    --severity HIGH,CRITICAL \
    --input /scan/image.tar
  rm -f "${archive_path}"
}

printf '%s\n' '릴리스 후보 이미지를 빌드합니다.'
docker build --pull --tag "${backend_image}" "${REPO_ROOT}/backend"
docker build --pull --tag "${frontend_image}" "${REPO_ROOT}/frontend"

printf '%s\n' 'Compose에 고정된 보조 이미지를 가져옵니다.'
docker pull "${docker_proxy_image}"
docker pull "${init_image}"

docker pull "${TRIVY_IMAGE}"
mkdir -p "${temporary_dir}/trivy-cache"
scan_image 'Backend' "${backend_image}" 'backend'
scan_image 'Frontend' "${frontend_image}" 'frontend'
scan_image 'Docker API proxy' "${docker_proxy_image}" 'dockerproxy'
scan_image 'Config initializer' "${init_image}" 'init'

printf '\n%s\n' '릴리스 컨테이너 이미지에서 수정 가능한 High/Critical 취약점이 발견되지 않았습니다.'
