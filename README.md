# Traefik Manager

Traefik + Authentik 통합 관리 도구. Nginx Proxy Manager(NPM)를 대체하여 도메인 라우팅, TLS 인증서, 서비스 인증(Authentik, API 토큰, Basic Auth)을 하나의 UI에서 관리합니다.

## 스크린샷

> 대시보드, 서비스 목록, 인증서 현황, 업스트림 헬스 체크

## 기능

| 분류 | 기능 |
|------|------|
| 서비스 관리 | 도메인 라우팅 CRUD, 업스트림 HTTP/HTTPS, TLS 검증 무시, 차단 경로(blocked_paths), Traefik File Provider YAML 자동 생성 |
| TLS | 인증서 목록 조회, 만료일 경고, Let's Encrypt 자동 갱신 |
| 인증 | Authentik ForwardAuth 자동 연동, 그룹별 접근 제어, 서비스 전용 API 토큰, Basic Auth 사용자 관리 |
| 미들웨어 | IP 허용 목록, Rate Limiting, 커스텀 응답 헤더, 서비스별 frame 정책, 미들웨어 템플릿 재사용 |
| 리다이렉트 | 도메인 간 영구/임시 리다이렉트 |
| 운영 | Docker 컨테이너 자동 감지, Cloudflare DNS 설정 UI/일괄 재동기화, 시간 표시 타임존 설정, 설정 백업/복원, 로그인 세션 관리, 업스트림 DNS strict mode/allowlist/preset, 로그인 방어 예외 정책, Cloudflare Turnstile 로그인 보호(off/always/risk-based), 보안 웹훅/이메일 알림, Slack/Discord/Telegram/Teams/PagerDuty/Email 알림 preset |
| 모니터링 | 업스트림 헬스 체크, Traefik 라우터 상태, 감사 로그, 대시보드 보안/운영 경고 요약, provider별 보안 이벤트 전송 |
| 보안 | 서버 세션 쿠키 인증, 서비스 API Key, 로그인 Rate Limiting, RBAC(admin/viewer) |

## 기술 스택

