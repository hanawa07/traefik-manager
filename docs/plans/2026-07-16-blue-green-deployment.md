# Manager blue-green 배포 설계

## 목표와 현재 기준

Manager 자체 라우터는 `traefik-manager-self.yml` file provider로 컨테이너 수명과 분리되어 재배포 중 404가 사라졌다. 다만 backend와 frontend를 한 개씩 교체하는 현재 방식에서는 새 frontend가 준비될 때까지 기존 service upstream이 사라져 짧은 503이 남는다.

2026-07-14 배포의 0.2초 간격 외부 측정 기준은 다음과 같다.

- 총 요청 343건
- 404 0건
- 503 11건
- 연결 실패 1건
- 비정상 응답 구간 약 5.11초

목표는 배포 중 file-provider 라우터를 유지하는 것뿐 아니라 준비된 frontend/backend 쌍 사이에서 upstream을 원자 전환해 외부 요청을 계속 200으로 처리하는 것이다.

## 단순 복제를 사용하지 않는 이유

현재 compose를 `--scale`만 하는 방식은 안전하지 않다.

- 고정 `container_name`과 Docker 상태 조회 로직이 단일 컨테이너를 전제로 한다.
- 두 backend가 같은 SQLite와 영속 볼륨을 사용하면 마이그레이션 및 쓰기 경합이 생길 수 있다.
- health monitor, 감사 로그 보존, 운영 알림 같은 background task가 중복 실행될 수 있다.
- Traefik이 준비되지 않은 후보를 load balancer에 먼저 넣으면 503을 줄이지 못한다.

따라서 상시 replica가 아니라 한 번에 하나만 active인 blue/green 슬롯을 사용한다.

## 목표 구조

- `backend-blue` + `frontend-blue`
- `backend-green` + `frontend-green`
- frontend와 같은 슬롯 backend는 `traefik-manager-app` 내부망에서 통신한다.
- 후보 backend는 health 통과 후에만 `proxy_net`의 stable ForwardAuth alias를 받는다.
- `traefik-manager-self.yml`의 service URL은 active frontend alias 하나만 가리킨다.
- 후보 frontend healthcheck는 후보 backend의 `/api/health`까지 통과해야 한다.
- active slot과 배포 revision은 호스트 상태 파일에 기록한다.
- inactive backend는 API health만 제공하고 background task leader lease를 기다린다.

서비스 URL 예시는 `http://traefik-manager-frontend-blue:3000`과 `http://traefik-manager-frontend-green:3000`이다. 기존 `init-traefik-config.sh`의 임시 파일 생성 후 `mv` 패턴을 그대로 재사용해 URL 한 줄만 원자 교체한다.

## 배포 순서

1. 호스트 배포 잠금을 획득하고 active slot을 읽는다.
2. 새 revision 이미지를 한 번만 빌드한다.
3. inactive backend와 frontend를 app 내부망에서 background task standby 상태로 시작한다.
4. DB migration 사전 검증과 후보 `/api/health`를 수행한다.
5. 후보 frontend를 내부에서 연속 3회 확인하고 backend에 stable ForwardAuth alias를 연결한 뒤 다시 3회 확인한다.
6. file-provider service URL을 후보 frontend로 원자 교체한다.
7. Traefik API에서 provider가 `file`, service가 `enabled`, 후보 upstream이 `UP`인지 확인한다.
8. 외부 `/api/health`를 연속 확인한 뒤 active slot 상태를 기록한다.
9. 새 active backend가 file lock leader lease를 승계했는지 확인한다.
10. 기존 slot을 drain한 후 종료한다.

후보 검증이 실패하면 6단계 전이므로 기존 active slot을 그대로 두고 후보만 제거한다. 전환 후 외부 검증이 실패하면 file-provider URL을 이전 slot으로 즉시 되돌리고 새 slot을 제거한다.

## 데이터와 작업 안전 조건

- Alembic migration은 이전 app revision과 동시에 실행 가능한 backward-compatible 변경만 blue-green으로 배포한다.
- 컬럼 삭제, 이름 변경, 데이터 재작성은 expand/migrate/contract 릴리즈로 나눈다.
- SQLite schema 변경은 배포 잠금 안에서 한 번만 실행한다.
- background task는 `active` lease 또는 명시적 환경변수로 단일 backend에서만 실행한다.
- 후보가 영속 설정을 수정하지 않도록 준비 검증은 읽기 API로 제한한다.
- 전환 상태 파일에는 slot, revision, version, 갱신 시각만 저장하고 비밀값은 기록하지 않는다.

## 구현 상태

1. background task를 API process 시작과 분리하고 route 연동 file lock leader를 추가했다.
2. compose에 blue/green 고유 service, 같은 슬롯 API upstream과 안정 ForwardAuth alias를 추가했다.
3. `scripts/blue-green-deploy.sh`에 후보 준비, 원자 전환, 상태 기록과 rollback을 구현했다.
4. `scripts/manager-deployment-probe.sh`가 전환 중 공개 health를 0.2초 간격으로 검사한다.
5. 대시보드 배포 카드가 active slot을 표시하고 운영 시각 스모크가 이를 검증한다.
6. 기존 단일 교체 명령은 비상 fallback으로 유지한다.
7. 배포 JSONL은 상한을 두고 회전하며 실패 단계·안전한 원인과 rollback 실패 알림 실행 URL을 저장한다.
8. 대시보드는 배포 이력을 상태별로 필터링하고 최근 알림 실행 결과를 함께 표시한다.

## 완료 기준

- 연속 두 번의 blue/green 배포에서 0.2초 간격 외부 `/api/health` 요청이 모두 200이다.
- 후보 health 실패 시 file-provider 파일과 active slot이 바뀌지 않는다.
- 전환 후 검증 실패를 강제로 만들면 이전 slot으로 자동 rollback된다.
- 배포 중 background 알림과 감사 보존 작업이 한 번만 실행된다.
- 대시보드가 active slot, revision, file-provider upstream `UP`을 표시한다.
- backend 전체 테스트, frontend lint/build, 로컬 및 원격 인증 시각 스모크가 통과한다.
