# 배포 가이드

## Traefik Manager compose

- `frontend`는 기본적으로 `https://<FRONTEND_DOMAIN>`에 공개되며, `TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED=false`이면 공개 라우터를 생성하지 않습니다.
- `TRAEFIK_MANAGER_TAILNET_ROUTER_ENABLED=true`이면 `TRAEFIK_MANAGER_TAILNET_ENTRYPOINT`에 Host 제한 없는 전용 라우터를 생성합니다. 이 엔트리포인트는 반드시 호스트 loopback에만 게시하고 Tailscale Serve를 통해서만 연결합니다.
- `TAILNET_FRONTEND_URL`이 있으면 blue-green 배포, 외부 watchdog, 로컬 브라우저 스모크와 계정 회전 검증이 공개 도메인보다 이 URL을 우선합니다.
- `FRONTEND_DOMAIN`은 Traefik 라우팅뿐 아니라 Next.js `metadataBase` 기준 URL로도 사용됩니다. 호스트명만 넣으면 빌드 시 `https://` 기준으로 처리됩니다.
- `backend`는 기본 권장 구성이면 프론트의 `/api` 리버스 프록시를 통해서만 접근합니다.
- `NEXT_PUBLIC_API_URL`은 브라우저 번들에 포함되므로 운영 권장값은 고정 상대 경로인 `/api/v1`입니다.
- 실제 백엔드 업스트림 전환은 `BACKEND_UPSTREAM_URL`로 처리합니다. Next.js가 컨테이너 시작 시 이 값을 읽어 `/api/*`를 백엔드로 프록시합니다. 기본값은 `http://traefik-manager-backend:8000`입니다.
- 외부 공유 네트워크에 여러 Compose 스택을 붙이는 경우 `backend` 같은 일반 서비스명은 DNS 충돌을 일으킬 수 있으므로, Traefik Manager는 `traefik-manager-backend` 같은 고유 호스트명을 사용하는 구성을 권장합니다.
- `FRONTEND_DOMAIN`을 바꾸면 프런트 이미지를 다시 빌드해야 메타데이터 절대 URL에도 반영됩니다.
- 생성되는 HTTPS 라우터는 `TRAEFIK_TLS_CERT_RESOLVER`를 `tls.certResolver`로 사용합니다. 기본값은 `letsencrypt`이며, 빈 값이면 자동 발급을 명시적으로 끕니다.
- 인증서 만료 모니터는 Traefik API와 ACME 저장소를 함께 읽습니다. backend가 `/acme.json`을 직접 못 읽는 경우에는 내부 Docker API proxy를 통해 `TRAEFIK_DOCKER_CONTAINER_NAME`의 `TRAEFIK_ACME_STORAGE_PATH`를 fallback으로 읽습니다.
- 운영 compose에서 Docker socket은 `dockerproxy`에만 읽기 전용으로 마운트됩니다. backend는 내부망의 읽기 전용 API와 `networks/proxy_net/connect` 전용 API만 사용합니다.
- `DOCKER_SOCKET_GID`는 `dockerproxy`가 호스트 socket에 접근할 그룹 ID입니다. `stat -c '%g' /var/run/docker.sock` 결과와 맞춰야 합니다. 로컬 backend를 compose 밖에서 실행할 때만 `DOCKER_READ_API_URL`과 `DOCKER_MUTATION_API_URL`을 비워 두고 Unix socket fallback을 사용할 수 있습니다.
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

## Tailnet 전용 Manager 경로

Traefik에 별도 엔트리포인트를 만들고 호스트 loopback에만 게시합니다. 예시는 컨테이너 `18081`을 호스트 `127.0.0.1:18081`에 연결합니다.

```yaml
services:
  traefik:
    ports:
      - "127.0.0.1:18081:18081"
    command:
      - --entrypoints.manager-tailnet.address=:18081
      - --entrypoints.manager-tailnet.forwardedheaders.insecure=true
```

`forwardedheaders.insecure`는 이 loopback 전용 엔트리포인트에서만 사용해 Tailscale Serve가 전달한 실제 클라이언트 주소를 보존합니다. 인터넷에 바인딩된 엔트리포인트에는 적용하지 않습니다.

```bash
tailscale serve --yes --bg --https=8444 http://127.0.0.1:18081
```

전환 중에는 공개·Tailnet 라우터를 함께 켜고 `https://<TAILNET_HOST>:8444/api/health`와 로그인을 확인합니다. 확인 후 `TRAEFIK_MANAGER_PUBLIC_ROUTER_ENABLED=false`로 바꾸고 active blue-green upstream을 유지한 채 `init-traefik-config`를 다시 실행합니다.

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

## Blue-green 무중단 배포

초기 설치나 비상 복구에는 기존 `docker compose up -d --build`를 사용할 수 있습니다. 정상 운영 업데이트는 아래 명령으로 active 반대편 슬롯을 빌드·검증한 뒤 전환합니다.

```bash
scripts/blue-green-deploy.sh vX.Y.Z
```

스크립트는 현재 `traefik-manager-self.yml` upstream을 기준으로 active 슬롯을 판별합니다. 후보 backend/frontend가 모두 healthy이고 후보 frontend에서 후보 backend까지 `/api/health`가 통과한 뒤에만 file-provider upstream을 원자 교체합니다.

