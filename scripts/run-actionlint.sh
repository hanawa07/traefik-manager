#!/usr/bin/env bash
set -euo pipefail

readonly ACTIONLINT_VERSION="1.7.12"
readonly RELEASE_BASE_URL="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}"

platform=""
checksum=""
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64)
    platform="linux_amd64"
    checksum="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
    ;;
  Linux/aarch64|Linux/arm64)
    platform="linux_arm64"
    checksum="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
    ;;
  Darwin/x86_64)
    platform="darwin_amd64"
    checksum="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644"
    ;;
  Darwin/arm64)
    platform="darwin_arm64"
    checksum="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f"
    ;;
  *)
    printf '지원하지 않는 actionlint 플랫폼입니다: %s/%s\n' "$(uname -s)" "$(uname -m)" >&2
    exit 2
    ;;
esac

readonly platform
readonly checksum
readonly archive_name="actionlint_${ACTIONLINT_VERSION}_${platform}.tar.gz"
readonly cache_root="${ACTIONLINT_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME:-/tmp}/.cache}/traefik-manager/actionlint}"
readonly version_cache_dir="${cache_root}/${ACTIONLINT_VERSION}"
readonly archive_path="${version_cache_dir}/${archive_name}"

verify_checksum() {
  local file_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s  %s\n' "${checksum}" "${file_path}" | sha256sum --check --status
    return
  fi
  printf '%s  %s\n' "${checksum}" "${file_path}" | shasum -a 256 --check --status
}

download_archive() {
  local temporary_archive
  temporary_archive="$(mktemp "${archive_path}.tmp.XXXXXX")"
  trap 'rm -f "${temporary_archive}"' RETURN
  curl --fail --location --silent --show-error --retry 3 \
    "${RELEASE_BASE_URL}/${archive_name}" \
    --output "${temporary_archive}"
  if ! verify_checksum "${temporary_archive}"; then
    printf 'actionlint v%s 다운로드 체크섬이 일치하지 않습니다.\n' "${ACTIONLINT_VERSION}" >&2
    exit 1
  fi
  mv "${temporary_archive}" "${archive_path}"
  trap - RETURN
}

mkdir -p "${version_cache_dir}"
if [[ ! -f "${archive_path}" ]] || ! verify_checksum "${archive_path}"; then
  rm -f "${archive_path}"
  download_archive
fi

runtime_dir="$(mktemp -d "${version_cache_dir}/run.XXXXXX")"
trap 'rm -rf "${runtime_dir}"' EXIT
tar -xzf "${archive_path}" -C "${runtime_dir}" actionlint

# Optional host linters would make local and CI results differ.
"${runtime_dir}/actionlint" -shellcheck= -pyflakes= "$@"
