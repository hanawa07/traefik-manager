#!/bin/sh
set -eu

config_root=${TRAEFIK_CONFIG_ROOT:-/traefik-config}
dynamic_dir="${config_root}/dynamic"
target="${dynamic_dir}/traefik-manager-self.yml"
temporary="${target}.tmp"

case "${FRONTEND_DOMAIN:-}" in
  ""|*[!A-Za-z0-9.-]*)
    echo "FRONTEND_DOMAIN이 올바른 도메인이 아닙니다" >&2
    exit 1
    ;;
esac

mkdir -p "$dynamic_dir"
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
          - url: "http://traefik-manager-frontend:3000"
  middlewares:
    traefik-manager-frontend-https-file:
      redirectScheme:
        scheme: https
        permanent: true
EOF
chmod 0644 "$temporary"
mv "$temporary" "$target"
chown -R 10001:10001 "$config_root"
