# Traefik Manager 로드맵

Traefik + Authentik 통합 관리 도구.
NPM(Nginx Proxy Manager)을 대체하고, Authentik 인증을 UI에서 한 번에 관리하는 것이 목표.

---

## 현재 상태 (완료)

- [x] DDD 기반 백엔드 구조 (domain/application/infrastructure/interfaces)
- [x] Service 엔티티, Value Objects, 도메인 이벤트
- [x] JWT 로그인 API
- [x] 서비스 CRUD API
- [x] Traefik File Provider YAML 자동 생성
- [x] Authentik Provider/Application 자동 연동 (인증 토글 시)
- [x] SQLite 저장소
- [x] Docker 보안 설정 (비루트 컨테이너, no-new-privileges)
- [x] Next.js 프론트엔드 기본 구조 + API 클라이언트

---

## Phase 1 — 프론트엔드 MVP ✅

> 목표: 백엔드 API를 쓸 수 있는 기본 UI 완성

- [x] 로그인 페이지
- [x] 대시보드 (서비스 현황 카드, 총 서비스 수, 인증 활성 수, 인증서 만료 임박)
- [x] 서비스 목록 (도메인, 업스트림, TLS 상태, 인증 상태)
- [x] 서비스 추가 폼 (도메인, 업스트림 호스트/포트, TLS, 인증 토글)
- [x] 서비스 수정
- [x] 서비스 삭제 (확인 모달)
- [x] 인증 토글 → Authentik Provider/Application 자동 생성/삭제

---

## Phase 2 — 인증서 & 접근 제어 ✅

> 목표: NPM의 인증서 관리 + IP 접근 제어 대체

- [x] 인증서 목록 (Traefik API 연동, 도메인별 만료일/남은일수/상태 표시)
- [x] 인증서 만료 임박 경고 (30일 이내), 만료 오류 표시
- [x] HTTP → HTTPS 자동 리다이렉트 미들웨어 (redirectScheme)
- [x] IP 허용 목록 미들웨어 (ipAllowList, CIDR 지원)
- [x] Authentik 접근 그룹 설정 (서비스별 그룹 지정, 정책 자동 생성/바인딩)

---

## Phase 3 — 고급 프록시 기능 ✅

> 목표: Mantrae 수준의 미들웨어 관리

- [x] 리다이렉트 호스트 (도메인 A → 도메인 B, 영구/임시 선택)
- [x] Rate Limiting 미들웨어 (서비스별 초당 요청 수 제한)
- [x] 커스텀 응답 헤더 미들웨어 (key/value 동적 입력)
- [ ] 미들웨어 재사용 (여러 서비스에 동일 미들웨어 적용)
- [ ] Basic Auth 미들웨어 (Authentik 없이 간단한 보호가 필요한 경우)

---

## Phase 4 — 운영/자동화

> 목표: 유지보수 자동화

- [ ] Docker 컨테이너 자동 감지 (라벨 읽기)
- [ ] Cloudflare DNS 연동 (서비스 추가 시 DNS 레코드 자동 생성)
- [ ] Traefik 헬스 체크 (대시보드에 Traefik 상태 표시)
- [ ] 설정 백업/복원
- [ ] 멀티 사용자 (역할 기반: 관리자 / 뷰어)

---

## 참조

- [NPM (Nginx Proxy Manager)](https://github.com/NginxProxyManager/nginx-proxy-manager)
- [Mantrae](https://github.com/MizuchiLabs/mantrae)
- [Traefik Authentik Forward Plugin](https://plugins.traefik.io/plugins/6870d2b186449432ce61535e/traefik-authentik-forward-plugin)
- [Authentik Traefik 공식 문서](https://docs.goauthentik.io/add-secure-apps/providers/proxy/server_traefik/)
