# 배포 가이드

## Traefik Manager compose

- `frontend`는 `https://<FRONTEND_DOMAIN>`로 외부 노출됩니다.
- `FRONTEND_DOMAIN`은 Traefik 라우팅뿐 아니라 Next.js `metadataBase` 기준 URL로도 사용됩니다. 호스트명만 넣으면 빌드 시 `https://` 기준으로 처리됩니다.
- `backend`는 기본 권장 구성이면 프론트의 `/api` 리버스 프록시를 통해서만 접근합니다.
- `NEXT_PUBLIC_API_URL`은 브라우저 번들에 포함되므로 운영 권장값은 고정 상대 경로인 `/api/v1`입니다.
- 실제 백엔드 업스트림 전환은 `BACKEND_UPSTREAM_URL`로 처리합니다. Next.js가 컨테이너 시작 시 이 값을 읽어 `/api/*`를 백엔드로 프록시합니다.
- `FRONTEND_DOMAIN`을 바꾸면 프런트 이미지를 다시 빌드해야 메타데이터 절대 URL에도 반영됩니다.
- 생성되는 HTTPS 라우터는 `TRAEFIK_TLS_CERT_RESOLVER`를 `tls.certResolver`로 사용합니다. 기본값은 `letsencrypt`이며, 빈 값이면 자동 발급을 명시적으로 끕니다.
- 인증서 만료 모니터는 Traefik API와 ACME 저장소를 함께 읽습니다. backend가 `/acme.json`을 직접 못 읽는 경우에는 Docker socket을 통해 `TRAEFIK_DOCKER_CONTAINER_NAME`의 `TRAEFIK_ACME_STORAGE_PATH`를 fallback으로 읽습니다.
- Docker socket을 backend에서 읽어야 하는 기능(컨테이너 자동 감지, 인증서 ACME fallback)을 쓰려면 `DOCKER_SOCKET_GID`를 호스트의 `/var/run/docker.sock` 그룹 ID와 맞춰야 합니다. 예: `stat -c '%g' /var/run/docker.sock`
- `Traefik 디버그 대시보드` public route를 Manager에서 제어하려면 외부 Traefik 정적 설정에 `api.dashboard=true`가 켜져 있어야 합니다. Manager는 dashboard 엔진 자체를 토글하지 않고 `api@internal` 라우터만 생성/삭제합니다.
- Cloudflare DNS 자동 연동은 여러 zone을 저장할 수 있습니다. 각 서비스 도메인은 suffix가 가장 구체적으로 일치하는 zone과만 매칭되며, 다른 DNS 제공자를 사용하는 도메인은 자동 제외됩니다.
- Cloudflare를 사용하지 않는 도메인이 섞여 있어도 서비스 라우팅과 인증서 발급에는 영향이 없습니다. 다만 드리프트 진단과 재동기화는 Cloudflare 관리 대상 zone에 속한 도메인만 검사합니다.

## Traefik File Provider 설정

Traefik 컨테이너에도 같은 동적 설정 디렉토리를 마운트해야 합니다.

```yaml
services:
  traefik:
    image: traefik:v3.3
    command:
      - --providers.docker=true
      - --providers.file.directory=/traefik-config/dynamic
      - --providers.file.watch=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=admin@example.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik-config/dynamic:/traefik-config/dynamic
      - ./letsencrypt:/letsencrypt
    networks:
      - proxy-network
```

정적 설정 파일을 쓰는 경우에는 `traefik.yml`에 아래 항목이 필요합니다.

```yaml
providers:
  docker: {}
  file:
    directory: /traefik-config/dynamic
    watch: true
```

## 보안 헤더 배포 원칙

이 프로젝트는 `security-headers@file`를 전역 보안 미들웨어로 사용합니다. 다만 `X-Frame-Options`는 더 이상 전역에서 강제하면 안 됩니다.

이유:
- 일반적인 서비스에는 `DENY`가 적합합니다.
- 그러나 Cockpit처럼 iframe 기반 셸을 사용하는 앱은 `DENY` 설정에서 정상 동작하지 않을 수 있습니다.
- 따라서 전역 값을 `SAMEORIGIN`으로 변경하기보다는, 서비스별 `frame_policy`로 예외를 관리하는 편이 안전합니다.

배포 규칙:
1. `traefik-config/dynamic/security-headers.yml`에는 공통 헤더만 둡니다.
2. `frameDeny` 또는 `customFrameOptionsValue`는 전역 미들웨어에 넣지 않습니다.
3. 서비스 라우터가 `frame_policy`에 따라 개별 frame middleware를 생성합니다.
4. 기본값은 `deny`이며, Cockpit 같은 예외 서비스만 `sameorigin`을 선택합니다.
5. 백엔드 startup 시 기존 서비스 YAML도 다시 생성해 기본값 `deny`가 즉시 재적용되도록 합니다.

운영 예시:
- 일반 SaaS/대시보드: `deny`
- Cockpit, iframe 기반 관리 UI: `sameorigin`
- 외부 임베드가 정말 필요한 서비스: `off` 검토

주의:
- 기존 정적 Traefik 설정이 `security-headers@file`를 엔트리포인트 전체에 붙이고 있어도 괜찮습니다.
- 대신 그 전역 미들웨어 안에는 frame 정책이 없어야 합니다.

## 배포 순서

1. `cp .env.example .env` 후 도메인, 시크릿, 관리자 비밀번호를 실제 값으로 바꿉니다.
2. 기존 Traefik compose 또는 `traefik.yml`에 file provider mount/watch를 추가합니다.
3. 외부 네트워크가 없으면 `docker network create proxy-network`와 `docker network create proxy_net`를 1회씩 실행합니다. 이미 사용 중인 Traefik 네트워크명이 다르면 compose의 외부 네트워크 이름도 함께 맞춰야 합니다.
4. `mkdir -p traefik-config/dynamic`로 디렉토리를 만들고, 리눅스라면 필요 시 `sudo chown -R 10001:10001 traefik-config`를 적용합니다.
5. `security-headers.yml`에 frame 정책이 남아 있지 않은지 확인합니다.
6. `docker compose config`로 변수 치환, 라벨, 네트워크 구성을 확인합니다.
7. `docker compose up --build -d`로 배포합니다.
8. `docker compose logs -f backend`로 시작 로그와 `/traefik-config/dynamic` 권한 오류 여부를 확인합니다.
9. `curl -Ik https://<FRONTEND_DOMAIN>` 또는 브라우저로 로그인 페이지 노출을 확인합니다.

## 검증 체크리스트

- 브라우저에서 `https://<FRONTEND_DOMAIN>` 접속 시 로그인 페이지가 보입니다.
- `curl -Ik https://<FRONTEND_DOMAIN>` 응답이 `200` 또는 `302`입니다.
- 로그인 후 서비스 추가 시 `traefik-config/dynamic/<domain>.yml` 파일이 생성됩니다.
- Traefik 로그 또는 대시보드에서 새 라우터가 반영됩니다.
- `docker compose logs -f backend`에 `/traefik-config/dynamic` 권한 오류가 없습니다.
