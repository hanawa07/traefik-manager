# 아키텍처 & 폴더 구조

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | Python 3.12 + FastAPI |
| 프론트엔드 | Next.js 16 + React 19 + TypeScript |
| 데이터베이스 | SQLite (SQLAlchemy async) |
| 인증 | 서버 세션 쿠키 + CSRF / 서비스 API Key |
| 컨테이너 | Docker + Docker Compose |
| 리버스 프록시 | Traefik (File Provider) |
| 인증 게이트웨이 | Authentik |

---

## 설계 원칙

- **DDD (Domain-Driven Design)**: 도메인 로직을 인프라와 분리
- **레이어드 아키텍처**: domain → application → infrastructure → interfaces
- **보안 우선**: 비루트 컨테이너, 서버 세션 쿠키 인증, no-new-privileges

---

## 설계 상태

현재 아키텍처는 실험 단계가 아니라 **고정된 운영 구조**로 본다.

- 관리자 인증: 서버 세션 쿠키 + CSRF
- 프록시 설정: Traefik File Provider YAML 생성
- 업스트림 정책: strict mode + allowlist + preset
- 상태 확인: 서비스별 헬스 체크 정책 + 상세 결과 표시
- 보안 대응: 로그인 방어, Turnstile, 보안 경고/알림

이후 변경은 이 구조를 뒤엎는 재설계보다, 현재 경계 안에서의 유지보수와 선택 기능 확장이 기본 원칙이다.

---

## 폴더 구조

```
traefik-manager/
├── docker-compose.yml               # 개발 환경
├── .env.example                     # 환경 변수 템플릿
│
├── docs/                            # 문서
│   ├── ROADMAP.md                   # 기능 계획
│   └── ARCHITECTURE.md              # 이 파일
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                  # FastAPI 앱 진입점
│       │
│       ├── core/                    # 공통 설정
│       │   ├── config.py            # 환경 변수 설정 (pydantic-settings)
│       │   ├── security.py          # 비밀번호 해싱, 서비스 API 토큰/JWT 유틸
│       │   └── session_security.py  # 서버 세션/CSRF 쿠키 유틸
│       │
│       ├── domain/                  # 도메인 레이어 (순수 비즈니스 로직)
│       │   ├── proxy/               # Proxy Bounded Context (핵심 도메인)
│       │   │   ├── entities/
│       │   │   │   └── service.py           # Service (Aggregate Root)
│       │   │   ├── value_objects/
│       │   │   │   ├── domain_name.py       # 도메인 유효성 검증
│       │   │   │   ├── upstream.py          # 업스트림 호스트:포트
│       │   │   │   └── service_id.py        # UUID 래퍼
│       │   │   ├── events/
│       │   │   │   ├── service_created.py
│       │   │   │   ├── service_updated.py
│       │   │   │   └── service_deleted.py
│       │   │   └── repositories/
│       │   │       └── service_repository.py  # 추상 인터페이스
│       │   ├── auth/                # Auth Bounded Context (세션, revoke, cleanup)
│       │   └── certificate/         # Certificate Bounded Context
│       │
│       ├── application/             # 애플리케이션 레이어 (유스케이스)
│       │   ├── proxy/
│       │   │   ├── commands/        # 상태 변경 커맨드
│       │   │   ├── queries/         # 조회 쿼리
│       │   │   └── service_use_cases.py
│       │   ├── auth/                # 로그인 방어, Turnstile 검증, 세션 관리, 이상 징후 탐지, 자동 차단 예외 정책
│       │   ├── audit/               # 감사 로그 기록, 보안 이벤트 요약
│       │   └── certificate/
│       │
│       ├── infrastructure/          # 인프라 레이어 (외부 시스템 연동)
│       │   ├── persistence/
│       │   │   ├── database.py      # SQLAlchemy 비동기 엔진
│       │   │   ├── models.py        # ORM 모델
│       │   │   └── repositories/
│       │   │       ├── sqlite_service_repository.py
│       │   │       └── sqlite_system_settings_repository.py
│       │   ├── traefik/
│       │   │   ├── config_generator.py      # Service → Traefik YAML 변환
│       │   │   └── file_provider_writer.py  # /traefik-config/dynamic/ 에 파일 저장
│       │   ├── cloudflare/
│       │   │   └── client.py        # Cloudflare DNS API 클라이언트
│       │   ├── docker/
│       │   │   └── client.py        # Docker 컨테이너 감지
│       │   ├── health/
│       │   │   └── upstream_checker.py
│       │   ├── network/
│       │   │   └── upstream_dns_guard.py
│       │   ├── auth/
│       │   │   └── session_cleanup.py
│       │   ├── security/
│       │   │   └── turnstile_verifier.py
│       │   ├── notifications/
│       │   │   └── security_alert_notifier.py   # generic/slack/discord/telegram/teams/pagerduty/email 포맷 전송
│       │   └── authentik/
│       │       └── client.py        # Authentik REST API 클라이언트
│       │
│       └── interfaces/              # 인터페이스 레이어 (API)
│           └── api/
│               ├── dependencies.py  # 세션 쿠키/서비스 API Key 인증 의존성
│               └── v1/
│                   ├── routers/
│                   │   ├── auth.py          # POST /api/v1/auth/login
│                   │   ├── services.py      # CRUD /api/v1/services
│                   │   ├── certificates.py  # GET /api/v1/certificates
│                   │   ├── middlewares.py
│                   │   ├── redirects.py
│                   │   ├── settings.py
│                   │   ├── audit.py         # 감사 로그 조회 + 보안 이벤트 요약
│                   │   ├── backup.py
│                   │   ├── docker.py
│                   │   ├── traefik.py
│                   │   └── users.py
│                   └── schemas/
│                       ├── service_schemas.py
│                       ├── settings_schemas.py
│                       └── audit_schemas.py
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts               # API 리라이트 설정
│   └── src/
│       ├── app/                     # Next.js App Router
│       │   ├── layout.tsx
│       │   ├── page.tsx             # 루트 진입
│       │   ├── login/
│       │   └── dashboard/
│       │       ├── page.tsx         # 대시보드
│       │       ├── services/
│       │       │   ├── page.tsx     # 서비스 목록
│       │       │   ├── new/
│       │       │   └── [id]/
│       │       │       └── page.tsx # 서비스 상세/수정
│       │       ├── certificates/
│       │       ├── middlewares/
│       │       ├── redirects/
│       │       ├── audit/
│       │       └── settings/
│       ├── features/                # 기능별 모듈
│       │   ├── services/
│       │   │   ├── components/      # ServiceList, ServiceForm, ServiceCard
│       │   │   ├── hooks/           # useServices
│       │   │   └── api/             # serviceApi
│       │   ├── auth/
│       │   ├── certificates/
│       │   ├── middlewares/
│       │   ├── redirects/
│       │   ├── settings/
│       │   └── audit/
│       └── shared/
│           ├── components/          # Layout, Modal, StatusBadge
│           └── lib/
│               └── apiClient.ts     # Axios 인스턴스 (credentials + CSRF 헤더)
│
└── traefik-config/
    └── dynamic/                     # 앱이 생성하는 Traefik YAML 파일들
                                     # Traefik이 이 디렉토리를 감시하여 자동 반영
```

