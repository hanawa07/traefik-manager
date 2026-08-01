#!/usr/bin/env bash

# Deployment helpers are initialized by blue-green-deploy.sh before this check runs.
# shellcheck disable=SC2154

run_blue_green_deploy_self_test() {
  local temporary_dir route_file
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "${temporary_dir}"' RETURN
  route_file="${temporary_dir}/route.yml"
  printf 'url: "http://traefik-manager-frontend-blue:3000"\n' > "${route_file}"
  [[ "$(infer_active_slot "${route_file}")" == "blue" ]]
  [[ "$(opposite_slot blue)" == "green" ]]
  [[ "$(opposite_slot green)" == "blue" ]]
  [[ "$(upstream_for_slot green)" == "http://traefik-manager-frontend-green:3000" ]]
  [[ "$(backend_for_slot single)" == "traefik-manager-backend" ]]
  "${HISTORY_SCRIPT}" --self-test >/dev/null
  manager_deployment_stage_timing_self_test
  echo "Manager blue-green 배포 self-test 통과"
}
