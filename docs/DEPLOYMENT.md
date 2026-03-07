# 배포 가이드

## Traefik Manager compose

- `frontend`는 `https://<FRONTEND_DOMAIN>`로 외부 노출됩니다.
- `backend`는 기본 권장 구성이면 프론트의 `/api` 리버스 프록시를 통해 접근합니다.
- 현재 compose에는 `BACKEND_DOMAIN` 라우터도 포함했지만, 운영에서는 직접 API 공개가 꼭 필요하지 않으면 사용하지 않는 편이 안전합니다.
- `NEXT_PUBLIC_API_URL`은 브라우저 번들에 포함되므로 운영 권장값은 고정 상대 경로인 `/api/v1`입니다.
- 실제 백엔드 업스트림 전환은 `BACKEND_UPSTREAM_URL`로 처리합니다. Next.js가 컨테이너 시작 시 이 값을 읽어 `/api/*`를 백엔드로 프록시합니다.

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

## 배포 순서

1. `cp .env.example .env` 후 도메인, 시크릿, 관리자 비밀번호를 실제 값으로 바꿉니다.
2. 기존 Traefik compose 또는 `traefik.yml`에 file provider mount/watch를 추가합니다.
3. 외부 네트워크가 없으면 `docker network create proxy-network`를 1회 실행합니다.
4. `mkdir -p traefik-config/dynamic`로 디렉토리를 만들고, 리눅스라면 필요 시 `sudo chown -R 10001:10001 traefik-config`를 적용합니다.
5. `docker compose config`로 변수 치환, 라벨, 네트워크 구성을 확인합니다.
6. `docker compose up --build -d`로 배포합니다.
7. `docker compose logs -f backend`로 시작 로그와 `/traefik-config/dynamic` 권한 오류 여부를 확인합니다.
8. `curl -Ik https://<FRONTEND_DOMAIN>` 또는 브라우저로 로그인 페이지 노출을 확인합니다.

## 검증 체크리스트

- 브라우저에서 `https://<FRONTEND_DOMAIN>` 접속 시 로그인 페이지가 보입니다.
- `curl -Ik https://<FRONTEND_DOMAIN>` 응답이 `200` 또는 `302`입니다.
- 로그인 후 서비스 추가 시 `traefik-config/dynamic/<domain>.yml` 파일이 생성됩니다.
- Traefik 로그 또는 대시보드에서 새 라우터가 반영됩니다.
- `docker compose logs -f backend`에 `/traefik-config/dynamic` 권한 오류가 없습니다.
