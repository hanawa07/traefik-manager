#!/bin/sh
set -eu

mkdir -p /app/data
mkdir -p /traefik-config/dynamic

if [ ! -w /traefik-config/dynamic ]; then
  echo "오류: /traefik-config/dynamic 디렉토리에 쓰기 권한이 없습니다." >&2
  echo "호스트에서 ./traefik-config/dynamic 소유자를 10001:10001로 맞추거나 compose의 init-traefik-config 서비스를 확인하세요." >&2
  ls -ld /traefik-config /traefik-config/dynamic 2>/dev/null || true
  exit 1
fi

exec "$@"
