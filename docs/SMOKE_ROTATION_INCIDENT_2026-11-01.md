# 월간 점검 계정 회전 후 모바일 화면 검사 실패

## 확인한 사건

11/1 04:17 KST의 `traefik-manager-smoke-rotation.service`는 viewer와 admin
점검 계정의 비밀번호를 교체한 뒤, 모바일 다크모드 대시보드 검사에서 종료 코드
1로 끝났다. 운영 로그는 숨겨진 콘텐츠 240px 초과와 정보 카드 3개를 보고했다.
점검 계정 이외의 일반 관리자 비밀번호 실패나 Manager 전체 장애를 뜻하지 않는다.
연속 감지 92회는 같은 systemd 실패 상태를 확인한 횟수다.

## 재현과 수정

실제 `TraefikUpdatePlanPanel`에 긴 가짜 이미지 digest와 Compose 경로를 전달하는
인증 없는 시각 fixture를 추가했다. 운영 credential이나 API는 사용하지 않는다.
기본 상태에서 360px 화면에 숨겨진 콘텐츠 779px 초과를 재현했다.
이는 실제 로그와 같은 정보 카드의 그리드 최소 너비 문제이며, fixture 경로가
더 길므로 초과 픽셀 자체는 운영 로그와 다르다.

모바일에서 열 정의가 없는 grid는 긴 값의 자동 최소 너비만큼 늘어났다.
정보 grid에 `grid-cols-1`, grid와 정보 항목에 `min-w-0`를 적용했다.
기존 긴 값의 말줄임과 명령 영역의 내부 가로 스크롤은 유지했다.
인접 명령 카드도 같은 시각 검사에서 화면 안에 남는지 확인한다.
기존 실제 운영 스모크는 이 문제를 탐지했지만, 긴 digest·경로의 인증 없는
고정 회귀 fixture가 없어 사전 로컬 검사에서 잠그지 못했다.

## 로컬 검증

- `npm run test:traefik-update-plan-visual`: 360/390/768/1440px, 라이트·다크 8개 통과.
- 각 화면의 정보 3개, 긴 digest 값, 숨겨진 가로 넘침 없음, 명령 내부 스크롤 검증.
- 모바일 다크 스크린샷도 확인했고 운영 데이터는 포함하지 않았다.
- `npm run test:traefik-update-plan`, 회전 스크립트 `--self-test`, ESLint 통과.
- production build는 최초 보안 경고로 실패했으며 같은 명령 재실행에서 통과했다.
  보안 취약점이 해결됐다는 뜻은 아니다.
- fixture는 기존 방식처럼 `VISUAL_FIXTURES_ENABLED=1`일 때만 활성화한다.

## 운영 반영 준비

기존 Next.js 16.4.0의 공식 보안 권고 GHSA-673q-mjm6-r5xr를 추가로 확인했다.
해당 권고의 수정 버전은 16.4.1이며 보안 패치 적용 여부는 사용자에게 확인했다.
현재 소스에서 `use cache`와 `cacheComponents` 사용은 찾지 못했지만 이것만으로
보안 패치가 불필요하다고 판정하지 않는다. 이후 마무리 요청에 따라 같은 16.4
계열의 최신 패치인 Next.js와 eslint-config-next 16.4.3을 적용했다.
lockfile도 대응하는 Next 패키지만 갱신했고 React·Zod의 메이저 변경은 하지 않았다.
새 버전에서 production build와 lint, 긴 정보 시각 검사, 업데이트 계획 self-test,
blue-green과 rollback 실패 격리 검사를 통과했다.
운영 의존성 audit에서 Next는 더 이상 보고되지 않으며 critical은 0이다.
기존 Zod와 follow-redirects high 경고는 별도 미해결 항목으로 남긴다.

또한 동일 fixture·테스트 파일에 동시 수정이 관찰돼 다른 에이전트의 작업 여부를
확인했다. 이후 저장소를 다시 확인했을 때 추가 코드 변경 없이 확정된 수정 커밋을
유지했다. 배포 전 공유 SQLite를 비공개 백업하고 integrity_check=ok를 확인했다.
이 준비 기록 시점에는 운영 컨테이너 교체, 비밀번호 재회전과 서비스 실패 초기화를
아직 수행하지 않았으며 실제 반영 결과는 후속 기록으로 구분한다.

## 운영 반영·복구 완료

마무리 요청 후 `e6d2405` 소스를 기존 blue-green 절차로 `v1.38.348`에 배포했다.
후보 green backend/frontend health와 migration 사전 검사를 통과한 뒤 전환했고,
전환 probe 20건이 모두 HTTP 200이었다. 공유 DB schema 변경은 없었다.
기존 blue 슬롯은 절차에 따라 종료됐으며 롤백용 컨테이너·이미지는 삭제하지 않았다.
원래부터 비추적이던 운영 백업 디렉터리와 별도 callback 설정은 임시 Git 제외 목록에
정확히 두 경로만 지정해 보존했다. tracked 변경 감시는 유지했고 임시 목록은 제거했다.

- active green의 두 컨테이너는 healthy, 버전·revision은 모두 `v1.38.348 / e6d2405`다.
- 실제 frontend 런타임의 Next.js 버전은 `16.4.3`이다.
- 호스트에서 기존 Tailnet HTTPS `/api/health`는 HTTP 200, `status=정상`이었다.
  시각 fixture는 운영에서 HTTP 404로 차단됐다.
- 컨테이너 안에서 Tailnet 호스트명을 직접 조회한 추가 probe는 DNS 실패했다.
  호스트 기반 배포 probe와 실제 브라우저 검사는 통과했으며, 이 컨테이너의
  MagicDNS 미지원 상태를 호스트 Tailnet 장애로 판단하지 않았다.
- 승인된 실제 `traefik-manager-smoke-rotation.service` 재실행은 16:15:57에 시작해
  16:17:52 KST에 종료 코드 0·`Result=success`·inactive/dead로 끝났다.
- viewer/admin 점검 계정만 재교체했고 일반 관리자와 다른 계정임을 사전 확인했다.
  실제 브라우저 검사에서 서비스 30개와 10개 API, 모바일 다크·데스크톱 라이트
  주요 7개 화면, 로그인 화면과 관리자 읽기 전용 403 보호를 확인했다.
- DB의 회전 상태는 `success`, 마지막 성공은 16:17:51 KST,
  성공 revision은 실제 배포된 `e6d2405`로 저장됐다. 성공 기록을 수동으로 쓰지 않았다.
- 이어 기존 watchdog 서비스를 한 번 실행해 16:18:05 KST에
  `healthy / ok:46-units`, 연속 실패 0·활성 알림 0으로 복구됨을 확인했다.
  감시 기준선·임계값·상태 파일을 바꾸거나 `reset-failed`로 실패를 숨기지 않았다.
  이는 수동 후속 확인이며 다음 자연 예약 실행을 관측했다는 뜻은 아니다.
- 월간 회전 timer는 그대로 유지하며 다음 실행은 12/1 04:17 KST다.

GitHub Actions를 반복 호출하지 않고 로컬·실제 운영 경로로 검증했다.
원래 화면 장애의 수정·배포·점검 재실행·감시 복구는 완료됐으며,
별도 Zod/follow-redirects 보안 경고는 [의존성 보안 후속](DEPENDENCY_SECURITY_2026-11-01.md)에서
추적한다. 다음 자연 예약 실행 관측은 이 기록과 별개다.