---

## 데이터 흐름

```
서비스 생성/수정:
  UI 폼 입력
    → POST /api/v1/services (interfaces/api)
      → ServiceUseCases.create_service() (application)
        → Service.create() 도메인 검증 (domain)
          → SQLiteServiceRepository.save() (infrastructure/persistence)
          → FileProviderWriter.write() → /traefik-config/dynamic/domain.yml
          → auth_mode=authentik 인 경우 AuthentikClient 동기화
            → Traefik 자동 감지 및 라우팅 시작

로그인 방어 설정:
  설정 화면 입력
    → PUT /api/v1/settings/login-defense
      → SQLiteSystemSettingsRepository 저장
        → /api/v1/auth/login 에서 자동 차단 on/off, 신뢰 네트워크 예외, Turnstile mode 로드
          → login_anomaly_service가 이상 징후 기록 / IP 차단 여부 결정
          → 반복 차단 상승이 켜져 있으면 이전 차단 이력으로 block_minutes / blocked_until 계산
          → risk_based 모드면 최근 실패 IP 여부를 추가 계산
          → turnstile_verifier가 필요한 시점에만 추가 검증 수행

로그인 보호 공개 설정:
  로그인 페이지 진입
    → GET /api/v1/auth/login-protection
      → system_settings에서 Turnstile mode/site key 조회
        → risk_based면 최근 실패 IP 여부를 함께 계산
        → 프런트가 필요한 시점에만 Turnstile 위젯 렌더링

보안 경고 가시성:
  대시보드 / 감사 로그 진입
    → GET /api/v1/audit/security-summary 또는 GET /api/v1/audit?security_only=true
      → AuditLogModel 조회
        → 최근 잠금 / 이상 징후 / IP 차단 이벤트 요약 및 필터링 결과 반환

보안 웹훅 알림:
  보안 이벤트 기록
    → audit_service.record()
      → security_alert_notifier.notify_if_needed()
        → system_settings에서 webhook 설정 조회
          → 보안 이벤트(`login_locked`, `login_suspicious`, `login_blocked_ip`)와 운영 변경 이벤트(`settings/service/redirect/middleware/user create/update/delete`, `*_rollback`)를 분류
            → 각 그룹별 enabled/route 설정으로 provider 결정
            → generic: 원본 JSON webhook
            → slack: Incoming Webhook blocks/text
            → discord: webhook embed/content
            → telegram: Bot API sendMessage
            → teams: Incoming Webhook adaptive card
            → pagerduty: Events API v2 trigger
            → email: SMTP send_message

인증서 만료 알림:
  startup + 주기 작업
    → certificate_alert_monitor.check_certificate_alerts_once()
      → Traefik API에서 인증서 목록 조회
      → 이전 상태(system_settings.certificate_alert_state)와 비교
        → `warning/error` 진입 시 `certificate_warning` / `certificate_error` 감사 이벤트 기록
        → `warning/error → active` 복귀 시 `certificate_recovered` 감사 이벤트 기록
        → 같은 상태 반복은 중복 전송 억제
  dashboard
    → 현재 인증서 상태는 `/certificates` 응답으로 집계
    → 최근 인증서 경고 전환은 `/audit/certificate-summary`로 요약
    → 대시보드 운영 경고 카드에서 두 정보를 함께 노출
  certificates page
    → 현재 비정상 인증서의 `중복 경고 억제 중` 여부와 `status_started_at` 노출
    → 최근 경고/만료/복구 전이 이력을 함께 표시
  manual action
    → `/certificates/check` 호출 시 즉시 재검사
    → 현재 warning/error 수와 신규 경고 이벤트 수를 응답
```

