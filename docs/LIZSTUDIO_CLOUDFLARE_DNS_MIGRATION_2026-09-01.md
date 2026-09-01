# lizstudio.co.kr Cloudflare DNS 이관 기준선

점검 시각: 2026-09-01 (KST)

이 문서는 `lizstudio.co.kr`을 Cloudflare full setup으로 옮길 때 사용할 읽기 전용 기준선과 단계별 검증·롤백 순서입니다. 점검 중 DNS, 네임서버, Cloudflare zone, Fail2Ban과 방화벽 설정은 변경하지 않았습니다. 원본 IP, TXT 검증값, DKIM 공개키와 API credential은 저장소에 기록하지 않습니다.

## 완전성 경계

- 권한 DNS는 `ns1`~`ns4.hosting.co.kr`입니다.
- AXFR은 허용되지 않아 공개 질의만으로 숨은 owner name까지 전수 증명할 수 없습니다.
- 아래 목록은 권한 DNS 공개 응답, Traefik 런타임, Manager 서비스 DB와 인증서 투명성 이력을 합친 확인 기준선입니다.
- 실제 이관 전에는 `hosting.co.kr` 관리 화면의 zone export 또는 전체 레코드 목록을 받아 아래 기준선과 대조해야 합니다. provider export 없이 네임서버를 바꾸지 않습니다.

## 확인된 레코드

| 종류 | 확인 결과 | 이관 원칙 |
| --- | --- | --- |
| A | owner 42개, 레코드 44개, TTL 180초, 대상 주소 4종 | 값과 TTL을 그대로 DNS-only로 복제 |
| AAAA | 확인된 owner에서 0개 | provider export에서 다시 확인 |
| CNAME | 확인된 owner에서 0개 | provider export에서 다시 확인 |
| MX | apex 5개, Google Workspace | 우선순위와 대상을 그대로 보존 |
| TXT | apex SPF 1개, Google 검증 1개 | 원문 그대로 보존 |
| DKIM | `google._domainkey` TXT 1개 | selector와 공개키를 그대로 보존 |
| NS | `hosting.co.kr` 4개 | full setup 활성화 때 Cloudflare 지정 NS로 교체 |
| SOA | `hosting.co.kr` 관리 | Cloudflare가 새 SOA를 생성하므로 직접 복제하지 않음 |
| CAA | 없음 | 이관 중 새 정책을 함께 만들지 않음 |
| DNSSEC | parent DS·zone DNSKEY 없음 | NS 전환 검증 후 Cloudflare에서 별도 활성화 |
| 메일 정책 | DMARC·MTA-STS·TLS-RPT 없음 | DNS 이관과 보안 정책 도입을 분리 |
| SRV | 일반 메일·SIP·XMPP selector에서 없음 | provider export에서 사용자 정의 SRV 재확인 |

`mail.lizstudio.co.kr`과 `smtp.lizstudio.co.kr`은 각각 A 레코드가 있으므로 Google MX만 보고 삭제하면 안 됩니다.

## Host 기준선

Traefik 활성 호스트 25개:

`admin-vault`, `ai`, `auth`, `backup-dashboard`, `couchdb`, `dashy`, `dupe`, `english`, `file`, `glances`, `hanaai`, `hanaspace`, `home`, `immich`, `jellyfin`, `monitor`, `n8n`, `netdata`, `obsidian`, `ollama`, `portainer`, `smarthome`, `tcg`, `traefik-manager`, `vault`

Manager 비활성 보존 호스트:

`comfyui`

현재 DNS는 해석되지만 Traefik 활성 목록 밖에 있는 보존·인프라 호스트 16개:

`lizstudio.co.kr`, `cockpit`, `download`, `grafana`, `homarr`, `interpreter.ai`, `mail`, `npm`, `photos`, `plex`, `plexpy`, `smtp`, `synology`, `traefik`, `webhard`, `www`

이 42개 owner name은 사용 여부를 이유로 이관 중 정리하지 않습니다. 삭제 판단은 네임서버 전환과 별도 작업으로 분리합니다.

## 예상 Diff

네임서버 전환 직후에는 다음 차이만 허용합니다.

| 항목 | 전환 전 | Cloudflare DNS-only 전환 후 |
| --- | --- | --- |
| 권한 NS | `hosting.co.kr` 4개 | Cloudflare가 배정한 2개 |
| SOA | `hosting.co.kr` SOA | Cloudflare SOA |
| A·AAAA·CNAME | 현재 공개값 | 값·owner·TTL 동일 |
| MX·TXT·DKIM | 현재 공개값 | 값·우선순위 동일 |
| proxy 상태 | 직접 연결 | 전부 DNS-only |
| DS | 없음 | 초기에는 없음 |

