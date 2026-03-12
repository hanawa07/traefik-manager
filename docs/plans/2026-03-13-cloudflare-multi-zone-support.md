# Cloudflare 멀티존 지원 설계

## 배경

기존 Cloudflare DNS 자동 연동은 단일 zone(`cf_api_token`, `cf_zone_id`)만 저장했습니다. 이 구조에서는 다음 문제가 있었습니다.

- 한 서버에서 여러 상위 도메인(zone)을 동시에 운영할 수 없습니다.
- Cloudflare를 사용하지 않는 도메인도 같은 진단 흐름 안에서 혼동을 일으킵니다.
- 드리프트 진단과 재동기화 결과가 "왜 제외되었는지"를 설명하지 못합니다.

## 목표

- 여러 Cloudflare zone을 동시에 저장하고 서비스 도메인별로 올바른 zone을 자동 선택합니다.
- Cloudflare를 사용하지 않는 도메인은 자동 제외하되, 결과 화면과 audit detail에 제외 사유를 남깁니다.
- 기존 단일 zone 설정은 자동으로 읽어와서 호환합니다.

## 설계 결정

### 1. 설정 저장 모델

- 새 저장 키: `cf_zone_configs`
- 값 형식: JSON 배열
- 항목 필드:
  - `api_token`
  - `zone_id`
  - `zone_name`
  - `record_target`
  - `proxied`

레거시 키(`cf_api_token`, `cf_zone_id`, `cf_record_target`, `cf_proxied`)는 읽기 호환만 유지하고, 새 설정 저장 시 제거합니다.

### 2. 도메인 → zone 매칭

- 서비스 도메인 suffix와 zone 이름을 비교합니다.
- 여러 zone이 일치하면 가장 구체적인 suffix(가장 긴 일치)를 우선합니다.
- 일치하는 zone이 없으면 Cloudflare 비대상 도메인으로 처리합니다.

예시:

- `api.hanastay.co.kr` → `hanastay.co.kr`
- `admin.lizstudio.co.kr` → `lizstudio.co.kr`
- `example.com`만 Cloudflare에 있고 `example.net`은 외부 DNS면 `example.net`은 자동 제외

### 3. 비Cloudflare 도메인 처리

- 자동 DNS 등록/삭제 대상에서 제외
- 드리프트 진단 대상에서 제외
- 재동기화 대상에서 제외
- UI 결과와 audit detail에 제외 도메인/사유를 기록

이 정책의 의도는 "Cloudflare 미사용 도메인도 정상 운영 대상"이라는 사실을 기능적으로 드러내는 데 있습니다.

## 적용 범위

- 설정 화면 Cloudflare 카드
- Cloudflare 연결 테스트
- DNS 드리프트 진단
- DNS 재동기화
- 서비스 생성/수정 시 Cloudflare upsert
- 관련 audit detail 및 설정 테스트 이력

## 구현 결과

- Cloudflare 설정은 멀티존 JSON으로 저장합니다.
- 드리프트 진단 결과에 zone별 요약과 비Cloudflare 도메인 제외 목록을 함께 표시합니다.
- 재동기화도 zone별로 수행하고, Cloudflare 대상이 아닌 서비스는 건너뜁니다.
- 문서와 UI 안내 문구는 단일 zone이 아니라 "Cloudflare 대상 zone 목록" 기준으로 설명합니다.