- 요청 version/revision, 상태 파일, active backend/frontend OCI 라벨과 health, dockerproxy health 및 inactive 슬롯 종료 상태가 모두 일치하면 공개 Manager·TCG 읽기 전용 점검만 수행하고 중복 배포를 건너뜁니다. 같은 revision을 의도적으로 다시 빌드해야 할 때만 `TM_BLUE_GREEN_FORCE_REDEPLOY=1 scripts/blue-green-deploy.sh vX.Y.Z`를 사용합니다.
- 후보 이미지를 빌드한 뒤 공유 DB의 현재 revision부터 Alembic head까지 미적용 migration을 검사합니다. 각 파일에서 기존/신규 앱의 schema 동시 사용이 안전함을 검토하고 `BLUE_GREEN_COMPATIBLE = True`로 명시해야 후보 컨테이너를 시작합니다.
- PR과 main push에서는 변경된 migration의 같은 호환성 표식을 검사하고 기존 migration 파일 삭제를 차단합니다.
- 후보 backend는 준비 중 `traefik-manager-app` 내부망에만 있고, health 통과 후 `proxy_net`에 `traefik-manager-backend` ForwardAuth alias로 연결됩니다.
- backend의 startup 정리와 주기 작업은 `/traefik-config/.background-tasks.lock` lease를 가진 active 슬롯 하나만 실행합니다.
- route가 바뀌면 기존 leader가 lease를 반납하고 새 active backend가 자동 승계합니다.
- 배포는 새 leader가 서비스·Authentik·대시보드 동적 설정 startup 동기화를 완료한 뒤에만 공개 검증과 상태 확정을 진행합니다.
- route 반영 후 기존 연결을 기본 2초간 drain한 뒤 이전 backend를 종료합니다. 필요하면 `TM_BLUE_GREEN_DRAIN_SECONDS`로 조정합니다.
- 전환 구간에는 공개 `/api/health`를 0.2초 간격으로 측정하며 한 건이라도 200이 아니면 이전 슬롯으로 자동 rollback합니다.
- 컨테이너 변경 전과 새 leader의 서비스 라우트 동기화 후에 `https://tcg.lizstudio.co.kr/products`를 최대 3회 확인합니다. 사전 실패는 배포를 시작하지 않고, 후검증 실패는 이전 슬롯으로 자동 rollback합니다. 별도 환경에서는 `TM_BLUE_GREEN_TCG_CONTINUITY_URL`로 고정 URL을 바꿀 수 있습니다.
- 호스트에서 자기 공인 IP로 돌아오는 self-hairpin이 실패하면 Traefik 컨테이너 IP를 자동 탐색하고, 같은 공개 호스트명·TLS SNI를 유지한 내부 경로로 health probe를 계속합니다.
- active slot, revision, version은 `~/.local/state/traefik-manager/blue-green-deployment.state`에 원자 기록됩니다.
- 배포 성공·전환 전 중단·자동 rollback·rollback 실패와 공개 probe 결과는 같은 디렉터리의 `blue-green-deployments.jsonl`에 추가됩니다. 대시보드에서 최근 20건을 상태별로 필터링하고 실패 단계별 건수를 확인하며 해당 커밋과 릴리즈를 바로 열 수 있습니다.
- 성공 배포의 가장 느린 단계가 기본 60초를 초과한 상태로 3회 연속 이어지면 호스트 스크립트가 Anubis 전용 CLI로 Telegram 알림을 한 번 직접 전송합니다. 같은 연속 구간에서는 중복 알림을 보내지 않고 정상 또는 실패 기록이 나오면 사건 상태를 해제합니다. 기준·횟수·이벤트 보관 기간은 관리자 설정 화면에서 조정하며, 호스트 환경 변수 `TM_DEPLOY_BOTTLENECK_ALERT_THRESHOLD_MS`, `TM_DEPLOY_BOTTLENECK_ALERT_CONSECUTIVE`, `TM_DEPLOY_BOTTLENECK_EVENT_RETENTION_DAYS`가 있으면 해당 값이 우선합니다. 이벤트는 `traefik-config/.runtime`에 기본 90일과 최대 100건 중 먼저 도달한 기준까지 보관하고 다음 배포 검사 또는 설정 화면의 `지금 정리`로 정리합니다. 배포 검사 시 보관량이 80건에 도달하면 Telegram 경고를 한 번 보내고 80건 미만으로 내려가면 복구를 한 번 알립니다. 설정 화면은 보관 건수·범위와 호스트 적용값·출처·실제 전송 채널을 표시하고, 대시보드는 마지막 검사 상태와 최근 알림 발생·해제 이력을 보여줍니다.
- JSONL은 기본 200건을 넘으면 전체 파일을 `.1`에 보관하고 현재 파일은 최신 100건으로 줄입니다. 회전할 때 `.1`과 기존 `.daily`를 합쳐 UTC 날짜별 마지막 배포 1건을 `.daily`에 기본 365건까지 보관하므로 오래된 상세 기록은 일별 추이로 남습니다. 대시보드는 현재 파일과 중복되지 않는 `.1` 상세 20건과 날짜가 겹치지 않는 `.daily` 일별 기록을 합쳐 최근 120건까지 보여줍니다. `TM_DEPLOY_HISTORY_MAX_ENTRIES`, `TM_DEPLOY_HISTORY_RETAIN_ENTRIES`, `TM_DEPLOY_HISTORY_DAILY_RETAIN_ENTRIES`로 상한을 조정할 수 있습니다.
- 실패 이력에는 준비·빌드·migration 검사·후보 health·route 전환·leader 승계·공개 probe·상태 확정 중 실패 단계와 종료 코드 또는 비정상 probe 건수를 저장합니다. 원본 stderr는 비밀값 유입을 막기 위해 저장하지 않습니다.
- 이전 슬롯·route·상태 파일 복원이 완료되지 않은 `rollback_failed`만 Anubis Telegram으로 직접 알립니다. 신규 이력에는 요청 성공 여부와 `anubis` 채널을 저장하고, 전환 전 GitHub Actions 실행 URL은 과거 이력 조회용으로 유지합니다. 정상 자동 rollback은 이력만 남기고 알림을 보내지 않습니다.
- 배포 잠금은 같은 상태 디렉터리의 `blue-green-deployment.lock`을 사용합니다.
- 배포 시작 시 `dockerproxy`가 healthy인지 먼저 확인하며 backend 컨테이너에는 Docker socket을 마운트하지 않습니다.
- 대시보드 Manager 라우터 카드에서 active 슬롯과 file-provider upstream `UP`을 확인합니다.
- 대시보드 `배포 전환 이력`은 최근·보관 기록을 분리하거나 통합해서 검색하며 통합 카드에는 현재·보관 소스와 선택 기간별 건수를 표시합니다. 보관 이력은 상세·일별 표본만 따로 볼 수 있습니다. 프리셋 또는 시작일·종료일, 상태·실패 단계·버전·커밋·실패 원인으로 필터링하고 성공률·실패율·롤백률을 누르면 해당 상태만 바로 볼 수 있으며 `산정 기준`에서 분모와 집계 상태를 확인할 수 있습니다. 선택 소스와 기간의 평균·중앙값·보간 P95 배포시간과 시간순 추이 차트를 표시하며, 기간을 선택하면 직전 동일 길이 구간의 평균선·현재 대비 증감률과 단계별 현재·직전 평균 막대를 함께 보여줍니다. 평균 또는 P95를 누르면 해당 기준보다 느린 배포만 필터링하며 카드의 초과 시간, URL, 내보내기 metadata에도 기준이 유지됩니다. 신규 배포 기록은 단계별 소요시간과 가장 오래 걸린 병목을 표시하고, 선택 소스·기간의 단계별 표본 수·평균·보간 P95·최대를 집계합니다. 병목 경고 기준은 15초·30초·1분·2분·5분 중 선택하며 초과 항목이 있으면 이력 상단 경고와 배포·단계 행을 함께 강조하고 URL에 유지합니다. 기존 기록은 단계 정보가 없으면 단계 집계에서 제외됩니다. 실패 단계별 평균 소요시간, 검색 일치 부분, 배포 소요시간과 슬롯 전환을 확인할 수 있습니다. 커밋 SHA·실패 원인·각 기록의 전체 JSON을 복사하거나 연속 배포 버전을 GitHub에서 비교할 수 있습니다. 선택 조건은 URL에 유지되고 현재 결과를 JSON 또는 Excel 호환 CSV로 내보냅니다. 내보내기 버튼은 현재 결과 건수를 표시하고 완료 알림은 적용 소스·표본·기간·상태와 활성 실패 단계·검색어를 요약합니다. JSON은 `metadata`와 `entries`로 구성되고 CSV는 상단 메타데이터 블록에 적용 필터와 결과 건수를 기록하며, 통합 내보내기에는 각 기록의 `source`도 포함됩니다. 내보내기 스키마 v6에는 `stage_durations_ms`, 보관 표본, 병목 경고 기준과 운영 알림 채널이 포함되며 `metadata`에는 `schema_version`, 표시 시간대와 적용 필터가 기록되고 파일명에도 소스·기간·상태가 반영됩니다.
- `보관 구성`은 실제 조회에 포함된 상세·일별 표본 수와 최초·최종 시각을 표시합니다. 단계별 기간 비교의 버전 링크를 누르면 현재 필터 결과의 해당 배포 카드로 이동해 전체 단계 시간을 바로 확인할 수 있습니다.

