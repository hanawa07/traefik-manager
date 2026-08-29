#!/usr/bin/env bash

TM_USER_SYSTEMD_TRANSACTION_ACTIVE=0
TM_USER_SYSTEMD_TRANSACTION_BACKUP_DIR=""
TM_USER_SYSTEMD_TRANSACTION_UNIT_DIR=""
TM_USER_SYSTEMD_TRANSACTION_ACTIVE_SYSTEMCTL_BIN=""

tm_transaction_valid_path() {
  [[ "$1" =~ ^/[A-Za-z0-9_./-]+$ ]]
}

tm_transaction_valid_unit() {
  [[ "$1" =~ ^[A-Za-z0-9_.@:-]+\.(timer|service|path)$ ]]
}

tm_transaction_systemctl() {
  "${TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN:-systemctl}" "$@"
}

tm_snapshot_user_systemd_units() {
  local backup_dir="$1"
  local unit_dir="$2"
  shift 2
  local unit destination present enabled active
  local -A seen=()

  tm_transaction_valid_path "${backup_dir}" || return 2
  tm_transaction_valid_path "${unit_dir}" || return 2
  [[ "$#" -gt 0 && ! -e "${backup_dir}" && ! -L "${backup_dir}" ]] || return 2
  mkdir -p "${backup_dir}/units" || return 1
  chmod 700 "${backup_dir}" "${backup_dir}/units" || return 1
  : > "${backup_dir}/manifest"
  chmod 600 "${backup_dir}/manifest" || return 1

  for unit in "$@"; do
    tm_transaction_valid_unit "${unit}" || return 2
    [[ -z "${seen[${unit}]+x}" ]] || return 2
    seen["${unit}"]=1
    destination="${unit_dir}/${unit}"
    present=0
    if [[ -e "${destination}" || -L "${destination}" ]]; then
      cp -a -- "${destination}" "${backup_dir}/units/${unit}" || return 1
      present=1
    fi
    enabled=-
    active=-
    if [[ "${unit}" == *.timer || "${unit}" == *.path ]]; then
      enabled=0
      active=0
      if [[ "${present}" == 1 ]]; then
        tm_transaction_systemctl --user is-enabled --quiet "${unit}" && enabled=1
        tm_transaction_systemctl --user is-active --quiet "${unit}" && active=1
      fi
    fi
    printf '%s|%s|%s|%s\n' "${unit}" "${present}" "${enabled}" "${active}" \
      >> "${backup_dir}/manifest"
  done
}

tm_rollback_user_systemd_units() {
  local backup_dir="$1"
  local unit_dir="$2"
  local unit present enabled active extra destination failed=0

  tm_transaction_valid_path "${backup_dir}" || return 2
  tm_transaction_valid_path "${unit_dir}" || return 2
  [[ -d "${backup_dir}/units" && -f "${backup_dir}/manifest" \
    && ! -L "${backup_dir}/manifest" ]] || return 2

  while IFS='|' read -r unit present enabled active extra; do
    tm_transaction_valid_unit "${unit}" || return 2
    [[ -z "${extra}" && "${present}" =~ ^[01]$ ]] || return 2
    if [[ "${unit}" == *.timer || "${unit}" == *.path ]]; then
      [[ "${enabled}" =~ ^[01]$ && "${active}" =~ ^[01]$ ]] || return 2
      if [[ "${active}" == 0 ]]; then
        tm_transaction_systemctl --user stop "${unit}" || failed=1
      fi
      if [[ "${enabled}" == 0 ]]; then
        tm_transaction_systemctl --user disable "${unit}" || failed=1
      fi
    else
      [[ "${enabled}" == - && "${active}" == - ]] || return 2
    fi
  done < "${backup_dir}/manifest"

  while IFS='|' read -r unit present _enabled _active extra; do
    [[ -z "${extra}" ]] || return 2
    destination="${unit_dir}/${unit}"
    rm -f -- "${destination}" || failed=1
    if [[ "${present}" == 1 ]]; then
      [[ -e "${backup_dir}/units/${unit}" || -L "${backup_dir}/units/${unit}" ]] \
        || return 2
      cp -a -- "${backup_dir}/units/${unit}" "${destination}" || failed=1
    fi
  done < "${backup_dir}/manifest"

  tm_transaction_systemctl --user daemon-reload || failed=1
  while IFS='|' read -r unit present enabled active extra; do
    [[ -z "${extra}" ]] || return 2
    [[ ( "${unit}" == *.timer || "${unit}" == *.path ) && "${present}" == 1 ]] || continue
    if [[ "${enabled}" == 1 ]]; then
      tm_transaction_systemctl --user is-enabled --quiet "${unit}" \
        || tm_transaction_systemctl --user enable "${unit}" || failed=1
    fi
    if [[ "${active}" == 1 ]]; then
      tm_transaction_systemctl --user is-active --quiet "${unit}" \
        || tm_transaction_systemctl --user start "${unit}" || failed=1
    fi
  done < "${backup_dir}/manifest"
  [[ "${failed}" == 0 ]]
}

