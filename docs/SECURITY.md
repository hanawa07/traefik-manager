# Traefik Manager 보안 점검 보고서

> 최초 점검일: 2026-03-08
> 업데이트: 2026-03-11

---

## 현재 보안 상태 요약

| 항목 | 상태 |
|------|------|
| 비밀번호 해싱 (bcrypt_sha256) | ✅ 양호 |
| 브라우저 관리자 세션 쿠키 인증 | ✅ 적용 |
| RBAC (admin/read-only) | ✅ 양호 |
| CORS 특정 origin 제한 | ✅ 양호 |
| TrustedHostMiddleware | ✅ 양호 |
| 도메인 regex 검증 (path traversal 방지) | ✅ 양호 |
| subprocess shell=True 미사용 | ✅ 양호 |
| Docker 소켓 read-only 마운트 | ✅ 양호 |
| Production docs URL 비활성화 | ✅ 양호 |
| no-new-privileges:true | ✅ 양호 |
| **로그인 brute force 방어** | ✅ 적용 (Traefik rate limit + 앱 레벨 계정 잠금 + 이상 징후 IP 차단) |
| **추가 로그인 검증 (Turnstile)** | ✅ 적용 (선택형) |
| **브라우저 세션 관리** | ✅ 적용 (`auth_sessions` + cookie revoke) |
| **백업 export 권한** | ✅ 적용 (admin 전용) |
| **Upstream 호스트 검증** | ✅ 강화됨 |
| **HTTP redirect 차단 (헬스체크)** | ✅ 적용 |
| **보안 응답 헤더** | ✅ 구조 개선 |

---

## 취약점 상세

### [HIGH-1] 로그인 brute force 방어 적용됨

**파일:** `backend/app/application/auth/auth_use_cases.py`, `backend/app/interfaces/api/v1/routers/auth.py`

**현재 상태:** 두 겹으로 적용됩니다.
- `docker-compose.yml`의 `login-ratelimit` Traefik 미들웨어
- 애플리케이션 레벨 로그인 실패 누적/잠금

**애플리케이션 레벨 동작:**
- 동일 사용자 기준으로 실패 횟수를 누적합니다.
- 실패가 일정 시간 창(`LOGIN_FAILURE_WINDOW_MINUTES`) 안에서 기준(`LOGIN_MAX_FAILED_ATTEMPTS`)을 넘으면 계정을 잠급니다.
- 잠금 시간은 `LOGIN_LOCKOUT_MINUTES`입니다.
- 성공 로그인 시 실패 카운터와 잠금 상태는 초기화됩니다.
- 실패/잠금 이벤트는 감사 로그에 `user/update`로 남고, `detail.event`에 `login_failure` 또는 `login_locked`가 기록됩니다.
- 동일 IP가 같은 시간 창 안에서 여러 사용자명에 대해 반복 실패하면 `login_suspicious` 감사 이벤트를 추가로 기록합니다.
- 최근 `login_suspicious`가 찍힌 IP는 `LOGIN_SUSPICIOUS_BLOCK_MINUTES` 동안 로그인 자체를 차단하고 `login_blocked_ip` 감사 이벤트를 남깁니다.
- 이상 징후 기준은 `LOGIN_SUSPICIOUS_WINDOW_MINUTES`, `LOGIN_SUSPICIOUS_FAILURE_COUNT`, `LOGIN_SUSPICIOUS_USERNAME_COUNT`, `LOGIN_SUSPICIOUS_BLOCK_MINUTES`로 조정합니다.
- 반복 차단 상승을 켜면 동일 IP가 다시 차단될 때 `block_minutes`, `blocked_until`, `repeat_count`를 함께 기록하고 차단 시간을 단계적으로 늘립니다.
- 설정 화면에서 `login_suspicious` 기반 자동 차단을 켜고 끌 수 있습니다.
- 설정 화면의 `신뢰 네트워크 예외(CIDR/IP)`에 포함된 클라이언트 IP는 이상 징후 기록과 IP 자동 차단에서 제외됩니다.
- 신뢰 네트워크 예외는 운영 노이즈를 줄이기 위한 것이며, 사용자별 실패 누적/계정 잠금에는 영향을 주지 않습니다.
- 설정 화면에서 `Cloudflare Turnstile` 로그인 보호를 `off / always / risk_based` 모드로 전환할 수 있습니다.
- `always`는 로그인마다 즉시 위젯을 표시하고, `risk_based`는 최근 실패가 누적된 IP에만 추가 검증을 요구합니다.
- Turnstile이 필요한 시점에는 로그인 페이지가 공개 site key로 위젯을 표시하고, 백엔드는 secret key로 토큰을 검증합니다.
- Turnstile 검증이 필요한데 없거나 실패하면 로그인은 진행되지 않습니다.
- 대시보드에는 최근 보안 경고 요약(잠금/이상 징후/IP 차단)이 표시되고, 감사 로그 화면에는 보안 이벤트 전용 필터가 제공됩니다.
- 시간 표시, 업스트림 보안, 로그인 방어, 보안 알림, Cloudflare 같은 주요 설정 저장도 감사 로그에 `settings/update`로 기록됩니다.
- 감사 로그 화면에서는 `설정 변경`과 `설정 테스트`를 분리해 확인할 수 있습니다.
- `시간 표시`, `업스트림 보안`은 audit detail에 `before/after` diff와 안전 롤백 payload를 남기며, 감사 로그 화면에서 이전 상태로 되돌릴 수 있습니다.
- `서비스 수정`, `리다이렉트 수정`, `미들웨어 수정`도 audit detail에 `before/after` diff를 남기고, token/basic-auth 같은 비밀값이 얽히지 않은 안전한 경우에만 롤백 payload를 제공합니다.
- `사용자 수정`도 audit detail에 `before/after` diff를 남기며, 비밀번호 변경이 포함되지 않은 경우에만 안전 롤백 payload를 제공합니다.
- 설정 화면에서 보안 알림 기본 채널을 `generic/slack/discord/telegram/teams/pagerduty/email` preset으로 선택할 수 있습니다.
- `login_locked`, `login_suspicious`, `login_blocked_ip` 이벤트는 기본 채널을 따르거나 `telegram/pagerduty/email/disabled`로 개별 override할 수 있습니다.
- Telegram은 bot token과 chat id를 사용하고, PagerDuty는 routing key를 사용하며, Generic/Slack/Discord/Teams는 webhook URL을 사용합니다. Email은 SMTP host/port/security/from/recipients를 사용합니다.
- 웹훅 전송 실패는 서버 로그에만 남고, 로그인 차단/잠금 동작 자체는 중단하지 않습니다.

