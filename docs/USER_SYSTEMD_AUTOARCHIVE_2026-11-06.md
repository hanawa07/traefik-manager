# Quant 자동 보관 타이머 감시 등록

## 원인과 승인

11월 6일 01:50 KST의 `unexpected-timer:codex-quant-autoarchive.timer`는
신규 타이머의 감시 기준선 등록 누락이었다. 서비스 실행 실패와는 별개다.
사용자가 자신이 요청한 작업임을 확인한 뒤 등록했다.

## 조치

- timer·service 설정 검증과 기존 watchdog 통합 self-test를 통과했다.
- 기존 기준선을 로컬 상태 디렉터리에 백업한 뒤 다음 제한 갱신만 수행했다.

```bash
scripts/user-systemd-unit-watchdog.sh --refresh-baseline \
  codex-quant-autoarchive.timer codex-quant-autoarchive.service
```

- 전후 비교 assertion으로 기존 46개 unit의 hash·role이 동일하고, 지정한 두
  unit만 추가되어 총 48개가 됐음을 확인했다. 전체 기준선 재생성은 하지 않았다.
- 자동 보관 코드·실행 주기·대상과 다른 unit 설정은 변경하지 않았다.

## 복구 확인

기존 watchdog 서비스를 실행해 02:01:46 KST `Result=success / exit 0`을 확인했다.
상태는 `healthy / ok:48-units`, 연속 실패 0·활성 알림 0이다. 기존 복구 알림
경로도 성공했으며 시험 알림이나 상태 파일 수동 초기화는 하지 않았다.
자동 보관 작업은 기존 예약대로 실행되며 최근 실행도 exit 0이었다.

다음 watchdog 자연 예약은 02:11 KST다. 아직 그 실행의 결과를 확인한 것은 아니다.
새 타이머를 추가하는 쪽에서도 생성 후 해당 timer·service만 제한 등록해야 한다.
