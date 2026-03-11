# Phase 5 Operational Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 서비스 상태 표시, 업스트림 정책, 로그인 방어를 운영 현실에 맞게 고도화해 Traefik Manager를 “보이기만 하는 대시보드”에서 “신뢰 가능한 운영 콘솔”로 끌어올린다.

**Architecture:** 기존 DDD 레이어를 유지하면서 `Service` aggregate에 헬스 체크 정책을 추가하고, 헬스 체크 인프라를 서비스 설정 기반으로 동작하게 바꾼다. 정책성 기능은 `system_settings`와 서비스별 필드를 분리해 전역 기본값과 서비스 예외를 함께 다룬다.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Next.js App Router, React Query, Traefik File Provider, SQLite

---

## Progress

- 완료: Task 1 문서 기준선 정리
- 완료: Task 2 서비스별 헬스 체크 정책 모델 추가
- 완료: Task 3 헬스 체크 엔진 고도화 2차
  `scheme/path/timeout/expected status`, `disabled -> unknown`, `checked_at`, `checked_url`, `error_kind`, 백업 경로 반영 포함
- 완료: Task 4 프런트엔드 서비스 설정/표시 개선 3차
  서비스 폼, 서비스 카드, 편집 페이지 기본값, 확인 시각/체크 URL 표시, 최근 성공/실패 시각, 실패 유형 필터 포함
- 완료: Task 5 업스트림 allowlist / 정책 기반 제한
  `DNS strict mode`와 별개로 외부 FQDN suffix, Docker 서비스명, 사설 IPv4/Tailscale IP 허용 정책 추가
- 완료: Task 5-2 upstream 정책 preset/조직 템플릿
  설정 화면에서 `정책 비활성화`, `내부 우선`, `외부 승인 도메인 전용` preset을 빠르게 적용하고 현재 조합을 `사용자 정의`로 구분
- 완료: Task 6 앱 레벨 로그인 방어 강화
  사용자 실패 횟수/시간 창 기반 계정 잠금, 성공 시 초기화, 감사 로그 이벤트 기록, 동일 IP 반복 실패 이상 징후 탐지 및 임시 IP 차단 추가
- 완료: Task 6-2 로그인 차단 예외 정책
  자동 차단 on/off, 신뢰 네트워크 CIDR/IP 예외, 설정 UI/운영 문서 반영
- 완료: Task 6-3 보안 이벤트 외부 웹훅 알림
  `login_locked`, `login_suspicious`, `login_blocked_ip`를 외부 webhook으로 전송, 설정 UI 및 운영 문서 반영
- 완료: 문서 마감/운영 가이드 정리

---

## Scope

- 서비스별 헬스 체크 정책 추가
- 업스트림 상태 판정 고도화
- 업스트림 allowlist / 정책 기반 제한
- 앱 레벨 로그인 방어 강화
- 문서 최신화

비범위:

- Redis 도입
- 외부 알림 시스템 연동
- 멀티 노드 세션 저장소

---

### Task 1: 문서 기준선 정리

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Create: `docs/plans/2026-03-11-phase-5-operational-reliability.md`

**Step 1: 현재 상태 반영**

- 세션 쿠키 인증, frame policy, DNS strict mode, 세션 관리, 헬스 체크 표시 개선을 문서 기준선에 반영한다.

**Step 2: Phase 5 범위 확정**

- 헬스 체크, 업스트림 정책, 로그인 방어를 하나의 운영 신뢰성 단계로 정의한다.

**Step 3: 문서 검토**

Run: `rg -n "JWT 로그인 API|upstream strict mode|세션 쿠키" docs`

Expected: 남은 오래된 표현을 쉽게 찾을 수 있어야 한다.

---

### Task 2: 서비스별 헬스 체크 정책 모델 추가

**Files:**
- Modify: `backend/app/domain/proxy/entities/service.py`
- Modify: `backend/app/infrastructure/persistence/models.py`
- Modify: `backend/app/infrastructure/persistence/repositories/sqlite_service_repository.py`
- Modify: `backend/app/interfaces/api/v1/schemas/service_schemas.py`
- Create: `backend/alembic/versions/20260311_08_add_service_healthcheck_policy.py`
- Test: `backend/tests/domain/test_service_entity.py`
- Test: `backend/tests/infrastructure/persistence/test_sqlite_service_repository.py`

**Step 1: failing test 작성**

- `Service.create()`가 `healthcheck_enabled`, `healthcheck_path`, `healthcheck_timeout_ms`, `healthcheck_expected_statuses`를 보존하는 테스트 추가
- 잘못된 path/timeout/status 입력을 거부하는 테스트 추가

**Step 2: RED 확인**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests/domain/test_service_entity.py -q`

Expected: 새 필드가 없어서 실패

**Step 3: 최소 구현**

- `Service`에 헬스 체크 정책 필드와 정규화 로직 추가
- ORM 모델/리포지토리 매핑 추가
- Alembic migration 작성

**Step 4: GREEN 확인**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests/domain/test_service_entity.py tests/infrastructure/persistence/test_sqlite_service_repository.py -q`

Expected: PASS

Status: 완료 (2026-03-11)

---

### Task 3: 헬스 체크 엔진 고도화

**Files:**
- Modify: `backend/app/infrastructure/health/upstream_checker.py`
- Modify: `backend/app/interfaces/api/v1/routers/services.py`
- Modify: `backend/app/interfaces/api/v1/schemas/service_schemas.py`
- Test: `backend/tests/infrastructure/test_upstream_checker.py`
- Test: `backend/tests/interfaces/api/test_services_router.py`

**Step 1: failing test 작성**

