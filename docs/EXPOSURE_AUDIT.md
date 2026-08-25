# 외부 노출 스냅샷

기준 시각: 2026-08-25 (KST)

이 문서는 Traefik 런타임의 활성 HTTPS `Host` 규칙을 기준으로 작성한 수동 스냅샷입니다. 공개 DNS가 존재하는 것과 인터넷에서 서비스에 접근할 수 있는 것은 구분합니다.

## 요약

- 활성 HTTPS 호스트: 29개
- 공개 경로가 하나라도 있는 활성 호스트: 21개
- 전체 경로가 Tailnet 전용인 호스트: 8개
- UI는 Tailnet 전용이고 공개 예외 경로가 있는 호스트: 1개
- 일반 서비스 경로가 공개망에 도달하며 Authentik으로 보호되는 호스트: 12개
- 일반 서비스 경로가 공개망에 도달하며 앱 또는 엣지 보안에 의존하는 호스트: 8개
- DNS는 남았지만 활성 Traefik 라우터가 없는 호스트: 2개

## Tailnet 전용

- `admin-vault.lizstudio.co.kr`
- `file.lizstudio.co.kr`
- `monitor.lizstudio.co.kr`
- `n8n.lizstudio.co.kr`
- `obsidian.lizstudio.co.kr`
- `ollama.lizstudio.co.kr`
- `portainer.lizstudio.co.kr`
- `traefik-manager.lizstudio.co.kr`

공개 DNS는 유지하지만 Traefik IP allowlist가 Tailnet 밖의 요청을 차단합니다. 같은 FQDN을 Tailnet에서도 사용하므로 대시보드 주소를 별도 내부 주소로 바꾸지 않습니다.
서비스를 점검 안내 모드로 전환해도 본문, 정적 자산, HTTP 리다이렉트 라우터에 같은 IP allowlist가 유지됩니다.

## Tailnet UI와 공개 예외

- `smarthome.lizstudio.co.kr`: UI와 일반 API는 Tailnet 전용이며 `/api/webhook/`만 rate limit을 거쳐 공개됩니다.

## 공개망과 Authentik

- `ai.lizstudio.co.kr`
- `backup-dashboard.lizstudio.co.kr`
- `couchdb.lizstudio.co.kr`
- `dashy.lizstudio.co.kr`
- `dupe.lizstudio.co.kr`
- `english.lizstudio.co.kr`
- `glances.lizstudio.co.kr`
- `hanaai.lizstudio.co.kr`
- `home.lizstudio.co.kr`
- `netdata.lizstudio.co.kr`
- `tax.hanadays.co.kr`
- `uptime.hanastay.co.kr`

Traefik까지는 공개망에서 도달할 수 있고 애플리케이션 앞의 Authentik 인증을 통과해야 합니다. `uptime.hanastay.co.kr`은 Cloudflare 프록시도 거칩니다.

## 공개망과 앱 또는 엣지 보안

- `auth.lizstudio.co.kr`: Authentik 로그인 서버
- `hanaspace.lizstudio.co.kr`
- `immich.lizstudio.co.kr`
- `jellyfin.lizstudio.co.kr`
- `tcg.lizstudio.co.kr`
- `vault.lizstudio.co.kr`: `/admin`은 Traefik에서 차단
- `hanastay.co.kr`: Cloudflare 프록시
- `www.hanastay.co.kr`: Cloudflare 프록시 및 대표 도메인 리다이렉트

이 그룹은 Traefik 공통 SSO가 없으므로 각 앱의 로그인, 공개 서비스 설계 또는 Cloudflare 정책에 의존합니다.

## 라우터 없는 보존 도메인

- `comfyui.lizstudio.co.kr`: Manager 서비스 비활성, 백엔드 중지, Traefik 404
- `hanadays.co.kr`: 구형 OTA 서비스 비활성, 백엔드 중지, Traefik 404

