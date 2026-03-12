# Browser Auth Redesign: Server Session Cookie

> **결론:** 이 레포의 브라우저 관리자 인증은 `JWT access/refresh` 확장보다 `서버 세션 쿠키`가 더 안전하고 더 단순하다.

**Goal:** 현재 `localStorage + Bearer JWT` 기반 관리자 인증을 제거하고, 브라우저에는 `HttpOnly` 세션 쿠키만 남기는 구조로 재설계한다. 서비스 전용 API key 인증은 유지한다.

**Architecture:** 로그인 성공 시 서버가 세션 저장소(`auth_sessions`)에 상태를 기록하고, 브라우저에는 `HttpOnly + Secure + SameSite` 쿠키를 내려준다. 관리자 UI API 요청과 Traefik `forwardAuth` 검증은 둘 다 이 세션 쿠키를 사용한다. JWT access token/refresh token은 브라우저 인증 경로에서 제거한다.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, Alembic, Next.js, React Query, Zustand, Traefik ForwardAuth

---

## 1. 현재 구조와 문제

현재 브라우저 인증은 다음 구조다.

- 로그인 시 JWT 발급: [auth.py](/home/lizstudio/docker/traefik-manager/backend/app/interfaces/api/v1/routers/auth.py)
- 프런트가 토큰을 `localStorage`에 저장: [useAuthStore.ts](/home/lizstudio/docker/traefik-manager/frontend/src/features/auth/store/useAuthStore.ts)
- 모든 API 요청에 `Authorization: Bearer ...` 부착: [apiClient.ts](/home/lizstudio/docker/traefik-manager/frontend/src/shared/lib/apiClient.ts)
- 로그아웃 시 `jti`를 `revoked_tokens`에 저장: [sqlite_revoked_token_repository.py](/home/lizstudio/docker/traefik-manager/backend/app/infrastructure/persistence/repositories/sqlite_revoked_token_repository.py)

이 구조의 핵심 약점은 **브라우저 JS가 인증 토큰에 직접 접근한다**는 점이다.

즉 XSS가 발생하면:

- access token 탈취 가능
- 세션 재사용 가능
- 관리 콘솔 성격의 앱에서는 피해가 큼

이 문제를 해결하기 위해 `refresh token rotation`도 가능하지만, 이 레포에서는 그것보다 **서버 세션 쿠키**가 더 적합하다.

---

## 2. 왜 서버 세션 쿠키가 최선인가

### 2.1 이 레포의 성격

이 프로젝트는 일반 public SPA보다 **관리자 콘솔**에 가깝다.

- 브라우저 기반 대시보드가 핵심
- API 소비자보다 관리자 웹 사용이 중심
- 서비스용 machine-to-machine 인증은 이미 별도 API key 경로가 존재

즉 브라우저 쪽 인증은 “토큰 플랫폼”보다 “관리자 세션”에 더 가깝다.

### 2.2 서버 세션 쿠키의 장점

- 브라우저 JS가 장기 인증정보를 읽지 못함
- 로그아웃/세션 종료/강제 종료가 단순함
- 세션 목록 UI 구현이 자연스러움
- refresh token rotation, reuse detection, memory token 재발급 로직이 필요 없음
- 관리자 보안 운영에 필요한 가시성을 서버가 직접 가짐

### 2.3 refresh token rotation 대비 판단

refresh rotation은 좋은 구조지만, 이 레포에서는 다음이 같이 필요하다.

- refresh token 쿠키
- 짧은 access token
- access token 메모리 저장
- refresh endpoint
- rotation
- reuse detection
- 세션 저장소
- 401 시 silent refresh / 재시도 로직

즉 “브라우저 토큰 유지”를 위해 인증 복잡도를 크게 올린다.  
반면 서버 세션 쿠키는 **보안 목표를 더 직접적으로 달성**한다.

---

## 3. 최종 권장 구조

### 3.1 브라우저 관리자 인증

- `HttpOnly + Secure + SameSite` 세션 쿠키
- 서버 상태 저장형 세션 (`auth_sessions`)
- 브라우저는 bearer token을 알 필요 없음

### 3.2 서비스 API key 인증

현행 유지:

- `auth_mode = token`
- `Authorization` 헤더 기반 서비스 전용 API key

즉 변경 범위는 **관리자 UI 인증**이고, 서비스용 토큰 인증은 그대로 둔다.

---

## 4. 데이터 모델

새 테이블 `auth_sessions`를 도입한다.

권장 컬럼:

