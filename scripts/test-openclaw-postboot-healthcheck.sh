#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly HOME_DIR="${TEMP_DIR}/home"
readonly CURL_LOG="${TEMP_DIR}/curl.log"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${HOME_DIR}"
cat > "${FAKE_BIN}/tailscale" <<'SCRIPT'
#!/usr/bin/env bash
printf 'fake tailscale %s\n' "$*"
SCRIPT
cat > "${FAKE_BIN}/ss" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' 'LISTEN 0 4096 127.0.0.1:18789'
SCRIPT
cat > "${FAKE_BIN}/curl" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_OPENCLAW_TEST_CURL_LOG}"
[[ "${TM_OPENCLAW_TEST_CURL_FAIL:-0}" != 1 ]]
SCRIPT
chmod 700 "${FAKE_BIN}/tailscale" "${FAKE_BIN}/ss" "${FAKE_BIN}/curl"

HOME="${HOME_DIR}" \
TM_OPENCLAW_TEST_CURL_LOG="${CURL_LOG}" \
PATH="${FAKE_BIN}:/usr/bin:/bin" \
  "${SCRIPT_DIR}/openclaw-postboot-healthcheck.sh"

log_file="${HOME_DIR}/.openclaw/logs/postboot-healthcheck.log"
grep -Fq 'OK: 8443 reachable' "${log_file}"
grep -Fq -- '--fail --silent --show-error --insecure --max-time 5' "${CURL_LOG}"

HOME="${HOME_DIR}" \
TM_OPENCLAW_TEST_CURL_LOG="${CURL_LOG}" \
TM_OPENCLAW_TEST_CURL_FAIL=1 \
PATH="${FAKE_BIN}:/usr/bin:/bin" \
  "${SCRIPT_DIR}/openclaw-postboot-healthcheck.sh"
grep -Fq 'WARN: 8443 not reachable' "${log_file}"

echo "OpenClaw post-boot 점검 무네트워크 self-test 통과"