첫 서비스 시험에서만 `backup-dashboard`의 proxy 상태를 DNS-only에서 proxied로 바꿉니다. 원본 주소, Traefik 라우터, Authentik과 애플리케이션 설정은 동시에 변경하지 않습니다.

## Manager 제약

현재 Manager의 `proxied` 값은 서비스가 아니라 Cloudflare zone 단위입니다. `lizstudio.co.kr`을 `proxied=true`로 등록하면 Manager는 같은 zone의 모든 서비스가 프록시되어야 한다고 판단합니다.

따라서 `backup-dashboard` 한 개를 시험하는 동안에는 `lizstudio.co.kr` zone을 Manager 자동 DNS에 등록하지 않습니다. Cloudflare 대시보드에서 해당 레코드만 수동 전환하고, 선택지는 시험 완료 후 결정합니다.

1. 서비스별 proxy override를 Manager에 추가합니다.
2. 호환 서비스 전체를 프록시한 뒤 zone 단위 설정을 사용합니다.
3. 선택적 proxy를 계속 Cloudflare에서 수동 관리하고 Manager 대상 zone에서 제외합니다.

## 전환 체크리스트

### 준비

1. `hosting.co.kr` 전체 zone export를 확보합니다.
2. 확인된 A 44개, MX 5개, apex TXT 2개, DKIM TXT 1개와 export를 대조합니다.
3. Cloudflare zone에 모든 레코드를 DNS-only로 만들고 proxy 자동 활성 항목이 없는지 확인합니다.
4. MX 우선순위, SPF 원문, Google 검증값과 DKIM 공개키를 양쪽에서 비교합니다.
5. Hanastay와 같은 `X-Forwarded-For` 제거 Transform Rule을 `lizstudio.co.kr` zone에 준비합니다.
6. Fail2Ban의 Traefik Jail에서 Cloudflare 공식 대역을 edge로 잘못 차단하지 않도록 ignore 정책과 현재 차단을 정리합니다. 이 단계는 실제 차단 해제와 설정 변경이므로 별도 명시 승인을 받은 뒤 Anubis 안전 변경 경로로 실행합니다.

### 권한 DNS 전환

1. registrar에서 권한 NS를 Cloudflare 지정값으로 교체합니다.
2. Cloudflare zone이 `Active`가 될 때까지 proxy를 켜지 않습니다.
3. `1.1.1.1`과 `8.8.8.8`에서 NS·A·MX·TXT·DKIM을 확인합니다.
4. 활성·Tailnet·비활성 보존 호스트 42개가 기존과 같은 DNS 결과를 내는지 비교합니다.
5. Google Workspace 수신·발신과 SPF·DKIM 결과를 확인합니다.

### backup-dashboard 1개 시험

1. Cloudflare에서 `backup-dashboard` A 레코드만 proxied로 변경합니다.
2. Authentik 로그인·로그아웃, 세션 복귀와 실제 POST 요청을 확인합니다.
3. Traefik access log의 `ClientHost`가 Cloudflare edge가 아니라 실제 방문자 주소로 정규화되는지 익명 집계합니다.
4. 기존 DDoS rate limit, Fail2Ban, 4xx·5xx·429 추이를 확인합니다.
5. 원본 직접 접속 차단은 다른 직접 연결 서비스 분리 전까지 적용하지 않습니다.

## 롤백

- 서비스 시험 실패: `backup-dashboard`만 DNS-only로 되돌립니다.
- zone 이관 실패: `hosting.co.kr` zone을 그대로 유지한 상태에서 registrar NS를 이전 값으로 되돌립니다.
- 메일 실패: MX·TXT·DKIM 차이를 먼저 복구하고 애플리케이션이나 Traefik을 함께 바꾸지 않습니다.
- Manager에는 시험 zone을 등록하지 않으므로 서비스 저장이 proxy 상태를 되돌리는 경로가 없습니다.

## Fail2Ban 기준선

- 빠른 probe: 10분 내 3회, 약 116일 차단, 현재 408개 차단
- 저속 probe: 24시간 내 5회, 약 116일 차단, 현재 50개 차단
- 최근 인코딩 경로 출발지 3개는 빠른·저속 Jail 모두에서 차단됨
- 저속 감시 최근 60분 차단 0건
- 빠른 Jail에 Cloudflare 공식 대역 주소 1개가 2026-08-22부터 복원 차단 상태로 남아 있음

마지막 항목은 프록시 확대 전 해제와 재발 방지가 필요합니다. 이 문서 작성 중에는 실제 Jail·nftables 상태를 변경하지 않았습니다.
