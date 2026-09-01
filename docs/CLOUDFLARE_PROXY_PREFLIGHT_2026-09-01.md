# Cloudflare 공개 프록시 전환 사전 점검

점검 시각: 2026-09-01 (KST)

이 문서는 공개 서비스의 Cloudflare 프록시 전환 가능성을 검토한 읽기 전용 사전 점검입니다. 이번 작업에서는 DNS, 방화벽, Traefik 런타임과 서비스 라우터를 변경하지 않았습니다.

## 결론

- 일반 웹 UI는 단계별 전환 후보지만, 현재 Manager에는 `hanastay.co.kr` zone만 등록되어 있어 `lizstudio.co.kr`과 `hanadays.co.kr`은 먼저 zone별 최소 권한 API 설정이 필요합니다.
- `immich`는 대용량 사진·영상 업로드 제한 때문에, `jellyfin`은 일반 Cloudflare CDN의 영상 전송 정책 때문에 공개 프록시 대상에서 제외합니다.
- `vault`와 `jellyfin`에는 실제 장시간 소켓 연결이 있어 단순 HTTP 응답 확인만으로 전환 완료를 판정하면 안 됩니다.
- 직접 연결 서비스가 같은 공인 IP의 80/443을 계속 사용하는 동안에는 호스트 방화벽을 Cloudflare 대역 전용으로 잠글 수 없습니다.
- 근본적인 회선 DDoS 보호가 필요하면 Immich/Jellyfin을 Tailnet 전용으로 바꾸거나 별도 공인 IP·외부 릴레이로 분리한 뒤, 기존 80/443을 Cloudflare 전용으로 제한해야 합니다.

## 현재 전제

- Manager Cloudflare 설정: `hanastay.co.kr` 1개 zone, 프록시 활성
- 이미 프록시된 호스트: `hanastay.co.kr`, `www.hanastay.co.kr`, `uptime.hanastay.co.kr`
- Traefik `web`·`websecure`: Cloudflare 공식 IP 대역만 `forwardedHeaders.trustedIPs`로 신뢰
- Cloudflare IP 대역 감시: 사용자 systemd timer 활성, 하루 한 번 공식 목록과 Traefik·Hanastay Apache 설정 비교
- Tailnet 전용 호스트와 비활성 보존 호스트: 공개 프록시 전환 대상 아님

이 구조에서는 Cloudflare를 거친 요청의 실제 방문자 IP를 기존 IP별 rate limit과 감사 로그에 전달할 수 있습니다. 새 zone을 추가할 때도 클라이언트가 임의로 보낸 `X-Forwarded-For`를 엣지에서 제거하고 Cloudflare가 다시 만든 값만 신뢰해야 합니다.

## 24시간 관측

Traefik JSON access log를 호스트별로 익명 집계했습니다. 요청 경로, 쿼리, IP와 본문은 출력하거나 저장하지 않았습니다.

| 구분 | 관측 결과 | 해석 |
| --- | --- | --- |
| 일반 웹 UI | 최대 요청 0.01 MiB, 최대 응답 2.20 MiB, 최대 처리 1.09초 | 관측된 요청만 보면 기본 프록시 제한 안에 있음 |
| Immich | 1,696건, 최대 응답 4.62 MiB, 대용량 업로드 관측 없음 | 사용이 적었던 하루일 수 있어 업로드 호환성 근거로 사용할 수 없음 |
| Vaultwarden | 30초 이상 알림 소켓 22건, 최장 약 4.3일 | WebSocket 재연결과 알림 수신 회귀 검증 필요 |
| Jellyfin | 30초 이상 소켓 1건, 최장 약 2.2일 | 소켓 호환성과 별개로 영상 전송 정책상 일반 프록시 제외 |
| AI 서비스 | 실제 장시간 생성 응답 관측 없음 | 첫 응답 지연과 SSE heartbeat를 별도 합성 점검해야 함 |

이 표본은 최근 사용 흔적일 뿐 최대 파일 크기나 모든 앱 동작을 보장하지 않습니다.

## 서비스 분류

| 판정 | 서비스 | 전환 전 확인 |
| --- | --- | --- |
| 유지 | `hanastay`, `www.hanastay`, `uptime` | 현재 프록시와 실제 방문자 IP 전달 유지 |
| 1차 후보 | `backup-dashboard`, `dashy`, `dupe`, `english`, `glances`, `home`, `netdata`, `tcg` | 로그인, 정적 자산, POST, 원본 IP, 4xx/5xx 확인 |
| 조건부 후보 | `ai`, `hanaai` | SSE 첫 응답 125초 이내, heartbeat와 장시간 생성 확인 |
| 조건부 후보 | `hanaspace` | 실제 최대 업로드·다운로드와 공유 링크 확인 |
| 조건부 후보 | `vault` | 앱 로그인, 동기화, 알림 WebSocket 끊김 후 자동 재연결 확인 |
| 마지막 전환 | `auth` | 모든 Authentik 보호 서비스의 로그인·로그아웃 회귀 확인 |
| 별도 설계 | `couchdb` | 복제 long-poll, 첨부 파일 크기와 클라이언트 호환성 확인 |
| 별도 설계 | `smarthome` 공개 webhook | 외부 발신자, 실제 IP, 서명 검증과 rate limit 확인 |
| 직접 연결 유지 | `immich` | 100 MiB 초과 업로드가 가능한 경로 유지 |
| 직접 연결 유지 | `jellyfin` | 일반 Cloudflare CDN을 거치지 않는 영상 경로 유지 |

