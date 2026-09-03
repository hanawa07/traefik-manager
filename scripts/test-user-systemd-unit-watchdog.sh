#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
readonly SCRIPT_DIR TEMP_DIR
readonly FAKE_BIN="${TEMP_DIR}/bin"
readonly STATE_DIR="${TEMP_DIR}/state"
readonly MODE_FILE="${TEMP_DIR}/mode"
readonly ALERT_LOG="${TEMP_DIR}/alert.log"
readonly SYSTEMCTL_LOG="${TEMP_DIR}/systemctl.log"
readonly BASELINE_FILE="${STATE_DIR}/baseline.sha256"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${FAKE_BIN}" "${STATE_DIR}"
cat > "${FAKE_BIN}/systemctl" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "${TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG}"
mode="$(<"${TM_USER_SYSTEMD_TEST_MODE_FILE}")"
case "${2:-}" in
  list-unit-files)
    if [[ "${mode}" != "timer-disabled" ]]; then
      printf '%s\n' 'sample.timer enabled enabled'
    fi
    if [[ "${mode}" == "new-timer" ]]; then
      printf '%s\n' 'intruder.timer enabled enabled'
    fi
    printf '%s\n' 'traefik-manager-user-systemd-watchdog.timer enabled enabled'
    ;;
  show)
    unit="${3:-}"
    property=""
    for argument in "$@"; do
      [[ "${argument}" == --property=* ]] && property="${argument#--property=}"
    done
    case "${property}" in
      ActiveState)
        if [[ "${mode}" == "timer-disabled" && "${unit}" == "sample.timer" ]]; then
          printf '%s\n' inactive
        elif [[ "${mode}" == "service-failed" && "${unit}" == "sample.service" ]]; then
          printf '%s\n' failed
        elif [[ "${mode}" == "self-failed" \
          && "${unit}" == "traefik-manager-user-systemd-watchdog.service" ]]; then
          printf '%s\n' failed
        elif [[ "${unit}" == *.timer ]]; then
          printf '%s\n' active
        else
          printf '%s\n' inactive
        fi
        ;;
      Triggers)
        printf '%s\n' "${unit%.timer}.service"
        ;;
      LoadState)
        printf '%s\n' loaded
        ;;
      Result)
        [[ ( "${mode}" == "service-failed" && "${unit}" == "sample.service" ) \
          || ( "${mode}" == "self-failed" \
            && "${unit}" == "traefik-manager-user-systemd-watchdog.service" ) ]] \
          && printf '%s\n' exit-code || printf '%s\n' success
        ;;
      ExecMainStatus)
        [[ "${mode}" == "service-failed" && "${unit}" == "sample.service" ]] \
          && printf '%s\n' 1 || printf '%s\n' 0
        ;;
      *) exit 2 ;;
    esac
    ;;
  is-enabled)
    unit="${@: -1}"
    if [[ "${mode}" == "timer-disabled" && "${unit}" == "sample.timer" ]]; then
      printf '%s\n' disabled
      exit 1
    fi
    printf '%s\n' enabled
    ;;
  cat)
    unit="${3:-}"
    if [[ "${unit}" == "sample.service" \
      && "${mode}" =~ ^(drift|drift-and-unrelated|new-timer|intruder-disabled|intruder-disabled-drift)$ ]]; then
      printf 'unit=%s;version=2\n' "${unit}"
    elif [[ "${mode}" =~ ^(drift-and-unrelated|intruder-disabled-drift)$ \
      && "${unit}" == "sample.timer" ]]; then
      printf 'unit=%s;version=2\n' "${unit}"
    else
      printf 'unit=%s;version=1\n' "${unit}"
    fi
    ;;
  *) exit 2 ;;
esac
SCRIPT
cat > "${FAKE_BIN}/alert" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "${TM_USER_SYSTEMD_TEST_ALERT_LOG}"
SCRIPT
chmod 700 "${FAKE_BIN}/systemctl" "${FAKE_BIN}/alert"

run_watchdog() {
  local now="$1"
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
  TM_USER_SYSTEMD_ALERT_SCRIPT="${FAKE_BIN}/alert" \
  TM_USER_SYSTEMD_FAILURE_THRESHOLD=2 \
  TM_USER_SYSTEMD_COOLDOWN_SECONDS=1000 \
  TM_USER_SYSTEMD_NOW_EPOCH="${now}" \
  TM_USER_SYSTEMD_TEST_MODE_FILE="${MODE_FILE}" \
  TM_USER_SYSTEMD_TEST_ALERT_LOG="${ALERT_LOG}" \
  TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    "${SCRIPT_DIR}/user-systemd-unit-watchdog.sh"
}