**추가 보완됨:**
- `passlib` 의존을 제거하고 `bcrypt` 기반 자체 호환 구현으로 Python 3.13 전 `crypt` 경고를 정리했습니다.

---

### [HIGH-2] 브라우저 관리자 인증은 세션 쿠키 기반으로 전환됨

**파일:** `backend/app/interfaces/api/v1/routers/auth.py`, `backend/app/interfaces/api/dependencies.py`, `frontend/src/shared/lib/apiClient.ts`

**현재 상태:** 브라우저 관리자 인증은 `HttpOnly + Secure + SameSite` 세션 쿠키 기반입니다.
- 로그인: `auth_sessions`에 서버 상태 저장
- 브라우저: bearer token 대신 세션 쿠키 사용
- 로그아웃: 현재 세션 revoke + 쿠키 삭제
- `forwardAuth`: 서비스 API key 우선, 없으면 브라우저 세션 쿠키 검사

**보완된 점:**
- `localStorage` access token 제거
- 브라우저 JS에서 장기 인증정보 직접 접근 제거
- 상태 변경 요청에 CSRF 헤더 검증 추가
- 설정 화면에서 세션 목록, 개별 세션 종료, 전체 로그아웃 지원

**추가 적용됨:**
- startup 시 `auth_sessions`/`revoked_tokens` 1회 cleanup
- 백그라운드 periodic cleanup loop

즉 현재는 브라우저 관리자 로그인 보안, 세션 운영 기능, cleanup 자동화가 모두 적용됐고, 남은 것은 정책 강화 수준의 후속 과제입니다.

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

**추가 적용됨:**
- 설정의 `upstream_dns_strict_mode`를 켜면 도메인 업스트림 저장 시 DNS를 다시 조회합니다.
- 해석 결과가 loopback, link-local, unspecified, multicast, reserved, documentation/example, unique local IPv6 대역이면 저장을 거부합니다.
- DNS 조회 실패도 strict mode에서는 저장 거부로 처리합니다.
- IP 리터럴 upstream은 기존 값 검증만 수행하며 추가 DNS 조회를 하지 않습니다.
- 설정의 `upstream_allowlist_enabled`를 켜면 저장 시점에 업스트림 호스트 정책을 함께 검사합니다.
- 외부 FQDN은 허용된 domain suffix 목록과 일치해야 하고, Docker 서비스명과 사설 IPv4/Tailscale IP는 별도 옵션으로 허용 여부를 제어합니다.
- strict mode와 allowlist를 같이 켜면 둘 다 통과해야 저장됩니다.

**추가 적용됨:**
- 설정 화면에서 upstream 보안 preset(`정책 비활성화`, `내부 우선`, `외부 승인 도메인 전용`)을 빠르게 적용할 수 있습니다.
- preset은 권장 조합 템플릿이고, 세부 옵션을 직접 바꾸면 자동으로 `사용자 정의` 상태로 표시됩니다.

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

### [LOW-2] 애플리케이션 코드와 JWT 경로의 `datetime.utcnow()` 경고 정리는 완료

**현재 상태:** application/domain/core 레이어의 직접적인 `datetime.utcnow()` 사용은 timezone-aware UTC로 정리되었고, JWT 유틸도 `python-jose`에서 `PyJWT`로 전환해 남아 있던 라이브러리 레벨 경고를 제거했습니다.

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
| 1 | 관리자 알림/차단 정책 예외 고도화 | 보통 | 낮음 |
| 2 | CAPTCHA 또는 추가 로그인 검증 장치 검토 | 보통 | 낮음 |
| 3 | 로그인 보안 채널(Teams/Email/PagerDuty) 확장 | 쉬움 | 낮음 |
