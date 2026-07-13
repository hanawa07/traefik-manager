# 배포 가이드

## Traefik Manager compose

- `frontend`는 `https://<FRONTEND_DOMAIN>`로 외부 노출됩니다.
- `FRONTEND_DOMAIN`은 Traefik 라우팅뿐 아니라 Next.js `metadataBase` 기준 URL로도 사용됩니다. 호스트명만 넣으면 빌드 시 `https://` 기준으로 처리됩니다.
- `backend`는 기본 권장 구성이면 프론트의 `/api` 리버스 프록시를 통해서만 접근합니다.
- `NEXT_PUBLIC_API_URL`은 브라우저 번들에 포함되므로 운영 권장값은 고정 상대 경로인 `/api/v1`입니다.
- 실제 백엔드 업스트림 전환은 `BACKEND_UPSTREAM_URL`로 처리합니다. Next.js가 컨테이너 시작 시 이 값을 읽어 `/api/*`를 백엔드로 프록시합니다. 기본값은 `http://traefik-manager-backend:8000`입니다.
- 외부 공유 네트워크에 여러 Compose 스택을 붙이는 경우 `backend` 같은 일반 서비스명은 DNS 충돌을 일으킬 수 있으므로, Traefik Manager는 `traefik-manager-backend` 같은 고유 호스트명을 사용하는 구성을 권장합니다.
- `FRONTEND_DOMAIN`을 바꾸면 프런트 이미지를 다시 빌드해야 메타데이터 절대 URL에도 반영됩니다.
- 생성되는 HTTPS 라우터는 `TRAEFIK_TLS_CERT_RESOLVER`를 `tls.certResolver`로 사용합니다. 기본값은 `letsencrypt`이며, 빈 값이면 자동 발급을 명시적으로 끕니다.
- 인증서 만료 모니터는 Traefik API와 ACME 저장소를 함께 읽습니다. backend가 `/acme.json`을 직접 못 읽는 경우에는 Docker socket을 통해 `TRAEFIK_DOCKER_CONTAINER_NAME`의 `TRAEFIK_ACME_STORAGE_PATH`를 fallback으로 읽습니다.
- Docker socket을 backend에서 읽어야 하는 기능(컨테이너 자동 감지, 인증서 ACME fallback)을 쓰려면 `DOCKER_SOCKET_GID`를 호스트의 `/var/run/docker.sock` 그룹 ID와 맞춰야 합니다. 예: `stat -c '%g' /var/run/docker.sock`
- `Traefik 디버그 대시보드` public route를 Manager에서 제어하려면 외부 Traefik 정적 설정에 `api.dashboard=true`가 켜져 있어야 합니다. Manager는 dashboard 엔진 자체를 토글하지 않고 `api@internal` 라우터만 생성/삭제합니다.
- Cloudflare DNS 자동 연동은 여러 zone을 저장할 수 있습니다. 각 서비스 도메인은 suffix가 가장 구체적으로 일치하는 zone과만 매칭되며, 다른 DNS 제공자를 사용하는 도메인은 자동 제외됩니다.
- Cloudflare를 사용하지 않는 도메인이 섞여 있어도 서비스 라우팅과 인증서 발급에는 영향이 없습니다. 다만 드리프트 진단과 재동기화는 Cloudflare 관리 대상 zone에 속한 도메인만 검사합니다.
- Cloudflare 연결 테스트는 zone 접근만 확인합니다. 반면 드리프트 진단은 `dns_records` 목록 조회까지 수행하므로 `Zone:DNS:Read`(또는 `Zone:DNS:Edit`)와 `Zone:Zone:Read` 권한이 모두 필요합니다.
- 드리프트 진단 결과가 `드리프트 0개`이면 오류가 아니라 정상 상태입니다. 이는 Cloudflare 관리 대상 도메인의 DNS 레코드가 Manager가 기대하는 값과 일치한다는 뜻입니다.
- 권장 토큰 권한 구성 예시:
  - 리소스: `Zone` / 권한: `DNS Settings:Edit`
  - 리소스: `Zone` / 권한: `Zone:Read`
  - 리소스: `Zone` / 권한: `DNS:Read`

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