tm_begin_user_systemd_unit_transaction() {
  local backup_dir="$1"
  local unit_dir="$2"
  shift 2

  [[ "${TM_USER_SYSTEMD_TRANSACTION_ACTIVE}" == 0 ]] || return 2
  tm_snapshot_user_systemd_units "${backup_dir}" "${unit_dir}" "$@" || return
  TM_USER_SYSTEMD_TRANSACTION_BACKUP_DIR="${backup_dir}"
  TM_USER_SYSTEMD_TRANSACTION_UNIT_DIR="${unit_dir}"
  TM_USER_SYSTEMD_TRANSACTION_ACTIVE_SYSTEMCTL_BIN="${TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN:-systemctl}"
  TM_USER_SYSTEMD_TRANSACTION_ACTIVE=1
}

tm_commit_user_systemd_unit_transaction() {
  [[ "${TM_USER_SYSTEMD_TRANSACTION_ACTIVE}" == 1 ]] || return 2
  TM_USER_SYSTEMD_TRANSACTION_ACTIVE=0
  TM_USER_SYSTEMD_TRANSACTION_BACKUP_DIR=""
  TM_USER_SYSTEMD_TRANSACTION_UNIT_DIR=""
  TM_USER_SYSTEMD_TRANSACTION_ACTIVE_SYSTEMCTL_BIN=""
}

tm_finish_user_systemd_unit_transaction() {
  local exit_status="$1"
  local rollback_status=0

  [[ "${exit_status}" =~ ^([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$ ]] || return 2
  if [[ "${TM_USER_SYSTEMD_TRANSACTION_ACTIVE}" == 1 ]]; then
    echo "사용자 systemd 변경이 완료되지 않아 기존 unit 상태를 복구합니다" >&2
    TM_USER_SYSTEMD_TRANSACTION_SYSTEMCTL_BIN="${TM_USER_SYSTEMD_TRANSACTION_ACTIVE_SYSTEMCTL_BIN}" \
      tm_rollback_user_systemd_units \
        "${TM_USER_SYSTEMD_TRANSACTION_BACKUP_DIR}" \
        "${TM_USER_SYSTEMD_TRANSACTION_UNIT_DIR}" || rollback_status=$?
    TM_USER_SYSTEMD_TRANSACTION_ACTIVE=0
    TM_USER_SYSTEMD_TRANSACTION_BACKUP_DIR=""
    TM_USER_SYSTEMD_TRANSACTION_UNIT_DIR=""
    TM_USER_SYSTEMD_TRANSACTION_ACTIVE_SYSTEMCTL_BIN=""
    if [[ "${rollback_status}" -ne 0 ]]; then
      echo "기존 사용자 systemd unit 상태 자동 복구에 실패했습니다" >&2
      return 1
    fi
    if [[ "${exit_status}" -eq 0 ]]; then
      echo "커밋되지 않은 사용자 systemd 변경을 복구했습니다" >&2
      return 1
    fi
  fi
  return "${exit_status}"
}
