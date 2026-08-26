#!/usr/bin/env bash

# Deployment helpers are initialized by blue-green-deploy.sh before this check runs.
# shellcheck disable=SC2154

run_blue_green_deploy_self_test() {
  local temporary_dir route_file curl_log state_file
  local test_backend_health test_frontend_health test_dockerproxy_health
  local test_inactive_status test_version test_revision
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  route_file="${temporary_dir}/route.yml"
  printf 'url: "http://traefik-manager-frontend-blue:3000"\n' > "${route_file}"
  [[ "$(infer_active_slot "${route_file}")" == "blue" ]]
  [[ "$(opposite_slot blue)" == "green" ]]
  [[ "$(opposite_slot green)" == "blue" ]]
  [[ "$(upstream_for_slot green)" == "http://traefik-manager-frontend-green:3000" ]]
  [[ "$(backend_for_slot single)" == "traefik-manager-backend" ]]
  [[ "$(build_health_curl_resolve 'https://manager.example.com/api/health' '192.0.2.10')" == "manager.example.com:443:192.0.2.10" ]]
  [[ "$(build_health_curl_resolve 'http://manager.example.com:8080/api/health' '192.0.2.10')" == "manager.example.com:8080:192.0.2.10" ]]
  curl_log="${temporary_dir}/curl.log"
  # probe 함수가 아래 테스트 대역을 간접 호출합니다.
  # shellcheck disable=SC2317
  curl() { printf '%s\n' "$*" > "${curl_log}"; }
  probe_public_continuity "https://storefront.example.com/products"
  unset -f curl
  grep -q -- '--retry 2' "${curl_log}"
  grep -q -- 'https://storefront.example.com/products' "${curl_log}"
  state_file="${temporary_dir}/deployment.state"
  test_backend_health="healthy"
  test_frontend_health="healthy"
  test_dockerproxy_health="healthy"
  test_inactive_status="exited"
  test_version="v1.2.3"
  test_revision="abcdef1234567890"
  printf 'slot=blue\nversion=%s\nrevision=%s\n' \
    "${test_version}" "${test_revision}" > "${state_file}"
  # 중복 판정이 아래 Docker 테스트 대역을 간접 호출합니다.
  # shellcheck disable=SC2317
  docker() {
    local format="${3:-}"
    local container_name="${4:-}"
    if [[ "${1:-}" != "inspect" || "${2:-}" != "--format" ]]; then
      return 1
    fi
    if [[ "${format}" == *'org.opencontainers.image.version'* ]]; then
      case "${container_name}" in
        traefik-manager-backend-blue) printf '%s|%s|%s\n' "${test_backend_health}" "${test_version}" "${test_revision}" ;;
        traefik-manager-frontend-blue) printf '%s|%s|%s\n' "${test_frontend_health}" "${test_version}" "${test_revision}" ;;
        *) return 1 ;;
      esac
    elif [[ "${format}" == '{{.State.Status}}' ]]; then
      printf '%s\n' "${test_inactive_status}"
    elif [[ "${container_name}" == "traefik-manager-dockerproxy" ]]; then
      printf '%s\n' "${test_dockerproxy_health}"
    else
      return 1
    fi
  }
  is_current_deployment_active blue "${test_version}" "${test_revision}" "${state_file}"
  ! is_current_deployment_active blue v1.2.4 "${test_revision}" "${state_file}"
  ! is_current_deployment_active blue "${test_version}" deadbeef "${state_file}"
  test_frontend_health="unhealthy"
  ! is_current_deployment_active blue "${test_version}" "${test_revision}" "${state_file}"
  test_frontend_health="healthy"
  test_dockerproxy_health="unhealthy"
  ! is_current_deployment_active blue "${test_version}" "${test_revision}" "${state_file}"
  test_dockerproxy_health="healthy"
  test_inactive_status="running"
  ! is_current_deployment_active blue "${test_version}" "${test_revision}" "${state_file}"
  test_inactive_status="exited"
  printf 'slot=green\nversion=%s\nrevision=%s\n' \
    "${test_version}" "${test_revision}" > "${state_file}"
  ! is_current_deployment_active blue "${test_version}" "${test_revision}" "${state_file}"
  unset -f docker
  "${HISTORY_SCRIPT}" --self-test >/dev/null
  manager_deployment_stage_timing_self_test
  echo "Manager blue-green 배포 self-test 통과"
}