`tax.hanadays.co.kr`은 일반 웹 UI 특성상 1차 후보와 같지만, `hanadays.co.kr` zone의 DNS 권한 이전 여부를 먼저 결정해야 하므로 이번 일괄 목록에서는 제외합니다.

## Cloudflare 제한

- Free·Pro의 최대 업로드는 100 MB, Business는 200 MB이며 초과 파일은 DNS-only 경로나 분할 업로드가 필요합니다. [Cloudflare 413 안내](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/)
- 기본 origin 응답 대기는 125초이고 쓰기 대기는 30초입니다. 장시간 작업은 응답 스트리밍이나 상태 조회가 없으면 `524`가 날 수 있습니다. [Cloudflare 연결 제한](https://developers.cloudflare.com/fundamentals/reference/connection-limits/)
- WebSocket은 모든 요금제에서 지원하지만 Cloudflare 배포나 idle timeout으로 연결이 종료될 수 있어 heartbeat와 재연결이 필요합니다. [Cloudflare WebSocket 안내](https://developers.cloudflare.com/network/websockets/)
- Free·Pro·Business의 공개 Tunnel 호스트도 영상·대용량 파일 정책을 우회하지 않습니다. [Cloudflare 영상 전송 정책](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/)

따라서 Cloudflare Tunnel로 Immich/Jellyfin 공개 주소만 옮기는 방법은 원본 포트를 닫는 데는 도움이 되지만, 공개 대용량 업로드와 영상 정책 문제를 해결하지 않습니다.

## 원본 분리 선택지

1. 모든 사용자가 Tailscale을 쓸 수 있으면 Immich/Jellyfin을 Tailnet 전용으로 바꾸는 것이 가장 단순하고 강합니다.
2. 공개 접근이 필요하면 별도 공인 IP 또는 VPS·WireGuard 릴레이로 두 서비스를 분리합니다. 기존 80/443은 그 뒤 Cloudflare 대역만 허용할 수 있습니다.
3. 같은 공인 IP의 별도 포트로 옮기는 방법은 URL과 앱 설정만 복잡해지고 회선 포화 공격은 그대로 맞으므로 권장하지 않습니다.
4. 단기적으로 프록시 호스트에 per-hostname Authenticated Origin Pull을 적용하면 Cloudflare 우회 HTTP 요청은 줄일 수 있지만, 공유 공인 IP 회선의 L3/L4 DDoS는 막지 못합니다. [Cloudflare AOP 설명](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/explanation/)

## DNS 동기화 점검

`uptime` 서비스 수정 실패는 DNS 드리프트가 아니라, 이미 같은 레코드에도 Manager가 매번 Cloudflare `PUT`을 보낸 것이 원인이었습니다. 현재 token은 조회는 성공하지만 쓰기 요청은 `403`이므로 무관한 서비스 수정까지 실패했습니다. 기존 문서의 `DNS Settings:Edit`는 레코드 편집 권한이 아니며, 이 권한을 사용했거나 token의 zone 범위가 맞지 않으면 같은 응답이 발생할 수 있습니다.

Manager는 기존 레코드의 `type`, `name`, `content`, `ttl`, `proxied`, `comment`가 모두 같으면 기존 ID를 반환하고 쓰기를 생략합니다. 실제 드리프트가 있으면 이전처럼 갱신을 시도하므로 자동 DNS 변경에는 대상 zone으로 제한한 `DNS Write`(대시보드의 `Zone:DNS:Edit`) 권한이 계속 필요합니다. [Cloudflare DNS record 갱신 권한](https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/edit/)

이 수정은 다음 정상 blue-green 배포에 포함합니다. 운영 컨테이너에 파일을 직접 덮어쓰지 않습니다.

## 단계별 전환안

1. zone별 최소 권한 token과 원본 대상을 등록하고 드리프트 0건을 확인합니다.
2. 1차 후보 한 개만 프록시한 뒤 로그인, POST, 실제 IP, rate limit과 5xx를 확인합니다.
3. 같은 유형의 1차 후보를 묶어 전환하고 각 묶음 사이에 관측 시간을 둡니다.
4. 조건부 후보는 앱별 WebSocket·SSE·업로드 시나리오를 통과한 뒤 전환합니다.
5. `auth`는 마지막에 전환하고 모든 Authentik 보호 앱을 다시 확인합니다.
6. Immich/Jellyfin 분리 경로를 확정하기 전에는 원본 80/443 방화벽을 Cloudflare 전용으로 바꾸지 않습니다.

롤백은 해당 DNS 레코드를 기존 DNS-only 값으로 되돌리는 것으로 제한합니다. 원본 라우터와 인증 설정은 DNS 전환과 동시에 바꾸지 않아 원인과 복구 경계를 분리합니다.
