# Traefik Manager 보안 점검 보고서

> 최초 점검일: 2026-03-08
> 업데이트: 2026-03-10

---

## 현재 보안 상태 요약

| 항목 | 상태 |
|------|------|
| 비밀번호 해싱 (bcrypt_sha256) | ✅ 양호 |
| JWT 인증 전체 엔드포인트 적용 | ✅ 양호 |
| RBAC (admin/read-only) | ✅ 양호 |
| CORS 특정 origin 제한 | ✅ 양호 |
| TrustedHostMiddleware | ✅ 양호 |
| 도메인 regex 검증 (path traversal 방지) | ✅ 양호 |
| subprocess shell=True 미사용 | ✅ 양호 |
| Docker 소켓 read-only 마운트 | ✅ 양호 |
| Production docs URL 비활성화 | ✅ 양호 |
| no-new-privileges:true | ✅ 양호 |
| **로그인 brute force 방어** | ✅ 적용 (Traefik login rate limit) |
| **JWT 토큰 무효화** | ✅ 적용 (token_version + jti revoke) |
| **백업 export 권한** | ✅ 적용 (admin 전용) |
| **Upstream 호스트 검증** | ✅ 강화됨 |
| **HTTP redirect 차단 (헬스체크)** | ✅ 적용 |
| **보안 응답 헤더** | ✅ 구조 개선 |

---

## 취약점 상세

### [HIGH-1] 로그인 brute force 방어 적용됨

**파일:** `backend/app/application/auth/auth_use_cases.py`, `backend/app/interfaces/api/v1/routers/auth.py`

**현재 상태:** `docker-compose.yml`에 `login-ratelimit` Traefik 미들웨어가 적용되어 `/api/v1/auth/login` 요청에 분당 제한이 걸립니다.

**남은 보완점:**
- 계정 잠금
- CAPTCHA
- 사용자명 기준 이상 징후 감지

즉 무방비 상태는 아니지만, 애플리케이션 레벨 방어는 더 넣을 수 있습니다.

---

### [HIGH-2] JWT 토큰 무효화는 적용됨

**파일:** `backend/app/core/security.py`, `backend/app/interfaces/api/dependencies.py`

**현재 상태:** 토큰에 `ver`와 `jti` 클레임을 함께 넣습니다.
- 로그아웃: 현재 토큰의 `jti`를 `revoked_tokens`에 저장해 개별 세션만 무효화
- 비밀번호 변경/전체 무효화: `token_version` 증가로 해당 사용자의 기존 토큰 전체 무효화

**남은 보완점:**
- 관리자용 세션 목록/강제 종료 UI 없음
- 만료된 revoked token 정리 배치 없음

즉 현재는 “현재 세션 로그아웃”과 “사용자 단위 전체 무효화”를 모두 지원합니다. 남은 건 운영 편의 기능입니다.

---

### [MEDIUM-1] 백업 export 권한 문제는 해결됨

**파일:** `backend/app/interfaces/api/v1/routers/backup.py`, line 35

**현재 상태:** `/export`는 `require_admin`으로 보호됩니다.

**영향:** 이전 지적은 현재 코드에는 해당하지 않습니다.

---

### [MEDIUM-2] Upstream 호스트 검증은 강화됨

**파일:** `backend/app/domain/proxy/value_objects/upstream.py`

