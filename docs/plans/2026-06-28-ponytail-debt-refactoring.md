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
- `PONYTAIL-DEBT(frontend-eslint-10)`: 최신 `eslint-config-next@16.3.0`도 내부 `eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`가 ESLint 10 API를 지원하지 않는다.
- 2026-07-30 기준 ESLint 10 전환 시 `react/display-name` 규칙 로딩이 실패하는 것을 확인하고 ESLint 9로 복구했다.
- 2026-08-01 재점검에서도 최신 `eslint@10.8.0`, `eslint-config-next@16.2.12` 조합은 동일한 `contextOrFilename.getFilename is not a function` 오류로 중단됐다. 최신 React 7.37.5, Import 2.32.0, JSX a11y 6.10.2 플러그인의 peer 범위도 ESLint 9까지만 허용한다.
- 2026-08-05 재점검에서도 `eslint@10.8.0` 실제 lint가 같은 오류로 중단됐다. `eslint-config-next@16.3.0`은 ESLint peer 범위를 `>=9`로 선언하지만, 포함된 세 플러그인의 최신 peer 범위는 여전히 ESLint 9까지다.
- 재현 명령: `cd frontend && npm exec --yes --package=eslint@10.8.0 -- eslint .`.
- 현재 `npm audit --omit=dev`와 전체 `npm audit`는 모두 0건이다. 보안상 강제 override나 ESLint 10 선행 전환이 필요한 상태가 아니다.
- 재개 조건: Next.js 내장 플러그인이 ESLint 10 API와 peer 범위를 공식 지원할 때 lint/build를 다시 검증한다.

## 8. 2026-08-05 Ponytail debt 재감사 - 완료

### 1) 정말 삭제 가능한 것
- 없음. 완료된 계획 문서는 의사결정 이력이고, production 구현 하나인 Repository ABC는 domain port로 유지한다는 기존 결정을 뒤집을 새 근거가 없다.

### 2) 리팩토링 후보
- 즉시 분리할 후보는 없다. 가장 긴 소스인 `Service` 355줄은 aggregate root, `SmokeRunStatisticsHistory` 316줄은 한 화면 기능, `app_background_checks` 238줄은 background task composition root로 각각 한 책임을 유지한다.
- 추적 중인 Python, TypeScript, JavaScript, shell 소스에서 500줄을 넘는 파일은 0개다. 500줄을 넘는 추적 파일은 lockfile과 이미지뿐이다.

### 3) 위험해서 보류할 것
- `Service.create()`와 `Service.update()`는 인자가 많지만 API·persistence mapping과 맞물린 aggregate 불변식 경계다. 줄 수만 줄이기 위한 요청 객체나 추가 계층은 변경 범위를 키우므로 실제 필드군이 더 늘거나 불변식 누락이 발견될 때만 재검토한다.
- `SmokeRunStatisticsHistory`와 background task wiring은 500줄 기준에 충분한 여유가 있고 호출 흐름도 한 파일에서 읽힌다. 별도 책임이 추가되기 전에는 분리하지 않는다.

### 4) Ponytail debt marker로 남길 것
- `containerImportFiltering.ts`: 비 HTTP 컨테이너 식별자는 실제 오탐·미탐 엔진이 관측될 때만 확장한다.
- `containerImportFiltering.ts`: Compose gateway 검색은 Docker 목록에서 실제 병목이 측정될 때만 프로젝트 맵으로 바꾼다.
- `smokeStatisticsHistory.ts`: 지연 임계치는 실제 오탐이 관측될 때만 설정값으로 승격한다.
- `settings_test_history.py`: 10초 cache는 audit writer 전반의 즉시 invalidation 요구가 생길 때만 교체한다.
- 코드의 `PONYTAIL-DEBT(...)` marker는 0개이며, 위 `ponytail:` marker 4개는 모두 구체적인 재검토 조건을 가진다.