배포 전 `scripts/blue-green-deploy.sh --self-test`, `scripts/test-blue-green-rollback-failure.sh`, `scripts/manager-deployment-history.sh --self-test`, `scripts/manager-deployment-bottleneck-alert.sh --self-test`, `scripts/request-host-operation-alert.sh --self-test`와 `scripts/manager-deployment-probe.sh --self-test`를 실행할 수 있습니다. 격리 rollback 시험은 운영 route나 Docker를 건드리지 않고 실제 상태 머신에 복구 실패를 주입합니다. 전체 배포 회귀 검사는 태그 릴리스의 `릴리스 최종 통합 검사`에서 실행합니다.

## Traefik 패치 안전 업데이트

호스트에 `setfacl`을 제공하는 `acl` 패키지를 설치하고 한 번 `scripts/install-traefik-update-runner.sh`를 실행하면 user systemd path/timer가 Manager의 업데이트 요청을 처리합니다.

Compose 파일명이 기본 `docker-compose.yml`이 아니면 Traefik 디렉터리 기준 상대 경로를 설치할 때 함께 지정합니다. 단일 파일은 기존 `TM_TRAEFIK_UPDATE_COMPOSE_FILE`도 계속 지원합니다. 여러 overlay를 사용하는 경우 실제 적용 순서대로 쉼표로 연결합니다. 예: `TM_TRAEFIK_UPDATE_COMPOSE_FILES=compose.yml,compose.prod.yml scripts/install-traefik-update-runner.sh`.

