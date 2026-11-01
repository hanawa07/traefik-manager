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

이 기록 시점에는 소스 검증을 완료했으며 blue-green 배포와 실제 운영 브라우저
검증은 아래 후속 결과를 기준으로 판단한다. 기존 운영 설정·백업은 보존한다.
