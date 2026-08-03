#!/usr/bin/env bash

# Deployment configuration and state are initialized by blue-green-deploy.sh.
# shellcheck disable=SC2034,SC2154

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

build_health_curl_resolve() {
  local url="$1"
  local address="$2"
  local authority host port
  authority="${url#*://}"
  authority="${authority%%/*}"
  host="${authority%%:*}"
  if [[ "${authority}" == *:* ]]; then
    port="${authority##*:}"
  elif [[ "${url}" == https://* ]]; then
    port=443
  else
    port=80
  fi
  printf '%s:%s:%s\n' "${host}" "${port}" "${address}"
}

probe_health_url() {
  local url="$1"
  local timeout_seconds="${2:-5}"
  local -a resolve_args=()
  if [[ -n "${health_curl_resolve:-}" ]]; then
    resolve_args=(--resolve "${health_curl_resolve}")
  fi
  curl --silent --show-error --fail --max-time "${timeout_seconds}" \
    "${resolve_args[@]}" "${url}"
}

configure_health_probe() {
  local url="$1"
  local address
  if [[ -n "${health_curl_resolve:-}" ]]; then
    probe_health_url "${url}" >/dev/null
    return
  fi
  if probe_health_url "${url}" >/dev/null 2>&1; then
    return
  fi

  while IFS= read -r address; do
    [[ -n "${address}" ]] || continue
    health_curl_resolve="$(build_health_curl_resolve "${url}" "${address}")"
    if probe_health_url "${url}" 2 >/dev/null 2>&1; then
      echo "공인 self-probe를 Traefik 내부 경로로 대체합니다: ${address}"
      return
    fi
  done < <(
    docker inspect --format \
      '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' \
      traefik 2>/dev/null | awk 'NF && !seen[$0]++'
  )

  health_curl_resolve=""
  echo "Manager 공개 health와 Traefik 내부 fallback에 모두 연결하지 못했습니다" >&2
  return 1
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

wait_background_leader_ready() {
  local backend_container="$1"
  local slot="$2"
  local deadline=$((SECONDS + 30))
  while (( SECONDS < deadline )); do
    if docker logs "${backend_container}" 2>&1 | grep -Fq "Traefik 동적 설정 startup 동기화 완료"; then
      return 0
    fi
    sleep 1
  done
  echo "새 backend가 leader 승계 후 동적 설정 동기화를 완료하지 못했습니다: ${slot}" >&2
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
