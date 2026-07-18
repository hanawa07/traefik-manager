#!/bin/sh
set -eu

config_root=${TRAEFIK_CONFIG_ROOT:-/traefik-config}
dynamic_dir="${config_root}/dynamic"
runtime_dir="${config_root}/.runtime"
target="${dynamic_dir}/traefik-manager-self.yml"
temporary="${target}.tmp"
manager_upstream=${TRAEFIK_MANAGER_FRONTEND_UPSTREAM:-http://traefik-manager-frontend:3000}

case "${FRONTEND_DOMAIN:-}" in
  ""|*[!A-Za-z0-9.-]*)
    echo "FRONTEND_DOMAIN이 올바른 도메인이 아닙니다" >&2
    exit 1
    ;;
esac

case "$manager_upstream" in
  http://traefik-manager-frontend:3000|http://traefik-manager-frontend-blue:3000|http://traefik-manager-frontend-green:3000)
    ;;
  *)
    echo "TRAEFIK_MANAGER_FRONTEND_UPSTREAM이 허용된 Manager frontend 주소가 아닙니다" >&2
    exit 1
    ;;
esac

mkdir -p "$dynamic_dir" "$runtime_dir"
cat > "$temporary" <<EOF
http:
  routers:
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
  services:
    traefik-manager-frontend-file:
      loadBalancer:
        servers:
          - url: "${manager_upstream}"
  middlewares:
    traefik-manager-frontend-https-file:
      redirectScheme:
        scheme: https
        permanent: true
EOF
chmod 0644 "$temporary"
mv "$temporary" "$target"
chown -R 10001:10001 "$config_root"
chmod 2775 "$config_root"
chmod 2770 "$runtime_dir"
