# 2026-10-15 Manager health 점검 실패

## 확인된 사실

- 시각은 KST 기준이다.
- 04:16:16 Tailscale netcheck가 UDP 통신 불가와 대체 경로 시도를 기록했다.
- 04:16:29 시작한 Manager watchdog은 DNS 조회가 15초 동안 응답하지 않아 실패했다.
- 점검 대상은 `TAILNET_FRONTEND_URL`이 우선이며, 이번 점검도 Tailnet 경로였다.
- 같은 시간 Tailscale DNS의 UDP/TCP 재시도와 NAS/NFS timeout이 기록됐다.
- 04:17:55 Tailscale 재연결 후 04:21 NAS 점검과 Manager health가 정상화됐다.
- 해당 구간 Manager와 Traefik의 재시작 또는 물리 NIC link down 기록은 확인되지 않았다.

## 판정 범위

직접 실패 원인은 DNS 조회 시간 초과다. 동시에 Tailnet 통신 지연이 있었으나,
보관된 서버 로그만으로 공유기·통신망·호스트 중 UDP 지연의 시작 지점을
확정할 수 없다. 점검 간격 때문에 장애가 전체 5분 동안 지속됐다고 단정하지 않는다.

## 반영한 개선

- watchdog은 DNS 조회 실패, DNS 조회 시간 초과, TCP 연결 실패, 요청 시간 초과,
  TLS 실패, HTTP 응답을 구분한다.
- curl 원문 오류는 내부 분류에만 사용하고 알림·상태 파일에 전달하지 않는다.
- Anubis는 허용된 분류만 한국어로 표시하며, 구형 `connection-failed`도 받는다.
- 점검 메시지는 대상이 공개 도메인이라고 단정하지 않는다.
- 분류와 전송 검증은 가짜 curl·Docker·notifier를 사용해 실제 알림 없이 수행했다.

2026-10-16 재점검에서 UDP 통신, MagicDNS IPv4·IPv6 조회와 Manager health는 정상이었다.
DNS·방화벽·Tailscale 설정은 변경하지 않았다.
