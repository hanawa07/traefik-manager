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
| 운영 | Docker 컨테이너 자동 감지, Cloudflare DNS 설정 UI, 시간 표시 타임존 설정, 설정 백업/복원, 로그인 세션 관리 |
| 모니터링 | 업스트림 헬스 체크, Traefik 라우터 상태, 감사 로그 |
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
- RBAC: admin(전체) / viewer(읽기 전용)
- 공통 보안 응답 헤더 전역 적용 (HSTS, nosniff, Referrer-Policy 등)
- 서비스별 frame 정책 (`deny`, `sameorigin`, `off`)
- 비루트 컨테이너 실행, no-new-privileges
- Docker 소켓 read-only 마운트
- 상세 내용: [docs/SECURITY.md](docs/SECURITY.md)

## 시간 처리

- 저장/토큰/감사로그 원본 시각은 UTC 기준으로 유지합니다.
- 관리자 설정에서 화면 표시용 타임존을 IANA 표준(`Asia/Seoul`, `UTC`, `America/New_York` 등)으로 선택할 수 있습니다.
- 설정 화면에는 컨테이너 기준 서버 시간대가 참고 정보로 표시됩니다.

## 문서

- [아키텍처](docs/ARCHITECTURE.md)
- [로드맵](docs/ROADMAP.md)
- [보안](docs/SECURITY.md)
- [배포](docs/DEPLOYMENT.md)

## 라이선스

MIT
