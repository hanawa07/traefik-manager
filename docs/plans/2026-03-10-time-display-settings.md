# Time Display Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 관리자 설정에서 IANA 타임존 전체 중 표시 시간대를 선택하고, 현재 서버 시간대/현재 서버 시각을 표시하며, 주요 UI 날짜 표시에 선택한 시간대를 적용한다.

**Architecture:** 저장/토큰/감사로그 원본 시각은 기존처럼 UTC 기준을 유지한다. 별도 시스템 설정 키로 전역 표시 시간대(IANA 문자열)를 저장하고, 백엔드는 서버 시간대 정보를 응답으로 제공하며, 프런트는 공통 포맷터로 감사 로그와 인증서 만료 시각 표시를 일관되게 렌더링한다.

**Tech Stack:** FastAPI, SQLite system settings, React Query, Next.js App Router, Intl.DateTimeFormat

---

### Task 1: 표시 시간대 도메인 로직 추가

**Files:**
- Create: `backend/app/core/time_display.py`
- Test: `backend/tests/core/test_time_display.py`

**Step 1: Write the failing test**

테스트에서 다음을 검증한다.
- 미설정/잘못된 값이면 `Asia/Seoul`로 정규화된다.
- `UTC`, `Asia/Seoul`, `America/New_York` 같은 유효한 IANA 타임존이 그대로 허용된다.
- 서버 시간 정보는 시간대 이름, 오프셋, timezone-aware ISO 시각을 반환한다.

**Step 2: Run test to verify it fails**

Run: `env PYTHONPATH=. venv/bin/pytest tests/core/test_time_display.py -q`

**Step 3: Write minimal implementation**

`normalize_display_timezone()`, `get_display_timezone_name()`, `get_server_time_context()`를 구현한다.

**Step 4: Run test to verify it passes**

Run: `env PYTHONPATH=. venv/bin/pytest tests/core/test_time_display.py -q`

**Step 5: Commit**

보류

### Task 2: 설정 API 확장

**Files:**
- Modify: `backend/app/interfaces/api/v1/schemas/settings_schemas.py`
- Modify: `backend/app/interfaces/api/v1/routers/settings.py`
- Test: `backend/tests/interfaces/api/test_settings_router.py`

**Step 1: Write the failing test**

테스트에서 다음을 검증한다.
- GET `/settings/time-display`는 현재 표시 시간대(IANA), 저장 기준 UTC, 서버 시간 정보 반환
- PUT `/settings/time-display`는 admin만 변경 가능
- 잘못된 값은 422

**Step 2: Run test to verify it fails**

Run: `env PYTHONPATH=. venv/bin/pytest tests/interfaces/api/test_settings_router.py -q`

**Step 3: Write minimal implementation**

system settings key `display_timezone`을 읽고/저장하는 라우트를 추가한다.

**Step 4: Run test to verify it passes**

Run: `env PYTHONPATH=. venv/bin/pytest tests/interfaces/api/test_settings_router.py -q`

**Step 5: Commit**

보류

### Task 3: 프런트 설정 UI와 공통 포맷터 연결

**Files:**
- Modify: `frontend/src/features/settings/api/settingsApi.ts`
- Modify: `frontend/src/features/settings/hooks/useSettings.ts`
- Create: `frontend/src/shared/lib/dateTimeFormat.ts`
- Modify: `frontend/src/app/dashboard/settings/page.tsx`
- Modify: `frontend/src/app/dashboard/audit/page.tsx`
- Modify: `frontend/src/app/dashboard/certificates/page.tsx`

**Step 1: Write the failing verification target**

기능 확인 포인트를 정의한다.
- 설정 페이지에 표시 시간대 카드가 보인다.
- 서버 시간대와 현재 서버 시간이 보인다.
- 시간대 변경 후 감사 로그/인증서 날짜 표시가 해당 시간대로 바뀐다.

**Step 2: Implement minimal frontend changes**

React Query로 시간대 설정을 조회/저장하고, 검색 가능한 IANA 타임존 입력과 공통 `formatDateTime()` 유틸로 화면 표시를 통일한다.

**Step 3: Run production build**

Run: `npm run build`

**Step 4: Commit**

보류

### Task 4: 문서 반영 및 전체 검증

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/DEPLOYMENT.md` (필요 시)

**Step 1: Update docs**

저장 UTC / 표시 시간대 설정 / 서버 시간 정보 노출 정책을 문서화한다.

**Step 2: Run combined verification**

Run:
- `env PYTHONPATH=. venv/bin/pytest tests/core/test_time_display.py tests/interfaces/api/test_settings_router.py tests/domain/test_upstream.py tests/application/auth/test_auth_use_cases.py tests/core/test_security.py tests/infrastructure/persistence/test_sqlite_service_repository.py -q`
- `python3 -m py_compile backend/app/core/time_display.py backend/app/interfaces/api/v1/routers/settings.py backend/app/interfaces/api/v1/schemas/settings_schemas.py`
- `npm run build`

**Step 3: Commit**

보류