---

## 보안 설계

- 브라우저 관리자 API는 서버 세션 쿠키 + CSRF 헤더 검증을 사용합니다.
- 서비스 보호용 `forwardAuth`는 서비스 API Key 또는 관리자 세션 쿠키를 검사합니다.
- 로그인 방어는 Traefik rate limit + 앱 레벨 계정 잠금 + 이상 징후/IP 차단의 2단계 구조입니다.
- 선택적으로 Cloudflare Turnstile을 켜서 로그인 직전에 추가 검증을 요구할 수 있습니다.
- 이상 징후 IP 자동 차단은 설정에서 끄거나, 신뢰 네트워크(CIDR/IP) 예외를 둘 수 있습니다.
- 보안 이벤트는 감사 로그에 기록되고, 대시보드/감사 로그 화면에서 별도 요약과 필터로 바로 볼 수 있습니다.
- 운영 설정 저장과 설정 테스트도 같은 감사 로그 파이프라인으로 들어가며, `settings/update`, `settings/test` 흐름으로 추적합니다.
- 서비스/리다이렉트/미들웨어/사용자 수정도 동일한 감사 로그 파이프라인에서 `before/after` diff를 남기고, 안전 롤백 가능 여부를 함께 계산합니다.
- 사용자 롤백은 비밀번호 변경이 포함되지 않은 업데이트만 지원해 비밀값 복구를 감사 로그 payload에 싣지 않도록 제한합니다.
- 안전한 설정(`시간 표시`, `업스트림 보안`)은 audit detail에 롤백 payload를 함께 저장하고, `settings/rollback` 액션으로 복구합니다.
- 선택적으로 보안 이벤트를 외부 채널(generic/slack/discord/telegram/teams/pagerduty/email)로 전송할 수 있으며, 기본 채널 위에 이벤트별 override(telegram/pagerduty/email/disabled)를 둘 수 있습니다. 전송 실패는 원래 로그인 방어 흐름을 막지 않습니다.
- 컨테이너 비루트 사용자 실행
- `no-new-privileges` 보안 옵션
- 프론트엔드-백엔드 내부 네트워크 격리 (`traefik-manager-internal`)
- 프로덕션 환경에서 Swagger UI 비활성화
- CORS 허용 출처 명시적 설정
- 업스트림 저장 시 DNS strict mode, allowlist, preset 조합으로 정책을 적용할 수 있습니다.