- `id: str` PK
- `user_id: str`
- `username: str`
- `role: str`
- `session_secret_hash: str`
- `issued_at: datetime`
- `last_seen_at: datetime | null`
- `expires_at: datetime`
- `idle_expires_at: datetime`
- `revoked_at: datetime | null`
- `revoked_reason: str | null`
- `ip_address: str | null`
- `user_agent: str | null`

핵심 포인트:

- 브라우저 쿠키에는 **평문 세션 ID + secret 조합** 또는 불투명 세션 토큰을 둔다.
- DB에는 **해시된 값**만 저장한다.
- DB 유출 시에도 세션 재사용을 어렵게 해야 한다.

권장 방식:

- 쿠키 값: `session_id.secret`
- DB 저장: `session_id`, `secret_hash`

세션 조회 시:

1. 쿠키 파싱
2. `session_id`로 row 조회
3. `secret`를 hash 검증

이 방식은 단순하면서도 DB 유출 상황에 대비할 수 있습니다.

---

## 5. 쿠키 정책

브라우저 관리자 세션 쿠키는 최소 아래 조건이 필요하다.

- `HttpOnly`
- `Secure`
- `SameSite=Lax` 또는 `SameSite=Strict`
- `Path=/`

권장 기본:

- `SameSite=Lax`

이유:

- 일반 브라우저 탐색과 같은 사이트 내 요청은 정상 동작
- 대부분의 CSRF 시나리오를 1차 차단
- 너무 공격적인 `Strict`보다 운영 호환성이 낫다

추가로 쿠키 이름은 명시적으로 둔다.

예:

- `tm_session`

---

## 6. CSRF 방어

서버 세션 쿠키를 쓰면 **CSRF 방어는 필수**다.

### 필수 1차 방어

- `SameSite=Lax`
- `Origin` / `Referer` 검증

### 권장 2차 방어

- 상태 변경 요청(`POST`, `PUT`, `PATCH`, `DELETE`)에 CSRF 토큰 도입

권장 구현:

- 로그인 시 non-HttpOnly `tm_csrf` 쿠키 발급
- 프런트는 `X-CSRF-Token` 헤더에 같은 값 전송
- 서버는 쿠키 값과 헤더 값을 비교

즉:

- 세션 쿠키는 `HttpOnly`
- CSRF 토큰은 JS가 읽을 수 있는 별도 쿠키

이게 가장 실용적이다.

---

## 7. 인증 흐름

### 7.1 로그인

1. 사용자 인증 성공
2. 새 `auth_sessions` row 생성
3. `tm_session` 쿠키 설정
4. `tm_csrf` 쿠키 설정
5. 응답 본문에는 최소 정보만 반환
   - `username`
   - `role`

브라우저에는 access token을 주지 않는다.

### 7.2 API 요청

- 브라우저는 세션 쿠키를 자동 전송
- 프런트는 더 이상 `Authorization` 헤더를 붙이지 않음
- 상태 변경 요청은 `X-CSRF-Token` 헤더 추가

### 7.3 로그아웃

1. 현재 세션 row에 `revoked_at` 기록
2. 쿠키 삭제

### 7.4 세션 강제 종료

- 특정 세션 row revoke
- 이후 그 세션 쿠키로 요청하면 401

---

## 8. Traefik ForwardAuth 영향

이 부분이 중요하다.

현재 [auth.py](/home/lizstudio/docker/traefik-manager/backend/app/interfaces/api/v1/routers/auth.py)의 `/auth/verify`는 `Authorization: Bearer`만 본다.  
서버 세션 쿠키로 가면 이 경로도 같이 바뀌어야 한다.

새 권장 동작:

1. 서비스 전용 API key는 현재처럼 `Authorization`으로 먼저 검사
2. 없으면 브라우저 요청의 세션 쿠키 검사
3. 세션이 유효하면 `X-Auth-User`, `X-Auth-Role` 반환
4. 아니면 401

즉 `forwardAuth`는 계속 유지하되, 브라우저 인증 수단을 **JWT -> 세션 쿠키**로 교체한다.

---

## 9. 프런트 변경

현재 프런트는 다음 구조를 버려야 한다.

- `localStorage`의 `access_token`
- 요청 인터셉터의 `Authorization` 자동 부착

바뀌는 구조:

- Axios `withCredentials: true`
- 401 응답 시 로컬 토큰 삭제 대신 세션 만료 처리
- Zustand에는 `token`이 아니라 `username`, `role`, `isAuthenticated`만 남김
- 초기 앱 로드 시 `/auth/me` 같은 세션 확인 API 호출

