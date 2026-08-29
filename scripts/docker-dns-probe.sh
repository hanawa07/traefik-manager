#!/usr/bin/env bash
set -u

PATH="${DOCKER_DNS_PROBE_PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
LOG_DIR="${HOME}/logs"
LOG_FILE="${LOG_DIR}/docker-dns-probe.log"
HOSTS=(api.github.com cloudflare.com)
DNS_SERVERS=(168.126.63.1 168.126.63.2 1.1.1.1 8.8.8.8)
DOCKER_NETWORKS=(
  bridge
  proxy_net
  monitor-net
  minecraft_net
  quant-platform_quant-network
  watchtower_watchtower-egress
)

mkdir -p "${LOG_DIR}"

ts() {
  TZ=Asia/Seoul date '+%Y-%m-%dT%H:%M:%S%z'
}

log() {
  printf '%s %s\n' "$(ts)" "$*" >> "${LOG_FILE}"
}

run_check() {
  local label="$1"
  shift
  local output rc

  output="$(timeout 12s "$@" 2>&1)"
  rc=$?
  output="$(printf '%s' "${output}" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g' | cut -c1-240)"

  if [[ "${rc}" -eq 0 ]]; then
    log "OK ${label}"
  else
    log "FAIL ${label} rc=${rc} output=${output}"
  fi
}

log "BEGIN hourly_dns_probe"

if command -v dig >/dev/null 2>&1; then
  for dns_server in "${DNS_SERVERS[@]}"; do
    for host in "${HOSTS[@]}"; do
      run_check "host_dig server=${dns_server} host=${host}" \
        dig @"${dns_server}" "${host}" A +time=2 +tries=1 +short
    done
  done
else
  for host in "${HOSTS[@]}"; do
    run_check "host_resolvectl host=${host}" resolvectl query "${host}"
  done
fi

for network in "${DOCKER_NETWORKS[@]}"; do
  if docker network inspect "${network}" >/dev/null 2>&1; then
    run_check "docker_nslookup network=${network} hosts=${HOSTS[*]}" \
      docker run --rm --pull never --network "${network}" alpine:3.20 sh -ec \
        "nslookup '${HOSTS[0]}' >/dev/null && nslookup '${HOSTS[1]}' >/dev/null"
  else
    log "SKIP docker_nslookup network=${network} reason=missing_network"
  fi
done

log "END hourly_dns_probe"
