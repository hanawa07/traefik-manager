# Ponytail Debt 리팩토링 계획

## 목표
- 기존 동작을 유지하면서 `PONYTAIL-DEBT`로 표시한 파일을 500줄 이하, 단일 책임 구조로 분리한다.
- 각 단계는 독립 커밋으로 진행하고, 단계마다 관련 테스트와 프론트 lint/build를 통과시킨다.

## 1. 설정 페이지 분리
- 대상: `frontend/src/app/dashboard/settings/page.tsx`
- 현재 문제: 설정 화면 전체가 단일 클라이언트 컴포넌트에 집중되어 3,000줄을 넘는다.
- 실행 순서:
  - 읽기 전용 요약 컴포넌트와 공통 카드/상태 컴포넌트를 먼저 분리한다.
  - Cloudflare, 보안 알림, 로그인 방어, Traefik 대시보드, 백업/복원 섹션을 순차 분리한다.
  - 분리 후 `page.tsx`는 데이터 조립과 섹션 배치만 담당하게 한다.
- 검증: `cd frontend && npm run lint && npm run build`, 설정 화면 수동 확인.

## 2. 설정 훅 반복 제거
- 대상: `frontend/src/features/settings/hooks/useSettings.ts`
- 현재 문제: `useQuery`, `useMutation`, `invalidateQueries` 패턴이 설정 종류마다 반복된다.
- 실행 순서:
  - 단일 query key invalidation helper를 먼저 만든다.
  - 단순 update mutation부터 helper로 옮긴다.
  - 여러 query를 무효화하는 import/rollback 계열은 마지막에 분리한다.
- 검증: `cd frontend && npm run lint && npm run build`.

## 3. 설정 API 라우터 반복 제거
- 대상: `backend/app/interfaces/api/v1/routers/settings.py`
- 현재 문제: get/update/audit/rollback 흐름이 설정 그룹마다 반복된다.
- 실행 순서:
  - 단순 설정 그룹의 build/update/summary 함수를 registry로 묶는다.
  - Cloudflare, 보안 알림처럼 외부 호출과 검증이 많은 그룹은 보류한다.
  - rollback 지원 범위는 기존 테스트를 먼저 보강한 뒤 확장한다.
- 검증: `cd backend && PYTHONPATH=. ./venv/bin/pytest tests/interfaces/api/test_settings_router.py`.

## 4. Authentik 클라이언트 요청 helper 도입 - 완료
- 대상: `backend/app/infrastructure/authentik/client.py`
- 현재 문제: `httpx.AsyncClient`, headers, timeout, status handling이 메서드마다 반복된다.
- 완료 내용:
  - `_request()` helper를 추가하고 GET/POST/DELETE 반복을 줄였다.
  - URL 조립과 응답 JSON 처리는 메서드별 의미를 유지했다.
  - 기존 DELETE의 non-raising 동작을 유지했다.
- 검증: `cd backend && PYTHONPATH=. ./venv/bin/pytest tests/infrastructure/test_authentik_client.py`.

## 5. Traefik API 클라이언트 책임 분리 - 완료
- 대상: `backend/app/infrastructure/traefik/traefik_api_client.py`
- 현재 문제: health/version, router/middleware, certificate, Docker ACME/log, preflight가 한 클래스에 모여 있다.
- 완료 내용:
  - 런타임 응답 정규화, ACME/인증서 파싱, Docker 소켓 읽기, 인증서 preflight를 각각 별도 모듈로 분리했다.
  - `TraefikApiClient`는 외부 API 호출과 결과 조립만 담당하도록 줄였다.
  - Docker 읽기와 preflight 네트워크 검사는 모듈 함수 seam으로 테스트한다.
- 검증: Traefik API 클라이언트/인증서 라우터 테스트 통과.

## 6. Repository ABC 유지 여부 결정 - 완료
- 대상: `backend/app/domain/proxy/repositories/*`, `backend/app/domain/auth/repositories/*`
- 현재 문제: production 구현이 SQLite 하나뿐인 ABC 계층이 많다.
- 결정: Repository ABC는 application 계층이 infrastructure 구현체에 직접 의존하지 않게 하는 domain port로 유지한다.
- 완료 내용:
  - `PONYTAIL-DEBT(repo-abc)` marker를 제거하고 `ServiceRepository`의 의도를 docstring으로 명시했다.
  - 현재 파일들은 모두 500줄 미만이며, 단일 책임을 벗어나지 않는다.
- 검증: backend 전체 pytest.
