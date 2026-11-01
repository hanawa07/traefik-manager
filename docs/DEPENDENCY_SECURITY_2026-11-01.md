# 운영 의존성 보안 후속

## 범위

사용자가 승인한 잔여 follow-redirects 패치와 Zod 호환성 검토를 진행했다.
이번 변경은 Manager frontend 의존성·폼 검증 연결·격리 테스트에 한정한다.
운영 서비스·미들웨어·사용자·리다이렉트의 실제 설정을 테스트 데이터로 바꾸지 않는다.

- follow-redirects 1.16.0 → 1.16.2: Axios의 허용 범위 안에서 lockfile만 갱신.
- Zod 3.25.76 → 4.6.7: 수정된 버전으로 전환.
- resolver 3.10.0 → 5.9.2: Zod 4 지원 버전으로 전환. 새 메이저 7은 선택하지 않았다.
- react-hook-form은 실제 설치된 7.71.2를 유지하며 선언 하한만 peer 요구에 맞춰 7.55로 변경.

참고: [follow-redirects 권고](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p),
[Zod 권고](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[Zod 공식 마이그레이션](https://zod.dev/v4/changelog).
권고의 direct follow-redirects 재현을 Axios 자체의 공격 재현으로 확대하지 않는다.

## 호환성과 회귀 검사

기존 폼 정책과 한국어 오류 문구는 유지했다. 리다이렉트 schema만 기존 폼에서
별도 파일로 추출해 실제 resolver 경로를 테스트한다. 서비스·미들웨어 숫자 필드
6개에는 Zod 4의 `unknown` 입력 추론을 기존 숫자 폼 계약에 맞게 명시했다.
문자열 숫자의 런타임 변환은 그대로 유지되며 강제 타입 단언을 사용하지 않았다.

- 변경 전 실제 4개 schema·resolver 검사 23개를 통과시켜 기준 동작을 고정했다.
- follow-redirects는 외부 통신 없는 loopback 서버와 가짜 헤더로 기존 버전의
  cross-realm 누출을 재현했다. 수정 후 cross-realm·배열형 헤더·정규식 문자·
  기본 Authorization/Cookie 제거 4개를 통과했다.
- Zod 변경 후 같은 23개 검사와 TypeScript·lint·production build를 통과했다.
  숫자 입력 타입 충돌은 운영 반영 전에 타입 검사에서 재현·수정했다.
- 긴 업데이트 정보의 모바일/데스크톱·라이트/다크 시각 검사도 다시 수행했다.
- 두 새 테스트를 기존 릴리스 최종 검사에 연결하고 actionlint를 통과했다.
- 운영 의존성 audit은 모든 심각도 0건이다. 전체 audit은 개발 전용 moderate 17건,
  high/critical 0건이다. 개발 의존성까지 모두 해결했다고 주장하지 않는다.

## 운영 상태

`474923f` 소스로 `v1.38.349`를 기존 blue-green 절차로 green → blue에 배포했다.
후보 health와 migration 사전 검사를 통과한 뒤 전환했고 probe 18건 모두 HTTP
200이었다. DB schema 변경은 없고, 전환 전 SQLite 백업의 integrity_check도
정상이었다. 이전 green 컨테이너·이미지와 비추적 운영 설정·백업은 보존했다.

- backend/frontend의 버전·revision은 `v1.38.349 / 474923f`로 일치하며 healthy다.
- 실제 운영 클라이언트 번들에서 Zod `4.6.7` 버전 표식을 확인했다.
  client 의존성은 번들에 들어가므로 standalone node_modules에 개별 패키지가
  없다는 것을 설치 실패로 오해하지 않는다. follow-redirects는 수정된 lockfile과
  실제 Docker `npm ci` 및 loopback 회귀 검사로 확인했다.
- 기존 Tailnet HTTPS health가 `status=정상`으로 응답했다.
- 실제 월간 회전 서비스를 실행해 점검 계정 2개를 회전한 뒤 서비스 30개,
  10개 API, 모바일 다크·데스크톱 라이트 주요 화면, 로그인과 관리자 읽기 전용
  403을 검증했다. 실제 서비스·미들웨어·사용자 관리 설정을 가짜 값으로 저장하지 않았다.
- 18:08:24 KST에 종료 코드 0·`Result=success`로 끝났고, DB의 성공 시각과
  성공 revision도 실제 `474923f`로 기록됐다.
- 기존 사용자 systemd watchdog도 후속 실행해 `healthy / ok:46-units`,
  연속 실패 0·활성 알림 0을 확인했다. 감시 기준선·임계값은 변경하지 않았다.

GitHub Actions를 반복 호출하지 않고 로컬 검사와 실제 운영 경로로 검증했다.
이번 두 운영 의존성 경고의 패치·호환성 확인·배포·운영 검증은 완료했다.
이 시점에 남은 개발용 moderate 17건의 분류와 자연 예약 점검은 아래 후속에서 확인했다.

## 개발 의존성 후속 점검

같은 날 후속 점검에서 moderate 17건은 독립 취약점 17개가 아니라 아래 두
권고와 상위 패키지의 연쇄 경고임을 확인했다.

| 원인 | 설치 경로와 판단 | 처리 |
| --- | --- | --- |
| [CSS selector CPU 소모](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Tailwind 3.4.19와 postcss-nested 6.2.0의 빌드용 parser | 허용 범위 안에서 6.1.4 → 6.1.5 패치 |
| [minimatch 패턴 증폭](https://github.com/advisories/GHSA-g3hv-75wg-m249) | ESLint·플러그인·TypeScript ESLint의 3.1.5/10.2.4 | 잔여 moderate 16건의 공통 원인으로 보류 |

minimatch 권고는 외부 입력 패턴과 `optimizationLevel >= 2`의 증폭을 설명하며
수정 버전은 11.0.1이다. 현재 앱 소스에는 minimatch 직접 호출이 없고 lint
도구 경로에 설치되어 있다. 이것을 운영 HTTP 공격 경로나 위험 0의 증명으로
확대하지 않는다. 신뢰할 수 없는 소스·lint 설정을 실행하는 경우에는 별도 검토한다.

ESLint와 일부 플러그인은 3.x의 callable CommonJS API를 사용하므로 11.x를
전역 override하지 않는다. audit의 ESLint 4.0.0·Next 설정 0.2.4 다운그레이드
제안도 적용하지 않는다. 호환되는 구버전 보안 backport 또는 상위 도구의
수정 minimatch 지원이 나오면 재검토한다. 외부 glob 입력을 처리하는 기능을
추가하거나 untrusted lint 작업을 도입할 때도 이 보류를 다시 검토해야 한다.

검증 결과:

- lockfile 변경은 개발용 parser의 version·resolved·integrity 3개 필드뿐이다.
  변경 전후 모든 비개발 패키지 항목의 구조적 동일성을 assertion으로 확인했다.
- 새 lockfile의 `npm ci --ignore-scripts --no-audit --no-fund`, lint,
  TypeScript 포함 production build가 성공했다.
  일반·복합·반복 selector 3개의 parse/serialize 검사도 통과했다.
- 전체 audit은 moderate 16건, high/critical 0건이다. `npm audit --omit=dev
  --audit-level=low`는 취약점 0건이며 audit 경고를 숨기거나 예외 처리하지 않았다.
- 이번 변경은 다음 빌드용 개발 의존성 패치다. 운영 재배포·계정 재회전은 하지
  않았다. 운영은 검증된 `v1.38.349 / 474923f`를 유지하며 backend/frontend와
  dockerproxy가 healthy이고 Tailnet HTTPS health는 `status=정상`이다.
- 사용자 systemd watchdog은 수동 복구 확인 이후 18:11 정기 실행에서도
  `Result=success / exit 0`이었다. 현재 상태는 `healthy / ok:46-units`, 연속
  실패 0·활성 알림 0이다. 월간 회전의 다음 자연 실행은 12월 1일 04:17 KST로,
  아직 관측한 결과가 아니며 이를 확인하려고 지금 다시 실행하지 않는다.