**현재 상태:** 다음은 차단됩니다.
- loopback (`127.0.0.1`, `::1`)
- link-local (`169.254.0.0/16`)
- unspecified (`0.0.0.0`)
- unique local IPv6 (`fc00::/7`)
- multicast (`224.0.0.0/4`, `ff00::/8`)
- limited broadcast (`255.255.255.255`)
- reserved IPv4 (`240.0.0.0/4`)
- documentation/example 대역 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`)

**남은 보완점:**
- DNS 재해석 결과까지 검사하는 strict mode가 필요한지 검토
- 도메인/호스트 허용 정책을 더 엄격한 allowlist 기반으로 바꿀지 검토

---

### [MEDIUM-3] 헬스체크 redirect 차단은 해결됨

**파일:** `backend/app/infrastructure/health/upstream_checker.py`

**현재 상태:** `follow_redirects=False`가 적용되어 있습니다.

---

### [LOW-1] ALLOWED_HOSTS에 localhost 포함

**파일:** `.env`, line 43

**문제:**
```
ALLOWED_HOSTS=["traefik-manager.lizstudio.co.kr","traefik-manager-api.lizstudio.co.kr","localhost","127.0.0.1","backend","backend:8000"]
```

`localhost`, `127.0.0.1`은 내부 컨테이너 간 통신에서만 필요하면 별도 관리 권장.

**해결 방안:** 내부 통신이 필요 없으면 제거. 필요하다면 현 상태 유지 (위험도 낮음).

---

### [LOW-2] 애플리케이션 코드의 `datetime.utcnow()` 정리는 완료

**현재 상태:** application/domain/core 레이어의 직접적인 `datetime.utcnow()` 사용은 timezone-aware UTC로 정리되었습니다.

**남은 보완점:** 테스트 경고는 외부 의존성인 `python-jose` 내부 구현에서 발생합니다. 즉 현재 남은 경고는 애플리케이션 코드가 아니라 라이브러리 레벨 이슈입니다.

---

### [LOW-3] 보안 응답 헤더 구조 재설계 적용됨

**위치:** Traefik 엔트리포인트 전역 미들웨어, 서비스별 동적 라우터 미들웨어

**배경:** 2026-03-10 운영 진단에서 `cockpit.lizstudio.co.kr`가 공용 도메인 경유 시 깨졌고, 브라우저 콘솔에 `X-Frame-Options: DENY`로 인한 iframe 차단이 확인됐다. 원인은 엔트리포인트 전역 `security-headers@file`가 모든 서비스에 동일한 frame 정책을 강제한 구조였다.

**문제:**
- `X-Frame-Options: DENY`는 대부분 서비스에는 안전한 기본값이다.
- 하지만 Cockpit처럼 내부 iframe shell을 사용하는 앱은 `DENY`에서 정상 동작하지 않는다.
- 반대로 전역값을 `SAMEORIGIN`으로 낮추면 다른 서비스의 클릭재킹 방어 수준이 낮아진다.

**설계 원칙:**
- 전역 보안 헤더에는 서비스 공통값만 둔다.
- frame 정책은 서비스별로 분리한다.
- 서비스 기본값은 `deny`로 유지한다.
- iframe 기반 예외 서비스만 `sameorigin` 또는 `off`를 선택한다.

**전역 유지 대상:**
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Server`, `X-Powered-By` 제거

**서비스별 정책:**
- `deny`: `frameDeny: true`
- `sameorigin`: `customFrameOptionsValue: "SAMEORIGIN"`
- `off`: frame 관련 응답 헤더 미생성

**운영 규칙:**
- 엔트리포인트 전역 `security-headers@file`에서는 frame 정책을 넣지 않는다.
- 서비스 생성기가 각 라우터에 frame policy middleware를 생성한다.
- Cockpit, iframe 기반 백오피스, 임베드형 SPA shell은 `sameorigin` 후보로 검토한다.

**권장 사항:**
- 새 서비스 기본값은 계속 `deny`.
- 예외는 문서화된 근거 없이 `off`로 열지 않는다.

---

## 수정 우선순위

| 순위 | 항목 | 난이도 | 위험도 |
|------|------|--------|--------|
| 1 | 관리자용 세션 관리 UI 또는 revoke 정리 배치 추가 | 보통 | 중간 |
| 2 | Upstream strict mode (DNS 재해석/allowlist) 검토 | 보통 | 중간 |
| 3 | `python-jose` 내부 `utcnow` 경고 추적 또는 대체 검토 | 쉬움 | 낮음 |
