# 아키텍처 & 폴더 구조

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | Python 3.12 + FastAPI |
| 프론트엔드 | Next.js 16 + React 19 + TypeScript |
| 데이터베이스 | SQLite (SQLAlchemy async) |
| 인증 | JWT (python-jose) |
| 컨테이너 | Docker + Docker Compose |
| 리버스 프록시 | Traefik (File Provider) |
| 인증 게이트웨이 | Authentik |

---

## 설계 원칙

- **DDD (Domain-Driven Design)**: 도메인 로직을 인프라와 분리
- **레이어드 아키텍처**: domain → application → infrastructure → interfaces
- **보안 우선**: 비루트 컨테이너, JWT 인증, no-new-privileges

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
│       │   └── security.py          # JWT, 비밀번호 해싱
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
│       │   ├── auth/                # Auth Bounded Context
│       │   └── certificate/         # Certificate Bounded Context
│       │
│       ├── application/             # 애플리케이션 레이어 (유스케이스)
│       │   ├── proxy/
│       │   │   ├── commands/        # 상태 변경 커맨드
│       │   │   ├── queries/         # 조회 쿼리
│       │   │   └── service_use_cases.py
│       │   ├── auth/
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
│       │   └── authentik/
│       │       └── client.py        # Authentik REST API 클라이언트
│       │
│       └── interfaces/              # 인터페이스 레이어 (API)
│           └── api/
│               ├── dependencies.py  # JWT 인증 의존성
│               └── v1/
│                   ├── routers/
│                   │   ├── auth.py          # POST /api/v1/auth/login
│                   │   ├── services.py      # CRUD /api/v1/services
│                   │   ├── certificates.py  # GET /api/v1/certificates
│                   │   ├── middlewares.py
│                   │   ├── redirects.py
│                   │   ├── settings.py
│                   │   ├── audit.py
│                   │   ├── backup.py
│                   │   ├── docker.py
│                   │   ├── traefik.py
│                   │   └── users.py
│                   └── schemas/
│                       └── service_schemas.py
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
│               └── apiClient.ts     # Axios 인스턴스 (JWT 자동 첨부)
│
└── traefik-config/
    └── dynamic/                     # 앱이 생성하는 Traefik YAML 파일들
                                     # Traefik이 이 디렉토리를 감시하여 자동 반영
```

---

## 데이터 흐름

```
UI 폼 입력
  → POST /api/v1/services (interfaces/api)
    → ServiceUseCases.create_service() (application)
      → Service.create() 도메인 검증 (domain)
        → SQLiteServiceRepository.save() (infrastructure/persistence)
        → FileProviderWriter.write() → /traefik-config/dynamic/domain.yml
        → auth_mode=authentik 인 경우 AuthentikClient 동기화
          → Traefik 자동 감지 및 라우팅 시작
```

---

## 보안 설계

- 모든 API 엔드포인트 JWT 인증 필수 (로그인 제외)
- 컨테이너 비루트 사용자 실행
- `no-new-privileges` 보안 옵션
- 프론트엔드-백엔드 내부 네트워크 격리 (`traefik-manager-internal`)
- 프로덕션 환경에서 Swagger UI 비활성화
- CORS 허용 출처 명시적 설정
