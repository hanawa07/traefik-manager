# 외부 노출 스냅샷

노출 기준 시각: 2026-08-25, 앱 점검 갱신: 2026-09-01 (KST)

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
- `jellyfin.lizstudio.co.kr`: 로그인 POST 경로에는 IP별 분당 10건, 순간 5건의 Traefik rate limit을 적용합니다. 활성 사용자 3명을 모두 공개 로그인 화면에서 숨겼고 기존 17개 기기 토큰이 계속 유효한 것을 확인했습니다. Jellyfin `10.11.11`의 앱 자체 실패 잠금은 잠금 이후에도 로그인이 가능한 upstream 결함이 있어 보안 경계로 간주하지 않습니다. GitHub HTML 페이지를 manifest로 잘못 등록한 저장소 4개와 중복 저장소 3개를 제거한 뒤 플러그인 업데이트가 오류 없이 완료됐습니다.
- `immich.lizstudio.co.kr`, `tcg.lizstudio.co.kr`, `auth.lizstudio.co.kr`: 비인증 관리·사용자 API가 각각 `401` 또는 `403`으로 차단되는 것을 확인했습니다.

버전 점검 시 Vaultwarden `1.37.2`와 Jellyfin `10.11.11`은 최신 패치이고, WordPress `7.0.4`는 7.0 계열 최신 보안 릴리스입니다. Authentik은 `2026.8.0`으로 업데이트했고 Immich는 `3.0.3`을 유지합니다. [업그레이드 점검 및 결과](UPGRADE_PREFLIGHT_2026-08-25.md)에 검증값과 Immich 보류 사유를 기록했습니다.

## 인코딩 경로 차단 감시

2026-08-25 읽기 전용 재확인에서 최근 15분은 차단 0건/전체 1,671건, 최근 24시간은 차단 3건/전체 62,570건으로 집계됐습니다. 24시간 차단 대상은 `hanastay` 2건과 기타 라우터 1건이며 요청 본문, 원본 경로, IP는 저장하지 않습니다.

감시는 활성 상태이고 기준은 15분 20건입니다. 현재 기준 미달이라 대상 서비스와 전체 스캔량이 포함된 새 경고는 아직 자연 발생하지 않았습니다. 임계치 변경이나 합성 공격 없이 이력 집계와 서비스 매핑까지만 확인했습니다.

## 공개 서비스 요청 제한과 DDoS 경계

2026-09-01 최근 24시간 Traefik access 로그에서 공개 서비스별 단일 출발지의 초당 최대 요청을 확인했다. `hanaspace`는 39건, `ai`, `glances`, `hanaai`, `home`, `jellyfin`, `vault`는 각각 19건이었다. 기존 정상 최대치보다 충분히 높은 공용 `rateLimit` 템플릿인 초당 100건·순간 200건을 이 7개 서비스의 HTTPS 주 라우터에 적용했다. 서비스 저장값, 생성 YAML의 `shared-79f9b84f@file` 참조, 공용 템플릿 값, Traefik 오류 없음과 각 도메인의 정상 응답을 함께 확인했다.

`hanaspace`와 `jellyfin`의 로그인 POST 전용 분당 제한은 공용 요청 제한과 별도로 유지한다. `immich`는 같은 24시간 표본에서 단일 출발지 초당 최대 194건과 Traefik 429 응답 99건이 관측돼 대량 사진 요청에 기존 공용 제한이 실제 작동하는 상태이므로 더 낮추지 않았다. `uptime.hanastay.co.kr`은 초당 최대 2건이고 이미 Cloudflare 프록시를 거치므로 오리진 공용 템플릿 추가 대상에서 제외했다. 적용 시도 중 기존 Cloudflare DNS 동기화 검증 오류가 확인됐지만 API를 우회하거나 DNS를 변경하지 않았고, 다른 서비스에 대한 부분 변경도 모두 원복한 뒤 7개 대상만 다시 적용했다.

이 rate limit은 애플리케이션과 서버 자원을 보호하지만 회선 포화형 또는 다수 출발지 분산 DDoS를 막지 못한다. 이미 Cloudflare 프록시인 `hanastay.co.kr`, `www.hanastay.co.kr`, `uptime.hanastay.co.kr`은 엣지 정책을 우선 사용한다. 일반 웹 요청 중심인 Authentik 보호 서비스와 `hanaspace`, `vault`는 개별 로그인·WebSocket·업로드 회귀 검증 후 Cloudflare 전환 후보로 본다. `immich`의 대용량 업로드, `jellyfin`의 미디어 스트리밍, `couchdb` 동기화, `auth` 중앙 로그인, `smarthome` 공개 webhook은 서비스 특성이나 전체 인증 영향 때문에 별도 검증 전에는 일괄 전환하지 않는다. Tailnet 전용 서비스는 공개 엣지 전환 대상이 아니다.

현재 여러 직접 공개 서비스가 동일한 원본 IP의 80/443을 공유하고 일부 서비스는 계속 직접 연결이 필요하다. 이 상태에서 호스트 방화벽을 Cloudflare 대역만 허용하도록 잠그면 직접 서비스도 함께 중단되며, L3/L4 방화벽은 TLS 안의 도메인별 예외를 구분할 수 없다. 모든 공개 웹 경로를 프록시하거나 직접 연결 예외를 별도 원본 IP·포트·Tunnel로 분리하기 전에는 원본 80/443을 Cloudflare 전용으로 제한하지 않는다. 이번 점검에서는 DNS와 호스트 방화벽을 변경하지 않았다.

`lizstudio.co.kr`의 권한 DNS는 현재 `hosting.co.kr`이므로 Cloudflare token만 추가해서 개별 호스트를 프록시할 수 없다. Free·Pro full setup에서는 전체 DNS 레코드 복제와 권한 네임서버 이전이 선행되어야 하며, 첫 검증 대상은 장기 연결·대용량 전송이 없는 `backup-dashboard`로 정했다. 이 이전을 승인하기 전에는 DNS를 변경하지 않는다.

서비스별 호환성, Cloudflare 제한과 Immich/Jellyfin 분리 선택지는 [Cloudflare 공개 프록시 전환 사전 점검](CLOUDFLARE_PROXY_PREFLIGHT_2026-09-01.md)에 기록했다.

## 확인 근거

- Traefik 런타임 API의 활성 HTTPS 라우터와 middleware
- 권한 DNS와 공개 A 레코드 조회
- Manager 서비스 저장값과 실제 컨테이너 상태
- n8n SQLite의 활성 workflow 및 webhook 등록 상태
- 공인 IP 강제 접속의 `403` 응답과 Tailnet DNS 경로의 정상 응답
- Homepage·Dashy의 동일 공개 FQDN 링크와 중지 서비스 보존 링크

구성 변경 후에는 이 문서를 자동 현황으로 간주하지 말고 같은 항목을 다시 점검합니다.
