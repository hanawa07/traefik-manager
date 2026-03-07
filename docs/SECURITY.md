# Traefik Manager 보안 점검 보고서

> 점검일: 2026-03-08

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
| **로그인 brute force 방어** | ❌ 미구현 |
| **JWT 토큰 무효화** | ❌ 미구현 |
| **백업 export 권한** | ⚠️ 미흡 |
| **Upstream 호스트 검증** | ⚠️ 미흡 |
| **HTTP redirect 차단 (헬스체크)** | ⚠️ 미흡 |
| **보안 응답 헤더** | ⚠️ 미흡 |

---

## 취약점 상세

### [HIGH-1] 로그인 brute force 방어 없음

**파일:** `backend/app/application/auth/auth_use_cases.py`, `backend/app/interfaces/api/v1/routers/auth.py`

**문제:** `/api/v1/auth/login` 엔드포인트에 rate limiting, 계정 잠금, CAPTCHA 등 어떤 brute force 방어도 없음.

**영향:** 공격자가 무제한 password 시도 가능.

**해결 방안:**
- 옵션 A (권장): Traefik rate limit 미들웨어를 `/api/v1/auth/login`에 적용 (traefik config)
- 옵션 B: 연속 실패 횟수를 DB/메모리에 기록 후 일정 횟수 초과 시 임시 잠금 (30초~5분)

---

### [HIGH-2] JWT 토큰 무효화 메커니즘 없음

**파일:** `backend/app/core/security.py`, `backend/app/interfaces/api/dependencies.py`

**문제:** 비밀번호 변경, 사용자 비활성화, 로그아웃 후에도 기존 발급 JWT가 만료 시간(`JWT_EXPIRE_MINUTES=60`)까지 유효함. 토큰 블랙리스트 없음.

**영향:** 탈취된 토큰 또는 권한 변경 후 토큰이 계속 유효.

**해결 방안:**
- SQLite `revoked_tokens` 테이블 (jti claim 기록)
- 로그아웃/비밀번호 변경 시 해당 jti 블랙리스트 등록
- `decode_token()` 에서 블랙리스트 조회 추가
- `create_access_token()`에 `jti` (uuid) claim 추가

---

### [MEDIUM-1] 백업 export가 read-only 사용자에게 허용됨

**파일:** `backend/app/interfaces/api/v1/routers/backup.py`, line 35

**문제:**
```python
# 현재 (취약)
_: dict = Depends(get_current_user)

# 수정 필요
_: dict = Depends(require_admin)
```

**영향:** read-only 계정으로 서비스 도메인, upstream 주소, 미들웨어 설정 등 전체 인프라 정보 탈취 가능.

---

### [MEDIUM-2] Upstream 호스트 형식 검증 없음

**파일:** `backend/app/domain/proxy/value_objects/upstream.py`

**문제:** `Upstream` value object가 호스트가 비어있지 않은지와 포트 범위만 검증. `0.0.0.0`, `169.254.169.254`(AWS 메타데이터), `::1` 등 위험 주소 허용.

**현재 코드:**
```python
def __post_init__(self):
    if not self.host:
        raise ValueError("업스트림 호스트는 필수입니다")
    if not (1 <= self.port <= 65535):
        raise ValueError(f"유효하지 않은 포트: {self.port}")
```

**해결 방안:**
- 차단할 IP 대역 검증: `0.0.0.0`, `169.254.0.0/16`, `::1`, `fc00::/7`
- 또는 호스트가 IP일 경우 `ipaddress` 모듈로 private/loopback 검증
- 도메인 형식이면 DomainName과 유사한 regex 적용

---

### [MEDIUM-3] 헬스체크 HTTP redirect 자동 허용

**파일:** `backend/app/infrastructure/health/upstream_checker.py`

**문제:** `httpx.AsyncClient()` 기본값이 redirect를 자동으로 따라감. upstream이 내부 서비스로 redirect할 경우 SSRF 우려.

**현재 코드:**
```python
async with httpx.AsyncClient(timeout=timeout) as client:
    response = await client.get(url)
```

**수정:**
```python
async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
    response = await client.get(url)
```

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

### [LOW-2] `datetime.utcnow()` deprecated

**파일:** `backend/app/core/security.py`, line 21

**문제:**
```python
# 현재 (deprecated in Python 3.12)
payload["exp"] = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)

# 수정
from datetime import datetime, timedelta, timezone
payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
```

---

### [LOW-3] 보안 응답 헤더 없음

**위치:** Traefik 미들웨어 또는 FastAPI 미들웨어

**누락된 헤더:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=()`

**해결 방안:** Traefik `customResponseHeaders` 미들웨어로 전역 적용 권장.

---

## 수정 우선순위

| 순위 | 항목 | 난이도 | 위험도 |
|------|------|--------|--------|
| 1 | [MEDIUM-1] 백업 export admin 전용 | 매우 쉬움 (1줄) | 중간 |
| 2 | [MEDIUM-3] 헬스체크 redirect 차단 | 쉬움 (1줄) | 중간 |
| 3 | [LOW-2] datetime.utcnow() 수정 | 쉬움 (2줄) | 낮음 |
| 4 | [MEDIUM-2] Upstream 호스트 검증 | 보통 | 중간 |
| 5 | [HIGH-1] 로그인 rate limiting | 보통 (Traefik 설정) | 높음 |
| 6 | [HIGH-2] JWT 블랙리스트 | 어려움 | 높음 |
| 7 | [LOW-3] 보안 응답 헤더 | 쉬움 (Traefik 설정) | 낮음 |
