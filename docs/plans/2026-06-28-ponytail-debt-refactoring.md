# Ponytail Debt 리팩토링 계획

## 목표
- 기존 동작을 유지하면서 `PONYTAIL-DEBT`로 표시한 파일을 500줄 이하, 단일 책임 구조로 분리한다.
- 각 단계는 독립 커밋으로 진행하고, 단계마다 관련 테스트와 프론트 lint/build를 통과시킨다.

## 1. 설정 페이지 분리 - 완료
- 대상: `frontend/src/app/dashboard/settings/page.tsx`
- 완료 내용:
  - 설정 카드, 편집 폼, 페이지 모델을 기능별 컴포넌트와 훅으로 분리했다.
  - `page.tsx`는 페이지 모델과 섹션 배치만 담당하며 500줄 이하를 유지한다.
- 검증: `cd frontend && npm run lint && npm run build`, 설정 화면 수동 확인.

## 2. 설정 훅 반복 제거 - 완료
- 대상: `frontend/src/features/settings/hooks/useSettings.ts`
- 완료 내용:
  - query key와 invalidation helper를 공통화했다.
  - 조회, 변경, rollback, 백업 복원 훅을 책임별 파일로 분리했다.
- 검증: `cd frontend && npm run lint && npm run build`.

## 3. 설정 API 라우터 반복 제거 - 완료
- 대상: `backend/app/interfaces/api/v1/routers/settings.py`
- 완료 내용:
  - 표준 설정 라우트를 route spec과 실행 wiring으로 분리했다.
  - Cloudflare와 외부 호출이 필요한 설정 액션은 별도 라우터에 유지했다.
  - 감사 기록, 응답 빌더, rollback 로직을 각각 분리했다.
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

## 7. 프론트엔드 ESLint 10 전환 - 업스트림 대기
- `PONYTAIL-DEBT(frontend-eslint-10)`: `eslint-config-next@16.2.12`의 내부 `eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`가 ESLint 10 API를 지원하지 않는다.
- 2026-07-30 기준 ESLint 10 전환 시 `react/display-name` 규칙 로딩이 실패하는 것을 확인하고 ESLint 9로 복구했다.
- 2026-08-01 재점검에서도 최신 `eslint@10.8.0`, `eslint-config-next@16.2.12` 조합은 동일한 `contextOrFilename.getFilename is not a function` 오류로 중단됐다. 최신 React 7.37.5, Import 2.32.0, JSX a11y 6.10.2 플러그인의 peer 범위도 ESLint 9까지만 허용한다.
- 재현 명령: `cd frontend && npm exec --yes --package=eslint@10.8.0 -- eslint .`.
- 취약한 `brace-expansion` 1.x를 5.x로 강제 교체하면 CommonJS 호출 형식이 달라 기존 `minimatch` 3.x와 호환되지 않으므로 override하지 않는다.
- 현재 `npm audit --omit=dev`는 0건이며, 전체 audit의 High 9건은 ESLint와 내장 플러그인의 개발 전용 경로에 한정된다.
- 재개 조건: Next.js 내장 플러그인이 ESLint 10을 공식 지원하고 `npm audit`에서 `GHSA-mh99-v99m-4gvg` 경로가 제거될 때 lint/build를 다시 검증한다.