기본 배치와 다르면 설치 시 `TM_TRAEFIK_UPDATE_ACME_FILE`, `TM_TRAEFIK_UPDATE_SERVICE`, `TM_TRAEFIK_UPDATE_CONTAINER`, `TM_TRAEFIK_UPDATE_NETWORK`를 함께 지정합니다. 설치기는 이 값을 user systemd unit에 고정하고 ACME 상대 경로·일반 파일·비어 있지 않음과 이름 형식을 먼저 검증합니다. 예: `TM_TRAEFIK_UPDATE_ACME_FILE=certificates/acme-prod.json TM_TRAEFIK_UPDATE_SERVICE=edge-proxy TM_TRAEFIK_UPDATE_CONTAINER=edge-traefik TM_TRAEFIK_UPDATE_NETWORK=edge_net scripts/install-traefik-update-runner.sh`.

- backend에는 Docker 쓰기 권한 대신 ACL로 backend UID만 허용한 `traefik-update-requests` 디렉터리 하나를 쓰기 가능으로 마운트합니다.
- 자동 요청은 동일 메이저·마이너의 상향 패치 버전만 허용하고, 호스트 실행기가 공식 Traefik 이미지·Compose 서비스·설정된 Docker 네트워크·ACME 파일을 다시 검증합니다.
- 업데이트 요청은 매시 00·15·30·45분 전후 2분에는 큐에 유지하고 안전 구간에 처리합니다. 이미지 pull 중 보호 구간에 들어가도 재생성 직전에 다시 대기하며 heartbeat를 유지합니다.
- 실행기는 Compose와 `acme.json`을 백업한 뒤 Traefik 서비스만 재생성합니다. 컨테이너 버전·네트워크·Manager health 검증이 실패하면 이전 Compose로 자동 롤백합니다.
- 실행기는 현재 Traefik 컨테이너 ID를 매분 비교합니다. 패치 업데이트·자동 롤백·수동 안전 경로가 정확한 새 ID를 먼저 기록하므로, 그 밖에서 바뀐 ID만 `unmanaged`로 판정합니다. 최초 실행은 현재 ID를 기준선으로만 저장해 과거 재생성을 오탐하지 않습니다. 비관리 재생성은 컨테이너 ID별로 Anubis Telegram 알림을 한 번 요청하며 전송 완료·실패를 재생성 이력에 함께 기록합니다.
- 요청, 백업 위치, 검증, 롤백 결과는 `~/.local/state/traefik-manager/traefik-updates.jsonl`에 최대 200줄로 보관되며 대시보드에서 확인할 수 있습니다.
- 관리·비관리 재생성 이력은 `~/.local/state/traefik-manager/traefik-recreations.jsonl`에 최대 200줄로 보관되며 같은 대시보드 카드에서 최근 상태를 확인할 수 있습니다.

Traefik 정적 설정을 수동으로 바꾼 뒤 재생성할 때도 직접 `docker compose up -d traefik`를 실행하지 않고 `scripts/run-traefik-recreate-safely.sh`를 사용합니다. 실행 중인 컨테이너와 현재 Compose 해시가 같을 때 마지막 정상 체크포인트를 자동 생성하며, 재생성 후 컨테이너 health·버전·네트워크·Manager route와 Compose 해시를 검증합니다. 검증에 실패하면 체크포인트의 Compose를 복원하고 Traefik만 다시 재생성하며, 복구도 실패하면 Anubis 운영 알림을 요청합니다. 설정·이미지 변화 없이 통제된 재생성을 검증할 때만 `--force-recreate`를 붙이고, 재생성 없이 현재 정상 구성을 확인하려면 `--checkpoint`를 사용합니다. 같은 보호 구간과 업데이트 잠금을 공유하므로 자동 패치 작업과 충돌하지 않습니다. 장애 복구와 자동 롤백은 이 대기를 적용하지 않습니다.

## 검증 체크리스트