두 DNS 레코드와 Homepage·Dashy 링크는 중지된 서비스를 기억하고 나중에 재사용하기 위해 의도적으로 유지합니다. DNS 삭제 계획은 없으며 이 목적에는 `hosting.co.kr` 관리 권한도 필요하지 않습니다. `tax.hanadays.co.kr`과 Tailnet 전용 Portainer는 현재 활성 서비스입니다.

## n8n 공개 webhook 판단

조사 시점에 비아카이브 workflow는 6개이고 그중 5개가 활성 상태지만, webhook 노드를 포함한 workflow와 등록된 webhook은 모두 0개입니다. 따라서 n8n에는 공개 경로 예외를 만들지 않고 전체 Tailnet 전용 상태를 유지합니다.

## 앱 인증 경계 점검

- `vault.lizstudio.co.kr`: 공개 회원가입을 끄고 관리자 초대는 유지합니다. 기존 계정과 가족 사용에는 영향이 없습니다.
- `hanaspace.lizstudio.co.kr`: 비밀번호 로그인 POST 경로에 IP별 분당 10건, 순간 5건의 Traefik rate limit을 적용합니다.
- `smarthome.lizstudio.co.kr`: 최근 7일 웹훅 순간 최대 16건을 기준으로 공개 예외를 분당 120건, 순간 40건으로 제한합니다.
- `jellyfin.lizstudio.co.kr`: 로그인 POST 경로에는 IP별 분당 10건, 순간 5건의 Traefik rate limit을 적용합니다. 활성 사용자 3명을 모두 공개 로그인 화면에서 숨겼고 기존 17개 기기 토큰이 계속 유효한 것을 확인했습니다. Jellyfin `10.11.11`의 앱 자체 실패 잠금은 잠금 이후에도 로그인이 가능한 upstream 결함이 있어 보안 경계로 간주하지 않습니다.
- `immich.lizstudio.co.kr`, `tcg.lizstudio.co.kr`, `auth.lizstudio.co.kr`: 비인증 관리·사용자 API가 각각 `401` 또는 `403`으로 차단되는 것을 확인했습니다.

버전 점검 시 Vaultwarden `1.37.2`와 Jellyfin `10.11.11`은 최신 패치이고, WordPress `7.0.4`는 7.0 계열 최신 보안 릴리스입니다. Immich `3.0.3`과 Authentik `2026.5.6`은 즉시 보안 패치가 필요한 상태로 판정하지 않았으며 [업그레이드 사전 점검](UPGRADE_PREFLIGHT_2026-08-25.md)에 실행 조건과 보류 사유를 기록했습니다.

## 인코딩 경로 차단 감시

2026-08-25 읽기 전용 재확인에서 최근 15분은 차단 0건/전체 1,671건, 최근 24시간은 차단 3건/전체 62,570건으로 집계됐습니다. 24시간 차단 대상은 `hanastay` 2건과 기타 라우터 1건이며 요청 본문, 원본 경로, IP는 저장하지 않습니다.

감시는 활성 상태이고 기준은 15분 20건입니다. 현재 기준 미달이라 대상 서비스와 전체 스캔량이 포함된 새 경고는 아직 자연 발생하지 않았습니다. 임계치 변경이나 합성 공격 없이 이력 집계와 서비스 매핑까지만 확인했습니다.

## 확인 근거

- Traefik 런타임 API의 활성 HTTPS 라우터와 middleware
- 권한 DNS와 공개 A 레코드 조회
- Manager 서비스 저장값과 실제 컨테이너 상태
- n8n SQLite의 활성 workflow 및 webhook 등록 상태
- 공인 IP 강제 접속의 `403` 응답과 Tailnet DNS 경로의 정상 응답
- Homepage·Dashy의 동일 공개 FQDN 링크와 중지 서비스 보존 링크

구성 변경 후에는 이 문서를 자동 현황으로 간주하지 말고 같은 항목을 다시 점검합니다.