- path, timeout, expected status를 반영하는 테스트 추가
- DNS 실패 / connection refused / timeout / bad status를 구분하는 테스트 추가

**Step 2: RED 확인**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests/infrastructure/test_upstream_checker.py tests/interfaces/api/test_services_router.py -q`

Expected: 새 인자/응답 구조가 없어 실패

**Step 3: 최소 구현**

- `check_upstream()`가 `scheme`, `path`, `timeout`, `expected_statuses`, `skip_tls_verify`를 받게 변경
- 응답에 `error_kind`, `checked_url`, `checked_at` 추가
- 서비스 라우터가 각 서비스 정책을 헬스 체크 호출에 전달

**Step 4: GREEN 확인**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests/infrastructure/test_upstream_checker.py tests/interfaces/api/test_services_router.py -q`

Expected: PASS

Status: 2차 완료 (2026-03-11)
비고: 최근 성공/실패 시각과 실패 유형 필터는 다음 반복으로 이월

---

### Task 4: 프런트엔드 서비스 설정/표시 개선

**Files:**
- Modify: `frontend/src/features/services/api/serviceApi.ts`
- Modify: `frontend/src/features/services/components/ServiceForm.tsx`
- Modify: `frontend/src/features/services/components/ServiceCard.tsx`
- Modify: `frontend/src/app/dashboard/services/page.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`

**Step 1: 서비스 폼에 헬스 체크 정책 추가**

- enabled
- path
- timeout
- expected status list

**Step 2: 상태 표시 고도화**

- `DOWN`일 때 원인, 확인 URL, 최근 확인 시각 표시
- 목록 정렬/필터에 `DNS 실패`, `타임아웃`, `연결 거부` 같은 실패 유형 반영 검토

**Step 3: 프런트 검증**

Run: `cd frontend && npm run lint`

Expected: PASS

**Step 4: 빌드 검증**

Run: `cd frontend && npm run build`

Expected: PASS

Status: 3차 완료 (2026-03-11)
비고: 문서 마감과 운영 가이드 정리가 다음 반복 대상

---

### Task 5: 업스트림 allowlist / 정책 기반 제한

**Files:**
- Modify: `backend/app/infrastructure/network/upstream_dns_guard.py`
- Modify: `backend/app/interfaces/api/v1/routers/settings.py`
- Modify: `backend/app/interfaces/api/v1/schemas/settings_schemas.py`
- Modify: `frontend/src/features/settings/api/settingsApi.ts`
- Modify: `frontend/src/features/settings/hooks/useSettings.ts`
- Modify: `frontend/src/app/dashboard/settings/page.tsx`
- Test: `backend/tests/infrastructure/test_upstream_dns_guard.py`
- Test: `backend/tests/interfaces/api/test_settings_router.py`

**Step 1: 정책 정의**

- 예: 허용 도메인 suffix 목록, Docker 서비스명 허용 여부, RFC1918 허용 여부

**Step 2: failing test 작성**

- 허용된 suffix는 통과
- 비허용 외부 도메인은 차단
- strict mode와 allowlist가 함께 켜졌을 때 기대 동작 명시

**Step 3: 최소 구현**

- `system_settings`에 정책 저장
- DNS guard가 allowlist를 함께 평가
- 설정 화면에 편집 UI 추가

**Step 4: 검증**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests/infrastructure/test_upstream_dns_guard.py tests/interfaces/api/test_settings_router.py -q`

Expected: PASS

Status: 완료 (2026-03-11)

---

### Task 6: 앱 레벨 로그인 방어 강화

**Files:**
- Modify: `backend/app/application/auth/auth_use_cases.py`
- Modify: `backend/app/interfaces/api/v1/routers/auth.py`
- Modify: `backend/app/infrastructure/persistence/models.py`
- Create: `backend/alembic/versions/20260311_09_add_login_attempt_tracking.py`
- Test: `backend/tests/interfaces/api/test_auth_router.py`
- Test: `backend/tests/core/test_session_security.py`

**Step 1: 정책 선택**

- 계정 잠금 기준
- 잠금 해제 시간
- 사용자명/아이피 기준 감사 로그 남기기

**Step 2: failing test 작성**

- 반복 실패 후 로그인 차단
- 잠금 시간 경과 후 정상 로그인 허용
- 성공 시 실패 카운터 리셋

**Step 3: 최소 구현**

- 사용자 또는 별도 테이블에 로그인 실패 상태 저장
- 로그인 API에서 차단 정책 적용
- 감사 로그에 차단 이벤트 기록

**Step 4: 검증**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests/interfaces/api/test_auth_router.py tests/core/test_session_security.py -q`

Expected: PASS

Status: 완료 (2026-03-11)

---

### Task 7: 통합 검증 및 배포 체크

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

**Step 1: 백엔드 전체 테스트**

Run: `cd backend && env PYTHONPATH=. venv/bin/pytest tests -q`

Expected: PASS

**Step 2: 프런트 전체 검증**

Run: `cd frontend && npm run lint && npm run build`

Expected: PASS

**Step 3: 운영 반영**

Run: `docker compose build backend frontend`

Run: `docker compose up -d backend frontend`

**Step 4: 수동 확인**

- 서비스 목록에서 DOWN 원인 표시 확인
- 헬스 체크 정책이 서비스별로 반영되는지 확인
- strict mode / allowlist 저장 확인
- 로그인 차단 정책 동작 확인

---

## Recommended Execution Order

1. Task 2
2. Task 3
3. Task 4
4. Task 5
5. Task 6
6. Task 7

Task 1은 이미 이번 세션에서 착수했으므로 문서 기준선으로 유지한다.