- `curl <MANAGER_BASE_URL>/api/health`가 `{"status":"정상"}`을 반환하며, 이 경로는 frontend를 거쳐 backend까지 확인합니다.
- backend는 자체 `/api/health`, frontend는 같은 슬롯 backend까지 이어지는 `/api/health`를 Docker healthcheck로 사용하므로 active backend/frontend가 모두 `healthy`인지 확인합니다. Manager 자체 라우터는 `init-traefik-config`가 `traefik-manager-self.yml`로 원자 생성하고 blue-green 스크립트가 준비된 슬롯으로 upstream만 교체합니다. 대시보드 배포 카드에서 active 슬롯, provider `file`, HTTPS/HTTP router와 service `enabled`, upstream `UP`을 함께 확인합니다.
- 대시보드 Manager 배포 카드는 Docker 상태를 30초마다 갱신하며, `unhealthy`이면 연속 실패 횟수와 마지막 검사 시각·종료 코드를 표시합니다. 외부 watchdog 상태·연속 실패·마지막 실행과 최근 운영 알림 전송 결과·채널을 표시하고, 과거 GitHub Actions 알림은 실행 링크·최근 실행 5건의 최종 상태·결과 확인 시각·조회 오류를 읽기 전용으로 유지합니다. Anubis 호스트 timer가 기록한 Traefik 자기 차단 점검 상태와 최근 감지·자동 해제 이력도 표시하지만, Traefik 장애 중에는 Manager 자체가 열리지 않으므로 이 정보는 복구 후 확인하는 기록입니다. 과거 GitHub 실행은 장애·복구와 실행 결과로 즉시 필터링하고 성공·실패·진행·기타 완료 건수를 집계하며 카드에서 직접 새로고침할 수 있습니다. 필터는 URL에 유지되며 적용 조건을 하나씩 제거하거나 전체 초기화할 수 있고, 마지막 수동 갱신 완료 시각을 자동 갱신과 구분해 표시합니다. 설정한 지연 판정 시간이 지나면 상단 경고를 노출하며 healthcheck 원문 출력은 노출하지 않습니다.
- 배포 카드에는 마지막 상태 갱신 시각과 수동 새로고침 버튼이 있으며, unavailable·중지·unhealthy 컴포넌트가 있으면 대시보드 상단에 경고 배너를 표시합니다.
- 배포 카드의 `Manager API 404·5xx 추이`는 `TRAEFIK_MANAGER_REQUEST_LOG_PATH`의 구조화 요청 로그를 읽어 최근 6·12·24시간을 시간 단위로 집계하고 경로 부분 검색을 지원합니다. 로그는 `backend-data` 볼륨에서 파일당 5MiB·백업 5개로 회전해 컨테이너 재생성에도 유지되며, 카드에서 영속/Docker 폴백 소스와 총 사용량, 파일 수, 회전 파일 수를 확인할 수 있습니다. 시각 스모크 요청은 Docker stdout에 `synthetic` 표식으로 남기되 영속 회전 로그에서는 제외합니다. Traefik 499는 화면 이동처럼 클라이언트가 연결을 먼저 닫은 요청이므로 최근 Traefik 로그 표본의 별도 상태로 표시하고 404·5xx 차트, 권장 임계치와 운영 알림 계산에서는 제외합니다. 499 원문 표본은 5분간 캐시하며 관측 시작과 조회 기간 표본 충족률을 함께 표시해 전체 기간 수치로 오해하지 않게 합니다. 영속 로그 사용량이 80% 이상이면 24시간 표본 보존 여부를 확인하도록 최초 상태 전이만 경고하고, Docker 폴백 또는 로그 사용 불가 상태는 기존 cooldown에 따라 재알림합니다. backend는 이 보관 상태를 30초마다 확인해 경고·복구 전이를 감사 로그와 `Manager 상태` 운영 알림 route에 기록합니다. 파일을 읽지 못하면 backend Docker 로그의 최근 `TRAEFIK_MANAGER_LOG_TAIL_LINES`줄로 폴백합니다. 트래픽이 회전 용량을 넘으면 선택 기간 전체가 남지 않을 수 있으므로 카드의 `관측 시작` 시각을 함께 확인합니다. 이는 Manager API 오류만 다루며 프론트엔드 자체 404는 포함하지 않습니다. 추이 차트는 제외 설정과 무관하게 원본 오류를 유지합니다.
- backend는 30초마다 Manager 컨테이너 health 전이와 선택형 API 오류 임계치를 확인합니다. `Manager API 오류 임계치 감지`는 업그레이드 직후 예상하지 못한 전송을 막기 위해 기본 비활성화이며, 집계 구간 5~60분과 404·5xx 임계치, 최대 50개의 `/api/` 경로 접두어 제외 목록을 설정할 수 있습니다. `최대 24시간 권장값 계산`은 현재 입력한 제외 목록을 적용하고 구간별 최고치에 20% 여유를 더하되 기존 기본값보다 낮추지 않으며, 실제 로그 관측 시작·24시간 표본 충족률과 경로별 제외 오류 건수·최근 오류 시각도 함께 보여줍니다. 24시간보다 오래된 요청도 표본 충족 판정에는 포함되며, 충족 전에는 재계산 시점을, 충족 후에는 현재 임계치에서 권장 임계치로 바꿀 때의 상향·하향 차이를 안내합니다. 회전 용량을 넘으면 24시간 전체가 남지 않을 수 있으므로 이는 초기값 참고용입니다. 제외 목록은 임계치 판정에만 적용됩니다. 대시보드는 비활성·첫 점검 대기·정상·임계치 초과·점검 실패 상태와 마지막 검사 시각을 표시하고, 임계치 초과 또는 점검 실패는 `Manager 전체 + API 오류 + 24시간` 감사 로그로 이동해 최신 API 이벤트 상세를 자동으로 펼칩니다. Docker와 API 감지는 5~1440분 재알림 cooldown 및 `Manager 상태` 운영 알림 route를 공유하고 이상·복구를 감사 로그에 남깁니다.
- 대시보드의 `Manager 상태 전이 이력`은 Docker, Manager API 오류 임계치, 요청 로그 보관 상태 및 외부 watchdog의 최근 이상·복구 감사 기록을 30초마다 갱신합니다. API 오류 임계치 초과 항목은 당시 상위 발생 경로를 접어서 표시하고, 요청 로그 보관 경고는 소스·사용률·파일 수를 표시합니다. watchdog 실행이 설정 기준보다 늦거나 다시 정상 갱신되면 각각 감사 로그에 기록합니다. 감사 로그는 행위자·대상 이름·대상 ID 검색과 `Manager 소스`·`Manager 상태` 조합, 반대 축 기준 교차 집계 수치를 지원합니다. 전체·24시간·7일·30일·90일 기간 또는 UTC 시작일·종료일과 페이지당 25·50·100건을 선택할 수 있고 페이지 번호를 직접 입력해 이동할 수 있습니다. 목록 필터·총 건수·페이지 슬라이스는 DB에서 처리하며 `created_at` 인덱스를 사용합니다. 적용 조건은 개별 제거하거나 전체 초기화할 수 있으며 필터 변경 중에도 화면을 닫지 않고 표만 갱신하고, 모바일에서는 필터 필드를 한 열로 배치합니다. 검색어와 선택한 필터·기간·시작일·종료일·Manager 소스·Manager 상태·전송 상태·채널·집계 기간·페이지 크기·페이지는 URL에 저장되어 새로고침 후에도 유지됩니다.
- Traefik 인코딩 경로 차단 감시는 라우터가 HTTP 400으로 즉시 거부한 결과만 집계합니다. 30초 감시 주기는 유지하되 저장된 마지막 로그 시각 이후분만 Docker에서 읽고, 같은 초의 경계 요청은 fingerprint로 중복 제거합니다.
- 감사 로그 화면의 `현재 조건 CSV`는 화면의 검색·분류·기간·UTC 날짜 범위를 그대로 사용하고 페이지 번호·페이지 크기는 제외합니다. 응답은 Excel 호환 UTF-8 BOM을 포함하며 수식으로 해석될 수 있는 셀을 이스케이프합니다.
- 감사 로그 보존 정책은 기본 365일이며 backend 시작 시와 이후 24시간마다 실행됩니다. 아카이브가 켜져 있으면 삭제 전에 `AUDIT_ARCHIVE_DIR`의 gzip JSONL 파일에 저장하고 파일 권한을 `0600`으로 제한합니다. 관리자는 설정 화면에서 30~3650일 조정·즉시 실행·파일 다운로드·복원을 수행할 수 있습니다. 복원은 생성 파일명과 경로, 압축·해제 크기, 행 수, 모든 필드를 먼저 검증하고 기존 UUID는 건너뛰며, 손상된 파일은 일부도 반영하지 않습니다. 아카이브를 끄면 기간이 지난 로그는 영구 삭제됩니다.
- 브라우저에서 `<MANAGER_BASE_URL>` 접속 시 로그인 페이지가 보입니다.
- `curl -Ik <MANAGER_BASE_URL>` 응답이 `200` 또는 `302`입니다.
- 서비스 목록과 의존 API, 모바일 다크모드 주요 화면을 함께 확인하려면 운영 호스트에서 `./scripts/check-services.sh`를 실행합니다. 인증값이 없으면 전용 viewer·admin 비밀번호를 즉시 회전해 자식 스모크 프로세스에만 전달하고 저장하지 않습니다. `TM_SMOKE_BASE_URL`이 없으면 `.env`의 `TAILNET_FRONTEND_URL`, `FRONTEND_DOMAIN` 순서로 사용합니다.
- 점검 안내 라우팅을 실제 Traefik file-provider까지 확인하려면 `scripts/smoke-maintenance-route.sh`를 실행합니다. 이 스모크는 `.invalid` 임시 Host만 사용하고 DB·DNS·인증서를 변경하지 않으며 확인 직후 라우터 파일을 제거합니다.
- 기존 운영 세션이나 별도 테스트 계정을 사용하려면 `TM_SMOKE_COOKIE` 또는 `TM_SMOKE_USERNAME`과 `TM_SMOKE_PASSWORD`를 직접 전달할 수 있습니다. 불완전한 아이디·비밀번호 쌍은 실행 전에 거부합니다.
- GitHub Actions의 `운영 스모크 도구 자가 점검`은 수동 실행만 지원하며 실제 Tailnet 앱이나 로그인 비밀값을 사용하지 않습니다. 코드 self-test와 실패 아티팩트·Telegram 알림 경로만 확인합니다.
- 실제 운영 화면 검증은 Tailnet에 연결된 호스트에서 `scripts/check-services.sh` 또는 월간 `scripts/rotate-smoke-viewer-password.sh`로 수행합니다. 태그 릴리스의 `릴리스 최종 통합 검사`는 정적 검사와 전체 회귀 검사를 한 번 수행합니다.
- Manager health 감시는 구조화 요청 로그에서 `/api/v1/settings/test-history`의 최근 60분 p95를 5분마다 계산합니다. 최소 5개 표본에서 750ms를 초과하면 운영 알림과 감사 로그를 남기고, 정상화되면 복구 이벤트를 한 번 기록합니다.
- 로컬 실행에 `TM_SMOKE_ADMIN_USERNAME`과 `TM_SMOKE_ADMIN_PASSWORD`를 함께 전달하면 관리자 전용 병목 이벤트 정리 확인창과 취소 흐름도 검사합니다. 미리보기 응답을 브라우저에서 대체하고 POST를 차단하므로 운영 이벤트는 삭제하지 않습니다.
- GitHub 수동 실패 시험은 합성 화면 PNG를 아티팩트로 7일간 보관합니다.
- `TM_SMOKE_TELEGRAM_BOT_TOKEN`과 `TM_SMOKE_TELEGRAM_CHAT_ID` 비밀값이 있으면 실패 실행 링크를 Telegram으로 전송합니다.
- `scripts/rotate-smoke-viewer-password.sh`는 활성 blue/green backend를 찾아 `traefik-smoke-viewer`와 `traefik-smoke-admin` 비밀번호를 교체하고 같은 실행에서 일반·관리자 인증 스모크로 검증합니다. 점검 revision은 활성 backend 이미지의 OCI 라벨을 우선하고 배포 상태 파일을 fallback으로 사용하므로, 작업 트리 HEAD가 실제 배포보다 앞선 경우에도 잘못 기록하지 않습니다. 실행 결과와 소요시간은 Manager에 365일 보관하고 최근 20건을 표시하며, 비밀번호는 GitHub로 전송하거나 저장하지 않습니다.
- 대시보드는 최근 로컬 실패의 단계·대상, 완료 시각, 배포 revision과 이후 점검 성공 여부를 바로 표시합니다. 펼친 호스트 이력에서도 각 실패 원인을 확인할 수 있습니다.
- Tailnet 전용 모드에서 GitHub 실행은 운영 상태가 아닌 참고 이력입니다. 대시보드는 GitHub API를 조회하지 않고, 설정에서 참고 이력을 열 때만 최대 30일 조회합니다. 콜백과 일별 통계 스냅샷은 365일 보관하며 GitHub 원본 실행 보존 기간은 저장소의 Actions 정책을 따릅니다.
- 전용 계정 이름을 바꾸는 경우 backend의 `SMOKE_VIEWER_USERNAME`·`SMOKE_ADMIN_USERNAME`을 각각 같은 값으로 설정합니다.
- 운영 호스트에서는 `scripts/install-smoke-rotation-timer.sh`로 설치한 user systemd timer가 매월 1일 04:17 KST에 두 계정을 회전합니다. 설치기는 timer를 먼저 활성화한 뒤 마커로 관리하던 기존 사용자 cron만 제거하며, 최초 설치 때 지난 일정을 즉시 보충 실행하지 않습니다. Chrome 자체 SUID 샌드박스와 충돌하는 user systemd mount namespace 옵션은 사용하지 않고 UMask·주소군·personality·실행시간 제한을 적용합니다. `systemctl --user list-timers traefik-manager-smoke-rotation.timer`로 다음 실행 시각을 확인하고 실행 로그는 `~/.local/state/traefik-manager/smoke-password-rotation.log`에서 확인합니다.
- 회전 결과는 설정 화면의 `운영 로그인·화면 점검` 카드 안에 별도 표시되며, 실패하면 현재 설정 변경 알림 채널로 실패 단계가 전송됩니다.
- 정기 회전의 viewer·admin 비밀번호 단독 변경은 감사 로그만 남기고 운영 알림에서는 제외하며, 수동 실패 시험 알림은 제목에 `[테스트]`를 표시합니다.
- 회전 스크립트는 `~/.local/state/traefik-manager/smoke-password-rotation.lock` 잠금을 사용해 timer와 수동 실행의 중복 회전을 건너뜁니다.
- 마지막 성공 후 35일이 지나면 설정 화면의 회전 상태가 `점검 필요`로 표시됩니다.
- 운영 로그인·화면 스모크는 보안 공격 검사가 아니라 viewer 로그인, 주요 API, 화면 로딩을 확인하는 가용성 점검입니다. 로그인 공격 방어는 별도 `로그인 보안 방어` 설정에서 관리합니다.
- Tailnet 전용 배포에서는 관리자 설정의 예약 자동 점검을 꺼 둡니다. 기존 예약 설정과 GitHub 실행 이력은 호환용으로 조회할 수 있으며, 월간 비밀번호 회전 후 로컬 검증은 계속 실행합니다.
- Tailnet 전용 대시보드는 전환 전 GitHub 통계를 현재 운영 상태로 사용하지 않습니다. 월간 로컬 검증의 최근 성공 시각과 `blue-green-deployment.state`에 기록된 실제 배포 커밋을 표시하며, GitHub workflow는 도구 self-test로만 안내합니다.
- 원격 스모크가 성공하면 전용 viewer 세션으로 GitHub run ID를 기록합니다. admin 취소 흐름까지 통과한 실행은 관리자 전용 최근 성공 시각과 실행 링크도 별도로 기록합니다. 관리자 설정 카드는 공개 GitHub Actions 메타데이터를 10분간 캐시해 최근 5회의 성공·실패·예약 건너뜀, 실패 단계, 중복 Telegram 억제 여부를 함께 표시합니다.
- 관리자는 마지막 GitHub 확인 시각을 확인하고 `지금 새로고침`으로 10분 캐시를 우회할 수 있습니다. 최근 5건 밖으로 밀린 마지막 실패도 별도로 유지되며, 보관 기간이 지나지 않았다면 만료 시각과 함께 `실패 화면` artifact를 바로 받을 수 있습니다.
- GitHub 이력 조회가 실패해도 설정 API 전체를 실패시키지 않으며, 앱에 저장된 최근 성공 시각과 실행 링크는 계속 표시합니다.
- 같은 커밋의 원격 스모크 실패가 6시간 안에 반복되면 GitHub 실패 기록과 아티팩트는 유지하되 중복 Telegram 알림만 억제합니다.
- backend 상태 기록 자체가 실패하면 호스트 스크립트가 정형 실패 단계만 Anubis 전용 CLI에 전달해 Telegram으로 직접 통지합니다.
- backend 자체 중단은 호스트의 `scripts/manager-health-watchdog.sh`가 `TAILNET_FRONTEND_URL`의 `/api/health`를 5분마다 확인해 감지합니다. 장애·60분 지속 장애·복구 때 제한된 HTTP 결과와 연속 실패 횟수만 Anubis 컨테이너의 전용 CLI에 전달해 Telegram으로 직접 알립니다. Telegram 비밀값은 Anubis 안에만 유지하며, 전환 전 GitHub Actions 실행 URL 이력은 호스트 상태 파일에서 읽기 전용으로 보존합니다. 지연 판정 기준은 설정 화면에서 5~1440분으로 조정할 수 있습니다.
- 운영 호스트에서는 `scripts/install-manager-health-watchdog-timer.sh`가 user systemd service/timer를 설치합니다. timer 활성화 3분 뒤 첫 점검을 시작하고 이후 완료 시점 기준 5분마다 실행하며, 활성·enable 상태를 확인한 뒤 마커로 관리하던 기존 cron만 제거합니다. 실행 로그는 `~/.local/state/traefik-manager/manager-health-watchdog.log`에 유지됩니다.
- 기본 주소나 cooldown을 바꿔야 하면 `traefik-manager-health-watchdog.service`의 user systemd drop-in에 `TM_MANAGER_WATCHDOG_URL` 또는 `TM_MANAGER_WATCHDOG_COOLDOWN_SECONDS`를 설정합니다.
- `scripts/test-manager-health-watchdog.sh`는 가짜 health 응답과 가짜 Docker CLI로 정상→장애→복구 및 직접 알림 실패 기록을 검증하므로 운영 컨테이너와 실제 알림을 중단하거나 호출하지 않습니다.
- TCG 운영 사이트는 호스트의 `scripts/tcg-storefront-watchdog.sh`가 상품 목록·상품 상세·로그인·결제 화면, 활성 PortOne 결제수단, 카카오·네이버·구글 OAuth 시작 리다이렉트를 모두 읽기 전용 GET으로 확인합니다. 주문·결제·재고를 생성하거나 변경하지 않으며, 2회 연속 실패 후에만 Anubis 운영 알림을 보내고 정상화되면 복구 알림을 한 번 보냅니다. OAuth 공급자 오류 화면은 매일 06시 이후 첫 점검에 확인하고 설정 오류가 남아 있으면 15분마다 재검사합니다.
- 운영 호스트에서는 `scripts/install-tcg-storefront-watchdog-timer.sh`로 user systemd timer를 설치합니다. `traefik-manager-tcg-storefront-watchdog.timer`가 15분마다 실행하며 상태와 로그는 각각 `~/.local/state/traefik-manager/tcg-storefront-watchdog.state`, `~/.local/state/traefik-manager/tcg-storefront-watchdog.log`에 기록됩니다. `systemctl --user list-timers traefik-manager-tcg-storefront-watchdog.timer`와 `systemctl --user status traefik-manager-tcg-storefront-watchdog.service`로 실행 상태를 확인합니다.
- `scripts/test-tcg-storefront-watchdog.sh`와 `scripts/test-install-tcg-storefront-watchdog-timer.sh`는 가짜 사이트·가짜 알림·가짜 systemd만 사용하므로 실제 고객 메일이나 운영 알림을 전송하지 않습니다.
- `scripts/install-user-systemd-unit-watchdog-timer.sh`는 설치 시점에 활성·enable 상태인 모든 user systemd timer와 각 timer가 실행하는 service를 조회해 unit 내용의 SHA-256 기준선을 저장합니다. 전용 timer는 매시 11·26·41·56분에 timer 비활성화, service 실패, unit 설정 변경, 새 timer 추가를 검사하고 2회 연속 이상일 때만 Anubis 운영 알림을 요청합니다.
- 전용 timer 자체가 꺼진 경우를 놓치지 않도록 Manager health watchdog도 같은 감시 스크립트를 교차 실행합니다. 상태·기준선·로그는 `~/.local/state/traefik-manager/user-systemd-unit-watchdog.*`와 `user-systemd-unit-baseline.sha256`에 유지됩니다. Manager 대시보드는 상태·최근 점검·감시 unit 수와 허용된 정형 원인만 표시하며 경로·해시·원문 오류는 노출하지 않습니다.
- user systemd 설치기는 자신의 timer/service가 정상임을 확인한 뒤 `--refresh-baseline`에 해당 unit만 명시합니다. 이 제한 갱신은 다른 unit의 추가·삭제·내용 변경이나 실패 상태를 발견하면 기존 기준선을 유지한 채 실패합니다. 수동 변경도 `scripts/user-systemd-unit-watchdog.sh --refresh-baseline <timer> <service>`로 승인하며, 전체 `--write-baseline`은 기준선 최초 생성에만 사용합니다. 관련 self-test는 임시 홈의 가짜 systemd와 가짜 알림만 사용하므로 실제 운영 알림을 보내지 않습니다.
- `scripts/install-host-utility-timers.sh`는 저장소가 소유하는 `docker-dns-probe`, `nvme-life-alert`, `openclaw-postboot-healthcheck` user timer를 설치하고 지정한 unit만 기준선에 반영합니다. 인자가 없으면 3개 전체를 설치하며 하나만 갱신할 때는 해당 이름을 인자로 전달합니다. 각 self-test는 DNS·Docker·NVMe SMART·메일·Tailscale·HTTPS 호출을 가짜 명령으로 대체합니다.
- Traefik 자기 차단의 즉시 감지·직접 Telegram 알림·정확한 ticket 자동 해제는 Manager 프로세스가 아니라 Anubis의 `anubis-traefik-self-ban-watchdog.timer`가 담당합니다. 결과 파일 `~/.local/state/traefik-manager/traefik-self-ban-watchdog.json`만 backend에 읽기 전용으로 공유하며, API는 내부 IP를 버리고 상태·Jail 이름·시각·해제 건수만 반환합니다.
- 최근 24시간의 실패 알림은 5분 간격으로 최대 3회 자동 재시도하며, 각 재시도 결과도 감사 로그에 남깁니다.
- 관리자 설정 카드의 `최근 정기 실행 로그`에서 호스트 로그 마지막 12줄을 확인할 수 있으며, 상태 디렉터리는 backend에 읽기 전용으로 마운트됩니다.
- 로그인 후 서비스 추가 시 `traefik-config/dynamic/<domain>.yml` 파일이 생성됩니다.
- Traefik 로그 또는 대시보드에서 새 라우터가 반영됩니다.
- `docker compose logs -f backend`에 `/traefik-config/dynamic` 권한 오류가 없습니다.
