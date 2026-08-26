#!/usr/bin/env bash

# Deployment helpers are initialized by blue-green-deploy.sh before this check runs.
# shellcheck disable=SC2154

run_blue_green_deploy_self_test() {
  local temporary_dir route_file curl_log
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
  "${HISTORY_SCRIPT}" --self-test >/dev/null
  manager_deployment_stage_timing_self_test
  echo "Manager blue-green 배포 self-test 통과"
}
