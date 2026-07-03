#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  VERSION=$(git -C "$REPO_ROOT" describe --tags --match "v[0-9]*" --dirty --always 2>/dev/null || true)
  case "$VERSION" in
    v*) printf '%s\n' "$VERSION"; exit 0 ;;
  esac
fi

PACKAGE_VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$REPO_ROOT/frontend/package.json" | head -n 1)
if [ -n "$PACKAGE_VERSION" ]; then
  printf 'v%s\n' "$PACKAGE_VERSION"
  exit 0
fi

printf 'unknown\n'