- **백엔드**: Python 3.12 + FastAPI + SQLAlchemy (async) + SQLite
- **프론트엔드**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **인프라**: Docker + Traefik v3 + Authentik

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- 실행 중인 [Traefik v3](https://traefik.io) 인스턴스
- (선택) [Authentik](https://goauthentik.io) 인스턴스

### 설치

```bash
git clone https://github.com/hanawa07/traefik-manager.git
cd traefik-manager

# 환경 변수 설정
cp .env.example .env
vi .env  # 필수 값 입력
```

### 주요 환경 변수

```env
# 보안 키 (랜덤 32자 이상 문자열)
APP_SECRET_KEY=
JWT_SECRET_KEY=

# 도메인
FRONTEND_DOMAIN=traefik-manager.example.com
BACKEND_DOMAIN=traefik-manager-api.example.com

# 프론트엔드/백엔드 연결
NEXT_PUBLIC_API_URL=/api/v1
BACKEND_UPSTREAM_URL=http://backend:8000

# 관리자 계정
ADMIN_USERNAME=admin
ADMIN_PASSWORD=

# Authentik (선택)
AUTHENTIK_URL=http://authentik:9000
AUTHENTIK_TOKEN=
```

- `FRONTEND_DOMAIN`은 프런트 공개 도메인이며 Next.js `metadataBase` 기준 URL로도 사용됩니다. 스킴을 생략하면 `https://`를 기준으로 처리합니다.
- `NEXT_PUBLIC_API_URL`의 운영 권장값은 상대 경로 `/api/v1`입니다.
- `BACKEND_UPSTREAM_URL`은 프런트 컨테이너가 내부적으로 백엔드 API를 프록시할 때 사용하는 업스트림 주소입니다.

### 실행

```bash
docker compose up -d --build
```

프론트엔드: `https://<FRONTEND_DOMAIN>`

배포 시 네트워크, Traefik 연동, 보안 헤더 구조, 검증 체크리스트는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)를 참고하세요.

### Traefik 연동

Traefik의 File Provider 디렉토리를 traefik-manager가 생성하는 경로와 동일하게 설정합니다.

```yaml
# traefik docker-compose.yml
volumes:
  - /path/to/traefik-manager/traefik-config:/traefik-config:ro
command:
  - --providers.file.directory=/traefik-config/dynamic
  - --providers.file.watch=true
```

## 아키텍처

DDD(Domain-Driven Design) 기반 레이어드 아키텍처

```
backend/app/
├── domain/          # 비즈니스 규칙, 엔티티, Value Objects
├── application/     # Use Cases
├── infrastructure/  # DB, Traefik API, Authentik API, Docker
└── interfaces/      # FastAPI 라우터, 스키마
```

## 보안

- 브라우저 관리자 로그인은 `HttpOnly` 세션 쿠키 기반 인증
- 설정 화면에서 현재 세션 목록, 개별 세션 종료, 전체 로그아웃 지원
- 서비스 전용 API Key 기반 `forwardAuth` 인증 유지
- 로그인 Rate Limiting (Traefik 미들웨어)
- 앱 레벨 로그인 방어 (실패 횟수 누적, 시간 창 기반 계정 잠금, 이상 징후 IP 임시 차단, 감사 로그 기록)
- RBAC: admin(전체) / viewer(읽기 전용)
- 공통 보안 응답 헤더 전역 적용 (HSTS, nosniff, Referrer-Policy 등)
- 서비스별 frame 정책 (`deny`, `sameorigin`, `off`)
- 선택형 업스트림 DNS strict mode + allowlist 정책 (외부 FQDN suffix, Docker 서비스명, 사설 IPv4/Tailscale IP 제어, preset 빠른 적용)
- 비루트 컨테이너 실행, no-new-privileges
- Docker 소켓 read-only 마운트
- 상세 내용: [docs/SECURITY.md](docs/SECURITY.md)

## 시간 처리

- 저장/토큰/감사로그 원본 시각은 UTC 기준으로 유지합니다.
- 관리자 설정에서 화면 표시용 타임존을 IANA 표준(`Asia/Seoul`, `UTC`, `America/New_York` 등)으로 선택할 수 있습니다.
- 설정 화면에는 컨테이너 기준 서버 시간대가 참고 정보로 표시됩니다.

## 로그인 방어

- 브라우저 관리자 로그인에는 Traefik rate limit과 별도로 앱 레벨 계정 잠금이 적용됩니다.
- 기본값은 `15분 동안 5회 실패 시 15분 잠금`입니다.
- `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_FAILURE_WINDOW_MINUTES`, `LOGIN_LOCKOUT_MINUTES`로 조정할 수 있습니다.
- 같은 시간 창 안에서 동일 IP가 여러 사용자명에 대해 반복 실패하면 `login_suspicious` 감사 이벤트를 남깁니다.
- 최근 `login_suspicious`가 기록된 IP는 일정 시간 동안 로그인 자체를 거부하고 `login_blocked_ip` 감사 이벤트를 남깁니다.
- `LOGIN_SUSPICIOUS_WINDOW_MINUTES`, `LOGIN_SUSPICIOUS_FAILURE_COUNT`, `LOGIN_SUSPICIOUS_USERNAME_COUNT`, `LOGIN_SUSPICIOUS_BLOCK_MINUTES`로 조정할 수 있습니다.
- 설정 화면에서 반복 차단 시간 자동 상승을 켜면 같은 IP가 다시 차단될 때 차단 시간이 배수만큼 늘어나고 최대 시간에서 멈춥니다.
- 설정 화면에서 `이상 징후 IP 자동 차단`을 끄거나, `신뢰 네트워크 예외(CIDR/IP)`를 등록할 수 있습니다.
- 설정 화면에서 `Cloudflare Turnstile` 로그인 보호를 `비활성화 / 항상 적용 / 위험 기반 적용`으로 전환할 수 있습니다.
- `위험 기반 적용`은 최근 실패가 누적된 IP에만 Turnstile을 요구하고, `항상 적용`은 로그인마다 즉시 위젯을 표시합니다.
- Turnstile이 필요한 시점에는 로그인 페이지가 site key로 위젯을 표시하고, 백엔드는 secret key로 토큰을 검증합니다.
- 신뢰 네트워크는 이상 징후 기록과 IP 자동 차단만 우회하며, 사용자별 계정 잠금은 그대로 적용됩니다.
- 잠금/실패/이상 징후/IP 차단 이벤트는 감사 로그에 함께 남습니다.
- 대시보드에서 최근 보안 경고 요약을 바로 확인할 수 있고, 감사 로그 화면에서 보안 이벤트만 빠르게 필터링할 수 있습니다.
- 설정 화면에서 저장하는 주요 운영 설정도 감사 로그에 `settings/update`로 기록되며, 감사 로그 화면에서 `설정 변경`/`설정 테스트` 필터로 바로 확인할 수 있습니다.
- `보안 알림` 카드에서는 마지막 테스트 전송뿐 아니라 최근 실제 보안 이벤트 전송/운영 변경 전송의 성공·실패 이력, 최근 24시간 실패 수, 마지막 실패 재시도 액션도 바로 볼 수 있습니다.
- 감사 로그 화면에서는 `알림 전송`만 따로 보고, `성공/실패`와 `채널(provider)` 기준으로 delivery 로그를 바로 좁혀볼 수 있습니다.
- `시간 표시 설정`, `업스트림 보안 설정`은 감사 로그에서 변경 diff를 확인하고 안전 롤백을 실행할 수 있습니다.
- `서비스 수정`, `리다이렉트 수정`, `미들웨어 수정`도 감사 로그에서 `before/after` diff를 펼쳐 보고, 안전 조건을 만족하면 이전 상태로 롤백할 수 있습니다.
- `사용자 수정`도 감사 로그에서 변경 diff를 확인할 수 있고, 비밀번호 변경이 없는 안전한 경우에만 이전 상태로 롤백할 수 있습니다.
- 설정 화면에서 보안 알림 기본 채널을 `Generic Webhook`, `Slack`, `Discord`, `Telegram`, `Microsoft Teams`, `PagerDuty`, `Email` 중에서 선택할 수 있습니다.
- `login_locked`, `login_suspicious`, `login_blocked_ip` 이벤트는 기본 채널을 따르거나, `Telegram / PagerDuty / Email / 전송 안 함`으로 개별 override할 수 있습니다.
- `settings/service/redirect/middleware/user`의 `create/update/delete`와 각종 `rollback` 이벤트도 별도 운영 변경 알림 정책으로 기본 채널 또는 override를 탈 수 있습니다.
- 인증서 알림은 `상태 전이(만료 임박/오류/복구)`와 `발급 반복 실패`를 분리해서 채널 override를 다르게 줄 수 있으며, 기존 `certificate_change` 설정이 있으면 두 그룹에 자동 승계됩니다.
- 감사 로그 화면에서 실패한 알림 전송 행을 펼쳐 `채널 / 원본 이벤트 / 실패 상세`를 보고 즉시 재시도할 수 있습니다.
- 인증서 상태 체크는 `certificate_warning` / `certificate_error` / `certificate_recovered` 이벤트를 기록하고, 같은 상태의 중복 알림은 억제합니다.
- 인증서 화면에서는 현재 경고 상태의 `중복 경고 억제 중` 여부와 상태 시작 시각을 함께 표시합니다.
- 인증서 화면에서 `경고 검사`를 실행하면 즉시 재스캔하고, 새 경고/복구 이벤트가 있었는지까지 바로 확인할 수 있습니다.
- 인증서 화면의 `사전 진단`은 결과를 audit snapshot으로 저장하고, 같은 실패가 반복되면 `certificate_preflight_repeated_failure` 이벤트를 기록해 기존 인증서 경고 채널로 알릴 수 있습니다. 같은 실패 유형의 반복 알림은 쿨다운 안에서 자동으로 억제합니다.
- 비정상 인증서(`warning/error/pending`)와 최근 ACME 실패가 있는 도메인은 백그라운드에서 자동 `사전 진단`을 다시 실행해 반복 실패 추적을 이어갑니다.
- 설정 화면의 `인증서 진단` 카드에서 자동 재검사 주기와 반복 실패 감지/알림 기준을 조정할 수 있습니다.
- 설정 화면에서 `Traefik 디버그 대시보드` public route를 켜고 끌 수 있습니다. 이 기능은 Traefik 내장 dashboard 엔진을 바꾸는 게 아니라 `api@internal`용 공개 라우트를 생성/삭제하는 방식입니다.
- Telegram은 bot token + chat id를 사용하고, PagerDuty는 routing key를 사용하며, Generic/Slack/Discord/Teams는 webhook URL을 사용합니다. Email은 SMTP host/port/security/from/recipients를 사용합니다.

## 문서

- [아키텍처](docs/ARCHITECTURE.md)
- [로드맵](docs/ROADMAP.md)
- [보안](docs/SECURITY.md)
- [배포](docs/DEPLOYMENT.md)

## 라이선스

MIT
