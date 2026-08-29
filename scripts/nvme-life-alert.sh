#!/usr/bin/env bash
set -euo pipefail

WARN_THRESHOLD="${NVME_LIFE_WARN_THRESHOLD:-80}"
CRITICAL_THRESHOLD="${NVME_LIFE_CRITICAL_THRESHOLD:-90}"
EXHAUSTED_THRESHOLD="${NVME_LIFE_EXHAUSTED_THRESHOLD:-100}"
MAIL_TO="${NVME_LIFE_MAIL_TO:-root}"
STATE_DIR="${NVME_LIFE_STATE_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}/nvme-life-alert}"
DOCKER_IMAGE="${NVME_LIFE_DOCKER_IMAGE:-ubuntu:22.04}"
HOST_MOUNT="${NVME_LIFE_HOST_MOUNT:-/host}"

mkdir -p "${STATE_DIR}"

declare -A DEVICE_LABELS=(
  ["/dev/nvme0n1"]="root Samsung SSD 980 1TB"
  ["/dev/nvme1n1"]="cache/Immich WD Blue SN580 1TB"
)

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"
}

slug() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'
}

read_nvme_smart() {
  local device="$1"
  docker run --rm \
    --privileged \
    --pid=host \
    --net=host \
    --ipc=host \
    --uts=host \
    -v /:"${HOST_MOUNT}":ro \
    "${DOCKER_IMAGE}" \
    chroot "${HOST_MOUNT}" /usr/sbin/nvme smart-log "${device}"
}

field_number() {
  local pattern="$1"
  awk -F: -v pattern="${pattern}" '
    $1 ~ pattern {
      value=$2
      gsub(/[^0-9]/, "", value)
      if (value == "") value=0
      print value + 0
      exit
    }
  '
}

send_alert() {
  local subject="$1"
  local body="$2"
  printf '%s\n' "${body}" | mail -s "${subject}" "${MAIL_TO}"
}

status_lines=()
sent_any=0
failed_any=0

for device in "${!DEVICE_LABELS[@]}"; do
  label="${DEVICE_LABELS[${device}]}"
  state_file="${STATE_DIR}/$(slug "${device}").state"
  output_file="${STATE_DIR}/$(slug "${device}").last-smart-log.txt"

  if ! smart_output="$(read_nvme_smart "${device}" 2>&1)"; then
    failed_any=1
    previous_failure_sent="$(awk -F= '$1=="failure_sent"{print $2}' "${state_file}" 2>/dev/null || true)"
    if [[ "${previous_failure_sent}" != "1" ]]; then
      send_alert \
        "[SMART] NVMe check failed: ${device}" \
        "NVMe SMART lifetime check failed.

Device: ${device}
Label: ${label}
Host: $(hostname)
Time: $(date '+%Y-%m-%d %H:%M:%S %Z')

Output:
${smart_output}"
      sent_any=1
    fi
    {
      printf 'failure_sent=1\n'
      printf 'last_failure_at=%s\n' "$(date -Is)"
    } > "${state_file}"
    status_lines+=("${device} ${label}: SMART read failed")
    continue
  fi

  printf '%s\n' "${smart_output}" > "${output_file}"

  percentage_used="$(printf '%s\n' "${smart_output}" | field_number 'percentage_used')"
  available_spare="$(printf '%s\n' "${smart_output}" | field_number 'available_spare[[:space:]]*$')"
  spare_threshold="$(printf '%s\n' "${smart_output}" | field_number 'available_spare_threshold')"
  critical_warning="$(printf '%s\n' "${smart_output}" | field_number 'critical_warning')"
  media_errors="$(printf '%s\n' "${smart_output}" | field_number 'media_errors')"
  error_entries="$(printf '%s\n' "${smart_output}" | field_number 'num_err_log_entries')"
  temperature="$(printf '%s\n' "${smart_output}" | field_number 'temperature[[:space:]]*$')"

  previous_level="$(awk -F= '$1=="level"{print $2}' "${state_file}" 2>/dev/null || true)"
  previous_media_errors="$(awk -F= '$1=="media_errors"{print $2}' "${state_file}" 2>/dev/null || true)"
  previous_error_entries="$(awk -F= '$1=="error_entries"{print $2}' "${state_file}" 2>/dev/null || true)"
  previous_level="${previous_level:-0}"
  previous_media_errors="${previous_media_errors:-0}"
  previous_error_entries="${previous_error_entries:-0}"

  level=0
  reason="OK"

  if (( percentage_used >= EXHAUSTED_THRESHOLD )); then
    level=3
    reason="lifetime exhausted threshold reached"
  elif (( percentage_used >= CRITICAL_THRESHOLD )); then
    level=2
    reason="lifetime critical threshold reached"
  elif (( percentage_used >= WARN_THRESHOLD )); then
    level=1
    reason="lifetime warning threshold reached"
  fi

  if (( critical_warning != 0 )); then
    level=4
    reason="NVMe critical_warning is non-zero"
  elif (( spare_threshold > 0 && available_spare <= spare_threshold )); then
    level=4
    reason="available spare is at or below threshold"
  elif (( media_errors > previous_media_errors )); then
    level=4
    reason="media_errors increased"
  elif (( error_entries > previous_error_entries && error_entries > 0 )); then
    level=4
    reason="num_err_log_entries increased"
  fi

  should_send=0
  if (( level > previous_level && level > 0 )); then
    should_send=1
  fi

  if (( should_send == 1 )); then
    send_alert \
      "[SMART] NVMe alert: ${device} ${percentage_used}% used" \
      "NVMe SMART lifetime alert.

Device: ${device}
Label: ${label}
Host: $(hostname)
Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Reason: ${reason}

percentage_used: ${percentage_used}%
available_spare: ${available_spare}%
available_spare_threshold: ${spare_threshold}%
critical_warning: ${critical_warning}
media_errors: ${media_errors}
num_err_log_entries: ${error_entries}
temperature: ${temperature}C

Thresholds:
warning: ${WARN_THRESHOLD}%
critical: ${CRITICAL_THRESHOLD}%
exhausted: ${EXHAUSTED_THRESHOLD}%

Full SMART log:
${smart_output}"
    sent_any=1
  fi

  {
    printf 'level=%s\n' "${level}"
    printf 'percentage_used=%s\n' "${percentage_used}"
    printf 'available_spare=%s\n' "${available_spare}"
    printf 'spare_threshold=%s\n' "${spare_threshold}"
    printf 'critical_warning=%s\n' "${critical_warning}"
    printf 'media_errors=%s\n' "${media_errors}"
    printf 'error_entries=%s\n' "${error_entries}"
    printf 'temperature=%s\n' "${temperature}"
    printf 'failure_sent=0\n'
    printf 'last_checked_at=%s\n' "$(date -Is)"
  } > "${state_file}"

  status_lines+=("${device} ${label}: ${percentage_used}% used, spare ${available_spare}%, media_errors ${media_errors}, error_entries ${error_entries}, level ${level}")
done

{
  log "NVMe lifetime check completed"
  printf '%s\n' "${status_lines[@]}"
  printf 'sent_any=%s failed_any=%s\n' "${sent_any}" "${failed_any}"
} | tee "${STATE_DIR}/last-run.log"

if (( failed_any != 0 )); then
  exit 1
fi
