#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly HOME_DIR="${TEMP_DIR}/home"
readonly DOCKER_LOG="${TEMP_DIR}/docker.log"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${HOME_DIR}"
cat > "${FAKE_BIN}/dig" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' '192.0.2.10'
SCRIPT
cat > "${FAKE_BIN}/docker" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_DNS_TEST_DOCKER_LOG}"
if [[ "$1 $2 ${3:-}" == "network inspect bridge" ]]; then
  exit 0
fi
if [[ "$1" == run ]]; then
  exit 0
fi
exit 1
SCRIPT
chmod 700 "${FAKE_BIN}/dig" "${FAKE_BIN}/docker"

HOME="${HOME_DIR}" \
DOCKER_DNS_PROBE_PATH="${FAKE_BIN}:/usr/bin:/bin" \
TM_DNS_TEST_DOCKER_LOG="${DOCKER_LOG}" \
  "${SCRIPT_DIR}/docker-dns-probe.sh"

log_file="${HOME_DIR}/logs/docker-dns-probe.log"
grep -Fq 'BEGIN hourly_dns_probe' "${log_file}"
grep -Fq 'END hourly_dns_probe' "${log_file}"
[[ "$(grep -Fc 'OK host_dig ' "${log_file}")" == 8 ]]
[[ "$(grep -Fc 'OK docker_nslookup network=bridge ' "${log_file}")" == 1 ]]
[[ "$(grep -Fc 'SKIP docker_nslookup ' "${log_file}")" == 5 ]]
if grep -Fq 'FAIL ' "${log_file}"; then
  echo "가짜 DNS 정상 응답이 실패로 기록되었습니다" >&2
  exit 1
fi

echo "Docker DNS probe 무네트워크 self-test 통과"