write_baseline() {
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
  TM_USER_SYSTEMD_TEST_MODE_FILE="${MODE_FILE}" \
  TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    "${SCRIPT_DIR}/user-systemd-unit-watchdog.sh" --write-baseline
}

refresh_baseline() {
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
  TM_USER_SYSTEMD_TEST_MODE_FILE="${MODE_FILE}" \
  TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    "${SCRIPT_DIR}/user-systemd-unit-watchdog.sh" --refresh-baseline "$@"
}

retire_baseline() {
  TM_USER_SYSTEMD_WATCHDOG_STATE_DIR="${STATE_DIR}" \
  TM_USER_SYSTEMD_BASELINE_FILE="${BASELINE_FILE}" \
  TM_USER_SYSTEMD_SYSTEMCTL_BIN="${FAKE_BIN}/systemctl" \
  TM_USER_SYSTEMD_TEST_MODE_FILE="${MODE_FILE}" \
  TM_USER_SYSTEMD_TEST_SYSTEMCTL_LOG="${SYSTEMCTL_LOG}" \
    "${SCRIPT_DIR}/user-systemd-unit-watchdog.sh" --retire-baseline "$@"
}

printf '%s' healthy > "${MODE_FILE}"
write_baseline
[[ "$(wc -l < "${BASELINE_FILE}")" -eq 4 ]]
grep -Eq '^[a-f0-9]{64} timer sample.timer$' "${BASELINE_FILE}"
grep -Eq '^[a-f0-9]{64} service sample.service$' "${BASELINE_FILE}"
cp "${BASELINE_FILE}" "${TEMP_DIR}/initial-baseline"
if write_baseline > "${TEMP_DIR}/duplicate-write.out" 2>&1; then
  echo "기존 기준선 전체 덮어쓰기가 허용되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/initial-baseline" "${BASELINE_FILE}"
grep -Fq '명시적 unit 제한 갱신을 사용하세요' "${TEMP_DIR}/duplicate-write.out"

run_watchdog 100
grep -Fxq 'status=healthy' "${STATE_DIR}/user-systemd-unit-watchdog.state"
[[ ! -s "${ALERT_LOG}" ]]

printf '%s' self-failed > "${MODE_FILE}"
run_watchdog 105
grep -Fxq 'status=healthy' "${STATE_DIR}/user-systemd-unit-watchdog.state"
refresh_baseline sample.service

printf '%s' timer-disabled > "${MODE_FILE}"
run_watchdog 110
grep -Fxq 'consecutive_failures=1' "${STATE_DIR}/user-systemd-unit-watchdog.state"
[[ ! -s "${ALERT_LOG}" ]]
run_watchdog 120
[[ "$(wc -l < "${ALERT_LOG}")" -eq 1 ]]
grep -Fq 'timer-disabled:sample.timer' "${ALERT_LOG}"
if grep -Fq 'timer-inactive:sample.timer' "${ALERT_LOG}"; then
  echo "장애 알림에 대표 원인 외의 상세가 포함되었습니다" >&2
  exit 1
fi
run_watchdog 130
[[ "$(wc -l < "${ALERT_LOG}")" -eq 1 ]]

printf '%s' healthy > "${MODE_FILE}"
run_watchdog 140
[[ "$(wc -l < "${ALERT_LOG}")" -eq 2 ]]
grep -Fq $'\trecovery' "${ALERT_LOG}"

rm -f "${STATE_DIR}/user-systemd-unit-watchdog.state"
printf '%s' service-failed > "${MODE_FILE}"
run_watchdog 200
run_watchdog 210
grep -Fq 'service-failed:sample.service' "${ALERT_LOG}"

rm -f "${STATE_DIR}/user-systemd-unit-watchdog.state"
printf '%s' drift > "${MODE_FILE}"
run_watchdog 300
run_watchdog 310
grep -Fq 'unit-drift:sample.service' "${ALERT_LOG}"
[[ "$(stat --format='%a' "${STATE_DIR}/user-systemd-unit-watchdog.state")" == "644" ]]

old_service_hash="$(awk '$3 == "sample.service" { print $1 }' "${BASELINE_FILE}")"
refresh_baseline sample.service
new_service_hash="$(awk '$3 == "sample.service" { print $1 }' "${BASELINE_FILE}")"
[[ "${old_service_hash}" != "${new_service_hash}" ]]
[[ "$(stat --format='%a' "${BASELINE_FILE}")" == "644" ]]
exec 8>"${STATE_DIR}/user-systemd-unit-watchdog.lock"
flock -n 8
if refresh_baseline sample.service > "${TEMP_DIR}/locked.out" 2>&1; then
  echo "잠긴 기준선 갱신이 성공으로 처리되었습니다" >&2
  exit 1