필요한 새 API:

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/sessions/me`

---

## 10. 세션 관리 UI

위치 권장:

- 설정 페이지 안 `세션 관리` 섹션

일반 사용자:

- 현재 세션
- 다른 활성 세션
- 발급 시각
- 마지막 활동 시각
- 만료 시각
- IP / 브라우저 요약
- 다른 세션 종료
- 다른 모든 세션 종료

관리자:

- 사용자 필터
- active / revoked 필터
- 특정 세션 강제 종료

---

## 11. 세션 만료 정책

권장 정책은 두 개를 같이 둔다.

- **Idle timeout**
  예: 8시간
- **Absolute timeout**
  예: 7일

이유:

- 오래 방치된 브라우저를 자동 종료
- 너무 장기 세션도 제한

즉 세션 유효 조건:

- `revoked_at is null`
- `now < expires_at`
- `now < idle_expires_at`

활동이 있으면 `idle_expires_at`만 갱신한다.

---

## 12. Cleanup 정책

정리 대상:

- 만료된 세션
- 오래된 revoked 세션
- 기존 `revoked_tokens` 테이블

권장 방식:

- startup 시 1회 cleanup
- backend 내부 주기 loop (예: 6시간)

초기 전환 후에는 `revoked_tokens` 사용 비중이 줄어들므로, 장기적으로는 축소 가능하다.

---

## 13. 기존 JWT 구조와의 전환 전략

### 권장 전략

점진 전환이 아니라 **브라우저 인증은 명시적으로 교체**한다.

즉:

- 새 배포 이후 브라우저 로그인은 세션 쿠키 방식
- 기존 `localStorage` 토큰은 더 이상 정상 경로로 쓰지 않음
- 프런트는 첫 로드 때 구형 `access_token`이 있으면 제거하고 재로그인 유도

이유:

- 브라우저 경로에서 JWT와 세션 쿠키를 오래 공존시키면 코드가 복잡해진다
- 관리 콘솔 성격상 한 번의 재로그인은 감수 가능하다

### 유지할 것

- 서비스 API key 인증
- 필요 시 내부/비브라우저 용 bearer 경로는 별도 설계 가능

---

## 14. 리스크와 대응

### 리스크 1: CSRF

대응:

- `SameSite=Lax`
- `Origin` 검증
- CSRF 토큰

### 리스크 2: DB 유출 시 세션 재사용

대응:

- 세션 secret 해시 저장
- 평문 토큰 미저장

### 리스크 3: 다중 인스턴스 확장

대응:

- 현재는 SQLite 단일 인스턴스 기준으로 시작
- 향후 Redis/Postgres session store로 이관 가능하게 repository 분리

### 리스크 4: ForwardAuth 쿠키 전달 이슈

대응:

- Traefik forwardAuth가 쿠키를 전달하는지 검증 테스트 추가
- `/auth/verify`를 cookie-first + api-key fallback으로 구현

---

## 15. 구현 순서 권장

### Phase 1: 백엔드 세션 기반 인증

- `auth_sessions` 모델/엔티티/repository
- 로그인 시 세션 생성
- `/auth/me`
- 쿠키 발급/삭제
- 인증 dependency를 세션 기반으로 교체

### Phase 2: CSRF와 세션 정책

- `tm_csrf` 쿠키
- `X-CSRF-Token` 검증
- idle/absolute timeout

### Phase 3: ForwardAuth 전환

- `/auth/verify`에서 세션 쿠키 검사
- 서비스 API key fallback 유지

### Phase 4: 프런트 전환

- `localStorage` 제거
- `Authorization` 헤더 제거
- 세션 상태 조회 기반 초기화

### Phase 5: 세션 관리 UI

- 자기 세션 목록
- 다른 세션 종료
- 관리자 세션 조회/강제 종료

### Phase 6: Cleanup

- startup cleanup
- periodic cleanup

---

## 16. 최종 결론

이 레포의 브라우저 관리자 인증에 대한 최적해는:

1. **JWT refresh rotation이 아니라 서버 세션 쿠키**
2. **세션 저장소(`auth_sessions`) 도입**
3. **`HttpOnly + Secure + SameSite` 쿠키**
4. **CSRF 방어 포함**
5. **Traefik forwardAuth도 세션 쿠키 기반으로 전환**
6. **서비스 API key 인증은 그대로 유지**

즉 브라우저 관리자 인증은 “토큰 플랫폼”이 아니라 **상태 저장형 관리자 세션**으로 전환하는 편이 적절합니다.
