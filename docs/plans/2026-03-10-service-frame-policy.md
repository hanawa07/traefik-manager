# Service Frame Policy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 전역 `X-Frame-Options` 강제를 서비스별 frame 정책으로 분리해 Cockpit 같은 iframe 기반 앱을 지원하면서 기존 기본 보안 수준을 유지한다.

**Architecture:** 엔트리포인트 전역 `security-headers` 미들웨어에서는 frame 정책을 제거하고, 각 서비스 라우터가 자신의 `frame_policy`에 맞는 Traefik `headers` 미들웨어를 생성한다. 서비스 기본값은 `deny`로 두어 기존 동작을 유지하고, 예외 앱만 `sameorigin` 또는 `off`를 선택할 수 있게 한다.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Traefik file provider, Next.js, React Hook Form, Zod

---

### Task 1: 설계와 배포 제약 문서화

**Files:**
- Create: `docs/plans/2026-03-10-service-frame-policy.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/DEPLOYMENT.md`

**Step 1: 현재 문제와 원인 기록**

- 전역 `security-headers@file`가 `X-Frame-Options: DENY`를 주입해 Cockpit iframe shell을 깨뜨린다는 점을 문서에 남긴다.
- `DENY -> SAMEORIGIN` 전역 치환이 아니라 서비스별 정책 분리라는 설계 원칙을 명시한다.

**Step 2: 배포 마이그레이션 가이드 추가**

- 전역 `security-headers`에서 frame 정책을 제거하고, 서비스 생성기가 라우터별 frame 정책 미들웨어를 붙인다는 배포 순서를 적는다.
- 기본값 `deny`, Cockpit 예외 `sameorigin`을 문서에 명시한다.

### Task 2: failing test 추가

**Files:**
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/infrastructure/test_config_generator.py`
- Modify: `backend/tests/infrastructure/persistence/test_sqlite_service_repository.py`

**Step 1: 생성기 테스트 추가**

- 기본 서비스가 `frame_policy="deny"`일 때 라우터별 headers 미들웨어를 생성하는 테스트를 추가한다.
- `frame_policy="sameorigin"`일 때 `customFrameOptionsValue: "SAMEORIGIN"`을 생성하는 테스트를 추가한다.
- `frame_policy="off"`일 때 frame 헤더 미들웨어를 생성하지 않는 테스트를 추가한다.

**Step 2: 저장소 round-trip 테스트 추가**

- `ServiceModel`과 엔티티 변환 시 `frame_policy`가 보존되는 테스트를 추가한다.

**Step 3: RED 확인**

Run: `cd backend && pytest tests/infrastructure/test_config_generator.py tests/infrastructure/persistence/test_sqlite_service_repository.py -q`

Expected: `frame_policy` 관련 실패

### Task 3: 백엔드 모델과 생성기 구현

**Files:**
- Modify: `backend/app/domain/proxy/entities/service.py`
- Modify: `backend/app/infrastructure/traefik/config_generator.py`
- Modify: `backend/app/infrastructure/persistence/models.py`
- Modify: `backend/app/infrastructure/persistence/repositories/sqlite_service_repository.py`
- Modify: `backend/app/application/proxy/service_use_cases.py`
- Modify: `backend/app/interfaces/api/v1/schemas/service_schemas.py`
- Modify: `backend/app/application/backup/backup_use_cases.py`
- Modify: `backend/app/interfaces/api/v1/schemas/backup_schemas.py`
- Create: `backend/alembic/versions/20260310_05_add_service_frame_policy.py`

**Step 1: 도메인 기본값과 검증 추가**

- `Service`에 `frame_policy` 필드를 추가한다.
- 허용값은 `deny | sameorigin | off`.
- 기본값은 `deny`.

**Step 2: 생성기 구현**

- 전역 `custom_headers` 미들웨어와 별개로 route-level frame policy middleware를 생성한다.
- `deny`는 `frameDeny: true`.
- `sameorigin`은 `customFrameOptionsValue: "SAMEORIGIN"`.
- `off`는 frame 관련 headers 미들웨어를 만들지 않는다.

**Step 3: persistence/API 반영**

- SQLAlchemy 모델, repository save/load, create/update schema, response schema, backup import/export에 `frame_policy`를 반영한다.
- Alembic migration에서 기존 레코드 기본값을 `deny`로 채운다.

**Step 4: GREEN 확인**

Run: `cd backend && pytest tests/infrastructure/test_config_generator.py tests/infrastructure/persistence/test_sqlite_service_repository.py -q`

Expected: PASS

### Task 4: 프런트 설정 노출

**Files:**
- Modify: `frontend/src/features/services/api/serviceApi.ts`
- Modify: `frontend/src/features/services/components/ServiceForm.tsx`
- Modify: `frontend/src/app/dashboard/services/[id]/page.tsx`

**Step 1: 타입 추가**

- `Service`, `ServiceCreate`, `ServiceUpdate`에 `frame_policy`를 추가한다.

**Step 2: 폼 UI 추가**

- 서비스 폼에 frame 정책 선택 UI를 추가한다.
- 설명 문구:
  - `DENY`: 기본 권장
  - `SAMEORIGIN`: Cockpit/iframe 기반 앱
  - `OFF`: 특별한 경우만

**Step 3: edit/create 연결**

- 생성/수정 payload와 기본값 모두 `frame_policy`를 전달한다.

### Task 5: 글로벌 보안 헤더 조정과 최종 검증

**Files:**
- Modify: `traefik-config/dynamic/security-headers.yml`

**Step 1: 전역 frame 정책 제거**

- `security-headers` 미들웨어에서 `frameDeny: true`를 제거한다.
- 나머지 전역 보안 헤더는 유지한다.

**Step 2: 검증**

Run: `cd backend && pytest tests/infrastructure/test_config_generator.py tests/infrastructure/persistence/test_sqlite_service_repository.py -q`

Run: `cd frontend && npm run build`

Expected:
- backend tests green
- frontend build green
- 문서와 코드가 기본값 `deny`, 예외 `sameorigin` 구조로 일치