- `curl https://<FRONTEND_DOMAIN>/api/health`가 `{"status":"정상"}`을 반환하며, 이 경로는 frontend를 거쳐 backend까지 확인합니다.
- backend는 자체 `/api/health`, frontend는 backend까지 이어지는 `/api/health`를 Docker healthcheck로 사용하므로 `docker compose ps`에서 둘 다 `healthy`인지 확인합니다. frontend는 backend가 `healthy`가 된 뒤 시작합니다.
- 대시보드 Manager 배포 카드는 Docker 상태를 30초마다 갱신하며, `unhealthy`이면 연속 실패 횟수와 마지막 검사 시각·종료 코드를 표시합니다. 외부 watchdog 상태·연속 실패·마지막 실행과 최근 알림 워크플로 요청 결과·실행 링크·최근 실행 5건의 최종 상태, 결과 확인 시각, 조회 오류도 표시합니다. 최근 실행은 장애·복구와 실행 결과로 즉시 필터링하고 성공·실패·진행·기타 완료 건수를 집계하며 카드에서 직접 새로고침할 수 있습니다. 필터는 URL에 유지되며 적용 조건을 하나씩 제거하거나 전체 초기화할 수 있고, 마지막 수동 갱신 완료 시각을 자동 갱신과 구분해 표시합니다. 설정한 지연 판정 시간이 지나면 상단 경고를 노출하며 healthcheck 원문 출력은 노출하지 않습니다.
- 배포 카드에는 마지막 상태 갱신 시각과 수동 새로고침 버튼이 있으며, unavailable·중지·unhealthy 컴포넌트가 있으면 대시보드 상단에 경고 배너를 표시합니다.
- 배포 카드의 `Manager API 404·5xx 추이`는 backend 컨테이너의 구조화 요청 로그를 최대 `TRAEFIK_MANAGER_LOG_TAIL_LINES`줄 읽어 최근 24시간을 24개 구간으로 집계합니다. 컨테이너 재생성·로그 회전·tail 제한으로 24시간 전체가 남아 있지 않을 수 있으므로 카드의 `관측 시작` 시각을 함께 확인합니다. 이는 Manager API 오류만 다루며 프론트엔드 자체 404는 포함하지 않습니다.
- backend는 30초마다 Manager 컨테이너 health 전이를 확인합니다. 설정의 `Manager Docker 상태 감지`에서 활성화 여부와 5~1440분 재알림 cooldown을 조정할 수 있습니다. `unhealthy`와 회복은 감사 로그에 남고 `Manager Docker 상태` 운영 알림 route로 전송됩니다.
- 대시보드의 `Manager 상태 전이 이력`은 Docker 및 외부 watchdog의 최근 이상·복구 감사 기록을 30초마다 갱신합니다. watchdog 실행이 설정 기준보다 늦거나 다시 정상 갱신되면 각각 감사 로그에 기록합니다. 감사 로그는 행위자·대상 이름·대상 ID 검색과 `Manager 소스`·`Manager 상태` 조합, 반대 축 기준 교차 집계 수치를 지원합니다. 전체·24시간·7일·30일·90일 기간 또는 UTC 시작일·종료일과 페이지당 25·50·100건을 선택할 수 있고 페이지 번호를 직접 입력해 이동할 수 있습니다. 목록 필터·총 건수·페이지 슬라이스는 DB에서 처리하며 `created_at` 인덱스를 사용합니다. 적용 조건은 개별 제거하거나 전체 초기화할 수 있으며 필터 변경 중에도 화면을 닫지 않고 표만 갱신하고, 모바일에서는 필터 필드를 한 열로 배치합니다. 검색어와 선택한 필터·기간·시작일·종료일·Manager 소스·Manager 상태·전송 상태·채널·집계 기간·페이지 크기·페이지는 URL에 저장되어 새로고침 후에도 유지됩니다.
- 감사 로그 화면의 `현재 조건 CSV`는 화면의 검색·분류·기간·UTC 날짜 범위를 그대로 사용하고 페이지 번호·페이지 크기는 제외합니다. 응답은 Excel 호환 UTF-8 BOM을 포함하며 수식으로 해석될 수 있는 셀을 이스케이프합니다.
- 감사 로그 보존 정책은 기본 365일이며 backend 시작 시와 이후 24시간마다 실행됩니다. 아카이브가 켜져 있으면 삭제 전에 `AUDIT_ARCHIVE_DIR`의 gzip JSONL 파일에 저장하고 파일 권한을 `0600`으로 제한합니다. 설정 화면에서 30~3650일로 조정하거나 즉시 실행할 수 있으며, 아카이브를 끄면 기간이 지난 로그는 영구 삭제됩니다.
- 브라우저에서 `https://<FRONTEND_DOMAIN>` 접속 시 로그인 페이지가 보입니다.
- `curl -Ik https://<FRONTEND_DOMAIN>` 응답이 `200` 또는 `302`입니다.
- 서비스 목록과 의존 API, 모바일 다크모드 주요 화면을 함께 확인하려면 `TM_SMOKE_COOKIE='tm_session=...; tm_csrf=...' ./scripts/check-services.sh`를 실행합니다. `TM_SMOKE_BASE_URL`이 없으면 `.env`의 `FRONTEND_DOMAIN`을 사용합니다.
- 운영 세션 쿠키 대신 테스트 계정으로 확인하려면 `TM_SMOKE_USERNAME`과 `TM_SMOKE_PASSWORD`를 사용합니다. Turnstile이 필요한 환경에서는 기존 세션 쿠키 방식이 더 안전합니다.
- GitHub Actions의 `운영 로그인·화면 스모크`는 매일 03:17(KST)에 실행되며 수동 실행도 지원합니다.
- 운영 로그인·화면 스모크는 대시보드의 `Docker 정상`, Manager API 오류 추이 24개 구간, 감사 로그 조건 CSV, 설정 화면의 `Artifact 만료`와 감사 로그 보존 카드도 명시적으로 확인합니다.
- 저장소 비밀값에 `TM_SMOKE_BASE_URL`과 `TM_SMOKE_COOKIE`를 등록하거나, 쿠키 대신 `TM_SMOKE_USERNAME`과 `TM_SMOKE_PASSWORD`를 등록하면 실제 인증 화면을 검사합니다.
- 인증 비밀값이 아직 없으면 예약 작업은 브라우저 스모크 self-test만 실행하고 정상 종료합니다.
- 인증 화면 검사에 실패하면 모바일 화면 PNG를 GitHub Actions 아티팩트로 7일간 보관합니다.
- `TM_SMOKE_TELEGRAM_BOT_TOKEN`과 `TM_SMOKE_TELEGRAM_CHAT_ID` 비밀값이 있으면 실패 실행 링크를 Telegram으로 전송합니다.
- `scripts/rotate-smoke-viewer-password.sh`는 `traefik-smoke-viewer` 비밀번호와 `TM_SMOKE_PASSWORD` secret을 함께 교체하고 실제 인증 스모크로 검증합니다.
- 전용 viewer 이름을 바꾸는 경우 backend의 `SMOKE_VIEWER_USERNAME`과 GitHub secret `TM_SMOKE_USERNAME`을 같은 값으로 설정해야 원격 성공 기록이 허용됩니다.
- 운영 호스트에서는 매월 1일 04:17에 회전 스크립트를 실행하는 사용자 cron을 사용합니다. 실행 로그는 `~/.local/state/traefik-manager/smoke-password-rotation.log`에 저장합니다.
- 회전 결과는 설정 화면의 `운영 로그인·화면 점검` 카드 안에 별도 표시되며, 실패하면 현재 설정 변경 알림 채널로 실패 단계가 전송됩니다.
- 정기 회전의 비밀번호 단독 변경은 감사 로그만 남기고 운영 알림에서는 제외하며, 수동 실패 시험 알림은 제목에 `[테스트]`를 표시합니다.
- 회전 스크립트는 `~/.local/state/traefik-manager/smoke-password-rotation.lock` 잠금을 사용해 cron과 수동 실행의 중복 회전을 건너뜁니다.
- 마지막 성공 후 35일이 지나면 설정 화면의 회전 상태가 `점검 필요`로 표시됩니다.
- 일일 인증 스모크도 35일 미회전을 실패로 처리해 Telegram으로 능동 통지합니다.
- 운영 로그인·화면 스모크는 보안 공격 검사가 아니라 viewer 로그인, 주요 API, 화면 로딩을 확인하는 가용성 점검입니다. 로그인 공격 방어는 별도 `로그인 보안 방어` 설정에서 관리합니다.
- 관리자 설정 화면에서 예약 자동 점검을 끄거나 `매일`/`매주 일요일`로 조정할 수 있습니다. GitHub Actions는 매일 03:17(Asia/Seoul)에 설정을 확인하며, 수동 실행과 월간 비밀번호 회전 후 검증은 항상 실행합니다.
- 원격 스모크가 성공하면 전용 viewer 세션으로 GitHub run ID를 기록합니다. 관리자 설정 카드는 공개 GitHub Actions 메타데이터를 10분간 캐시해 최근 5회의 성공·실패·예약 건너뜀, 실패 단계, 중복 Telegram 억제 여부를 함께 표시합니다.
- 관리자는 마지막 GitHub 확인 시각을 확인하고 `지금 새로고침`으로 10분 캐시를 우회할 수 있습니다. 최근 5건 밖으로 밀린 마지막 실패도 별도로 유지되며, 보관 기간이 지나지 않았다면 만료 시각과 함께 `실패 화면` artifact를 바로 받을 수 있습니다.
- GitHub 이력 조회가 실패해도 설정 API 전체를 실패시키지 않으며, 앱에 저장된 최근 성공 시각과 실행 링크는 계속 표시합니다.
- 같은 커밋의 원격 스모크 실패가 6시간 안에 반복되면 GitHub 실패 기록과 아티팩트는 유지하되 중복 Telegram 알림만 억제합니다.
- backend 상태 기록 자체가 실패하면 호스트 스크립트가 `host-operation-alert.yml`을 호출해 GitHub Actions의 Telegram secret으로 우회 통지합니다.
- backend 자체 중단은 호스트의 `scripts/manager-health-watchdog.sh`가 공개 `/api/health`를 5분마다 확인해 감지합니다. 장애·60분 지속 장애·복구 때 연속 실패 횟수를 포함해 `host-operation-alert.yml`을 호출하므로 Telegram 비밀값을 호스트에 저장하지 않습니다. 성공적으로 요청한 최근 실행 URL 5개는 호스트 상태 파일에 보존하며, 지연 판정 기준은 설정 화면에서 5~1440분으로 조정할 수 있습니다.
- watchdog 설치 예시는 `*/5 * * * * cd /path/to/traefik-manager && /usr/bin/bash scripts/manager-health-watchdog.sh >> ~/.local/state/traefik-manager/manager-health-watchdog.log 2>&1`입니다. 적용 전 `scripts/manager-health-watchdog.sh --self-test`와 정상 상태 1회 실행으로 기준 상태를 생성합니다.
- 공개 주소나 cooldown을 바꿔야 하면 cron 앞에 `TM_MANAGER_WATCHDOG_URL=https://manager.example.com` 또는 `TM_MANAGER_WATCHDOG_COOLDOWN_SECONDS=3600`을 지정합니다.
- `scripts/test-manager-health-watchdog.sh`는 가짜 health 응답과 가짜 GitHub CLI로 정상→장애→복구 및 알림 요청 실패 기록을 검증하므로 운영 컨테이너와 실제 알림을 중단하거나 호출하지 않습니다.
- 최근 24시간의 실패 알림은 5분 간격으로 최대 3회 자동 재시도하며, 각 재시도 결과도 감사 로그에 남깁니다.
- 관리자 설정 카드의 `최근 cron 로그`에서 호스트 로그 마지막 12줄을 확인할 수 있으며, 상태 디렉터리는 backend에 읽기 전용으로 마운트됩니다.
- 로그인 후 서비스 추가 시 `traefik-config/dynamic/<domain>.yml` 파일이 생성됩니다.
- Traefik 로그 또는 대시보드에서 새 라우터가 반영됩니다.
- `docker compose logs -f backend`에 `/traefik-config/dynamic` 권한 오류가 없습니다.
