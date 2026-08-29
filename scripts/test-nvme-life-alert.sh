#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly HOME_DIR="${TEMP_DIR}/home"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly MAIL_LOG="${TEMP_DIR}/mail.log"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${HOME_DIR}"
cat > "${FAKE_BIN}/docker" <<'SCRIPT'
#!/usr/bin/env bash
cat <<'SMART'
critical_warning                    : 0
temperature                         : 31 C
available_spare                     : 100%
available_spare_threshold           : 10%
percentage_used                     : 1%
media_errors                        : 0
num_err_log_entries                 : 0
SMART
SCRIPT
cat > "${FAKE_BIN}/mail" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${TM_NVME_TEST_MAIL_LOG}"
cat >> "${TM_NVME_TEST_MAIL_LOG}"
SCRIPT
chmod 700 "${FAKE_BIN}/docker" "${FAKE_BIN}/mail"

run_check() {
  HOME="${HOME_DIR}" \
  NVME_LIFE_STATE_DIR="${STATE_DIR}" \
  NVME_LIFE_WARN_THRESHOLD=1 \
  NVME_LIFE_MAIL_TO=test@example.invalid \
  TM_NVME_TEST_MAIL_LOG="${MAIL_LOG}" \
  PATH="${FAKE_BIN}:/usr/bin:/bin" \
    "${SCRIPT_DIR}/nvme-life-alert.sh" > /dev/null
}

run_check
[[ "$(grep -Fc -- '-s [SMART] NVMe alert:' "${MAIL_LOG}")" == 2 ]]
[[ "$(find "${STATE_DIR}" -maxdepth 1 -name '*.state' | wc -l)" == 2 ]]
grep -Fq 'sent_any=1 failed_any=0' "${STATE_DIR}/last-run.log"

run_check
[[ "$(grep -Fc -- '-s [SMART] NVMe alert:' "${MAIL_LOG}")" == 2 ]]
grep -Fq 'sent_any=0 failed_any=0' "${STATE_DIR}/last-run.log"

echo "NVMe 수명 알림 무실메일 self-test 통과"
