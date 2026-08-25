# 애플리케이션 업그레이드 사전 점검

기준 시각: 2026-08-25 (KST)

이 문서는 Immich `3.0.3`에서 `3.1.0`, Authentik `2026.5.6`에서 `2026.8.0`으로 올리기 전에 운영 구성, 백업, 호환성과 검증 조건을 확인한 결과입니다. 사전 점검만 수행했으며 두 서비스의 실행 버전은 변경하지 않았습니다.

## 결론

- Immich: 서버와 데이터베이스 구성은 `3.1.0`을 실행할 수 있습니다. 다만 활성 iOS 기기의 OS 상세 버전을 서버에서 확인할 수 없어 iOS 14 사용 여부를 확인할 때까지 업데이트를 보류합니다.
- Authentik: `2026.8.0`으로 올릴 기술 조건을 충족합니다. 12개 이상 서비스의 중앙 인증 경계이므로 별도 점검 창에서 서버와 worker를 함께 올리고 대표 ForwardAuth 서비스를 검증해야 합니다.
- 두 제품 모두 공식적으로 downgrade를 지원하지 않으므로 단순 이미지 태그 복귀를 복구 절차로 간주하지 않습니다. 실패 시 점검 전에 만든 데이터베이스 백업과 기존 compose 구성으로 복원합니다.

## Immich 3.1.0

### 현재 구성

- 서버와 machine-learning 이미지: `v3.0.3`, 두 컨테이너 모두 healthy
- PostgreSQL: `18.2`, VectorChord `0.5.3`, vector `0.8.1`
- 데이터베이스 크기: 약 2.9 GB
- 대상 `v3.1.0` 서버 이미지의 `linux/amd64`와 machine-learning CUDA 이미지 manifest 확인
- 현재 compose를 `IMMICH_VERSION=v3.1.0`으로 해석했을 때 서버와 CUDA 이미지 태그가 함께 바뀌는 것을 확인

현재 데이터베이스는 이미 공식 VectorChord 이미지 구조를 사용하므로 별도의 pgvecto.rs 전환 작업은 필요하지 않습니다. 최근 thumbnail 작업 오류는 손상되거나 지나치게 큰 원본 파일과 WebP 메모리 실패로 분류되며 데이터베이스 migration 오류는 없습니다.

### 백업과 보류 조건

- 로컬 백업: `/home/lizstudio/db_backups/2026-08-25/immich_postgres_immich.sql.gz`
- gzip 무결성과 main NAS의 동일 크기 사본을 확인했습니다.
- sub NAS의 당일 사본은 이번 점검에서 확인하지 못했으므로 복구 사본으로 계산하지 않습니다.
- `3.1.0`의 배포·서버 breaking change는 없고 모바일의 iOS 14 지원 종료만 확인됐습니다.
- 활성 iOS 세션은 있지만 서버 기록에 OS 상세 버전이 없어 iOS 15 이상임을 입증하지 못했습니다.

### 실행 순서

1. 사용 중인 모든 iOS 기기가 iOS 15 이상인지 확인하고 Immich 앱을 최신 버전으로 올립니다.
2. 실행 직전에 PostgreSQL 백업을 다시 만들고 gzip 무결성과 NAS 사본을 확인합니다.
3. `.env`의 `IMMICH_VERSION`을 `v3.1.0`으로 고정한 뒤 server와 machine-learning 이미지를 함께 pull합니다.
4. compose 전체를 재생성하고 네 컨테이너 health, 서버 버전, migration 로그를 확인합니다.
5. 로그인, 사진 목록, 신규 업로드, 썸네일 생성과 machine-learning 작업을 확인합니다.

근거: [Immich v3.1.0 릴리스](https://github.com/immich-app/immich/releases/tag/v3.1.0), [Immich 업그레이드 지침](https://docs.immich.app/install/upgrading/)

## Authentik 2026.8.0

### 현재 구성

- server와 worker 이미지: `2026.5.6`, 두 컨테이너 모두 healthy
- PostgreSQL: `16.11`, 데이터베이스 크기 약 167 MB, migration 불일치 없음
- proxy outpost 1개는 embedded outpost이며 별도 outpost 컨테이너는 없습니다.
- `2026.8.0` 이미지는 `linux/amd64`를 지원합니다.
- live/ready endpoint는 `200`, 비인증 사용자 API는 `403`을 반환합니다.

공식 compose의 호스트 포트 공개와 Docker socket mount는 현재 구성에 필요하지 않습니다. 로컬 구성은 Traefik `proxy_net`, 내부 PostgreSQL 네트워크, worker의 `cap_drop: ALL`과 `no-new-privileges`를 유지하고 embedded outpost를 server와 함께 올립니다.

### 백업과 변경점

- 로컬 백업: `/home/lizstudio/db_backups/2026-08-25/authentik-postgresql_authentik.sql.gz`
- gzip 무결성과 main NAS의 동일 크기 사본을 확인했습니다.
- `hash_password` 명령의 평문 위치 인자가 제거됐지만 현재 자동화에는 해당 명령 사용이 없습니다.
- WebAuthn의 중복 기기 방지 옵션 제거는 별도 조치가 필요하지 않습니다.
- server/proxy outpost 진입점이 Rust로 재작성됐으므로 embedded proxy 경로를 실제 로그인으로 확인해야 합니다.
- `AUTHENTIK_WEB__BASE_URL=https://auth.lizstudio.co.kr`를 server와 worker에 함께 설정합니다. 이 값은 `2026.11`부터 필수이며 scheme과 host만 사용합니다.

### 실행 순서

1. 실행 직전에 PostgreSQL 백업을 다시 만들고 gzip 무결성과 NAS 사본을 확인합니다.
2. compose와 비밀값을 제외한 환경 설정 사본을 보관합니다.
3. server와 worker의 태그를 모두 `2026.8.0`으로 고정하고 Base URL을 추가합니다.
4. 두 이미지를 먼저 pull한 뒤 server와 worker를 같은 작업 창에서 재생성합니다.
5. migration 완료, server/worker health, embedded outpost 상태를 확인합니다.
6. Authentik 직접 로그인과 대표 ForwardAuth 서비스 1개를 확인한 뒤 전체 서비스 상태를 점검합니다.

Authentik은 major release 순서를 지켜야 하고 server와 모든 outpost 버전이 일치해야 하며 downgrade를 지원하지 않습니다. 현재 `2026.5.6`에서 다음 정식 major인 `2026.8.0`으로 가는 경로는 유효하지만 중앙 인증 점검 없이 자동 업데이트하지 않습니다.

근거: [Authentik 2026.8.0 릴리스](https://github.com/goauthentik/authentik/releases/tag/version/2026.8.0), [2026.8 변경점](https://docs.goauthentik.io/releases/2026.8/), [Authentik 업그레이드 지침](https://docs.goauthentik.io/install-config/upgrade)
