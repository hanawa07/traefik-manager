#!/bin/sh
set -eu

config_root=${TRAEFIK_CONFIG_ROOT:-/traefik-config}
dynamic_dir="${config_root}/dynamic"
runtime_dir="${config_root}/.runtime"
target="${dynamic_dir}/traefik-manager-self.yml"
temporary="${target}.tmp"
manager_upstream=${TRAEFIK_MANAGER_FRONTEND_UPSTREAM:-http://traefik-manager-frontend:3000}
public_router_enabled=${TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED:-true}
tailnet_router_enabled=${TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED:-false}
tailnet_entrypoint=${TRAEFIK_MANAGER_TAILNET_ENTRYPOINT:-manager-tailnet}

for router_setting in "$public_router_enabled" "$tailnet_router_enabled"; do
  case "$router_setting" in
    true|false)
      ;;
    *)
      echo "Manager 라우터 활성화 값은 true 또는 false여야 합니다" >&2
      exit 1
      ;;
  esac
done

if [ "$public_router_enabled" = false ] && [ "$tailnet_router_enabled" = false ]; then
  echo "공개 또는 Tailnet Manager 라우터를 하나 이상 활성화해야 합니다" >&2
  exit 1
fi

if [ "$public_router_enabled" = true ]; then
  case "${FRONTEND_DOMAIN:-}" in
    ""|*[!A-Za-z0-9.-]*)
      echo "FRONTEND_DOMAIN이 올바른 도메인이 아닙니다" >&2
      exit 1
      ;;
  esac
fi

if [ "$tailnet_router_enabled" = true ]; then
  case "$tailnet_entrypoint" in
    ""|*[!A-Za-z0-9_-]*)
      echo "TRAEFIK_MANAGER_TAILNET_ENTRYPOINT가 올바른 이름이 아닙니다" >&2
      exit 1
      ;;
  esac
fi

case "$manager_upstream" in
  http://traefik-manager-frontend:3000|http://traefik-manager-frontend-blue:3000|http://traefik-manager-frontend-green:3000)
    ;;
  *)
    echo "TRAEFIK_MANAGER_FRONTEND_UPSTREAM이 허용된 Manager frontend 주소가 아닙니다" >&2
    exit 1
    ;;
esac

mkdir -p "$dynamic_dir" "$runtime_dir"
{
  printf '%s\n' 'http:' '  routers:'
  if [ "$public_router_enabled" = true ]; then
    cat <<EOF
    traefik-manager-frontend-file:
      rule: "Host(\`${FRONTEND_DOMAIN}\`)"
      entryPoints:
        - websecure
      service: traefik-manager-frontend-file
      tls:
        certResolver: letsencrypt
    traefik-manager-frontend-http-file:
      rule: "Host(\`${FRONTEND_DOMAIN}\`)"
      entryPoints:
        - web
      middlewares:
        - traefik-manager-frontend-https-file
      service: traefik-manager-frontend-file
EOF
  fi
  if [ "$tailnet_router_enabled" = true ]; then
    cat <<EOF
    traefik-manager-tailnet-file:
      rule: "PathPrefix(\`/\`)"
      entryPoints:
        - ${tailnet_entrypoint}
      middlewares:
        - security-headers@file
      service: traefik-manager-frontend-file
EOF
  fi
  cat <<EOF
  services:
    traefik-manager-frontend-file:
      loadBalancer:
        servers:
          - url: "${manager_upstream}"
EOF
  if [ "$public_router_enabled" = true ]; then
    cat <<'EOF'
  middlewares:
    traefik-manager-frontend-https-file:
      redirectScheme:
        scheme: https
        permanent: true
EOF
  fi
} > "$temporary"
chmod 0644 "$temporary"
mv "$temporary" "$target"
if [ "$(id -u)" -eq 0 ]; then
  chown -R 10001:10001 "$config_root"
fi
chmod 2775 "$config_root"
chmod 2770 "$runtime_dir"
