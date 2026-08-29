#!/usr/bin/env bash
set -euo pipefail

readonly LOG_FILE="${HOME}/.openclaw/logs/postboot-healthcheck.log"
readonly HEALTH_URL="https://ubuntu.starling-cloud.ts.net:8443"
mkdir -p "$(dirname "${LOG_FILE}")"
timestamp="$(date '+%F %T %Z')"
{
  echo "[${timestamp}] start postboot healthcheck"
  echo "- tailscale status:"
  tailscale status | head -5 || true
  echo "- tailscale serve status:"
  tailscale serve status || true
  echo "- local gateway 18789:"
  ss -ltn '( sport = :18789 )' || true
  echo "- https 8443 check:"
  curl --fail --silent --show-error --insecure --max-time 5 "${HEALTH_URL}" > /dev/null \
    && echo "  OK: 8443 reachable" \
    || echo "  WARN: 8443 not reachable"
  echo "[${timestamp}] end postboot healthcheck"
  echo
} >> "${LOG_FILE}" 2>&1