fi
grep -Fq '기준선이 다른 점검에서 사용 중입니다' "${TEMP_DIR}/locked.out"
flock -u 8
rm -f "${STATE_DIR}/user-systemd-unit-watchdog.state"
run_watchdog 400
grep -Fxq 'status=healthy' "${STATE_DIR}/user-systemd-unit-watchdog.state"

cp "${BASELINE_FILE}" "${TEMP_DIR}/accepted-baseline"
printf '%s' timer-disabled > "${MODE_FILE}"
if refresh_baseline sample.timer > "${TEMP_DIR}/removed-unit.out" 2>&1; then
  echo "기존 unit 삭제가 기준선 갱신에 포함되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/accepted-baseline" "${BASELINE_FILE}"
grep -Fq '기존 unit 삭제는 허용되지 않습니다' "${TEMP_DIR}/removed-unit.out"

printf '%s' service-failed > "${MODE_FILE}"
if refresh_baseline sample.service > "${TEMP_DIR}/failed-service.out" 2>&1; then
  echo "실패 상태 service가 기준선 갱신에 포함되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/accepted-baseline" "${BASELINE_FILE}"
grep -Fq '실패 상태 service는 기준선에 포함할 수 없습니다' \
  "${TEMP_DIR}/failed-service.out"

printf '%s' drift-and-unrelated > "${MODE_FILE}"
if refresh_baseline sample.service > "${TEMP_DIR}/unrelated-drift.out" 2>&1; then
  echo "허용하지 않은 unit 변경이 기준선에 포함되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/accepted-baseline" "${BASELINE_FILE}"
grep -Fq '허용되지 않은 unit 변경: sample.timer' "${TEMP_DIR}/unrelated-drift.out"

printf '%s' new-timer > "${MODE_FILE}"
if refresh_baseline sample.service > "${TEMP_DIR}/unexpected-timer.out" 2>&1; then
  echo "허용하지 않은 신규 timer가 기준선에 포함되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/accepted-baseline" "${BASELINE_FILE}"
grep -Fq '허용되지 않은 unit 추가: intruder.' "${TEMP_DIR}/unexpected-timer.out"
refresh_baseline intruder.timer intruder.service
[[ "$(wc -l < "${BASELINE_FILE}")" -eq 6 ]]
grep -Eq '^[a-f0-9]{64} timer intruder.timer$' "${BASELINE_FILE}"
grep -Eq '^[a-f0-9]{64} service intruder.service$' "${BASELINE_FILE}"

cp "${BASELINE_FILE}" "${TEMP_DIR}/before-retire-baseline"
if retire_baseline intruder.timer intruder.service > "${TEMP_DIR}/active-retire.out" 2>&1; then
  echo "활성 unit이 기준선에서 폐기되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/before-retire-baseline" "${BASELINE_FILE}"
grep -Fq '폐기 대상 unit이 아직 활성 기준선에 있습니다: intruder.' \
  "${TEMP_DIR}/active-retire.out"

printf '%s' intruder-disabled > "${MODE_FILE}"
if retire_baseline intruder.timer > "${TEMP_DIR}/partial-retire.out" 2>&1; then
  echo "연결 service를 제외한 timer 폐기가 허용되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/before-retire-baseline" "${BASELINE_FILE}"
grep -Fq '기존 unit 삭제는 허용되지 않습니다: intruder.service' \
  "${TEMP_DIR}/partial-retire.out"

printf '%s' intruder-disabled-drift > "${MODE_FILE}"
if retire_baseline intruder.timer intruder.service > "${TEMP_DIR}/drift-retire.out" 2>&1; then
  echo "다른 unit 변경과 함께 기준선 폐기가 허용되었습니다" >&2
  exit 1
fi
cmp "${TEMP_DIR}/before-retire-baseline" "${BASELINE_FILE}"
grep -Fq '허용되지 않은 unit 변경: sample.timer' "${TEMP_DIR}/drift-retire.out"

printf '%s' intruder-disabled > "${MODE_FILE}"
retire_baseline intruder.timer intruder.service
[[ "$(wc -l < "${BASELINE_FILE}")" -eq 4 ]]
if grep -Eq ' intruder\.(timer|service)$' "${BASELINE_FILE}"; then
  echo "폐기 unit이 기준선에 남았습니다" >&2
  exit 1
fi
run_watchdog 500
grep -Fxq 'status=healthy' "${STATE_DIR}/user-systemd-unit-watchdog.state"

echo "사용자 systemd timer·service watchdog 통합 시험 통과"
