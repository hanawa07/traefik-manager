# 애플리케이션 업그레이드 사전 점검 및 결과

기준 시각: 2026-08-25, 실행 결과 갱신: 2026-08-26 (KST)

이 문서는 Immich `3.0.3`에서 `3.1.0`, Authentik `2026.5.6`에서 `2026.8.0`으로 올리기 전에 운영 구성, 백업, 호환성과 검증 조건을 확인한 결과입니다. Immich는 보류했고 Authentik은 2026-08-26 통제 업그레이드를 완료했습니다.

## 결론

- Immich: 서버와 데이터베이스 구성은 `3.1.0`을 실행할 수 있지만 배포하지 않습니다. 운영 중인 iOS 기기는 모두 iOS 15 이상으로 확인했지만 `3.1.0`의 iPhone HEIC 회귀가 공식 이슈로 남아 있어 수정 릴리스를 기다립니다.
- Authentik: server와 worker를 `2026.8.0`으로 함께 올렸고 migration, embedded outpost, 대표 ForwardAuth 경로 검증을 통과했습니다.
- 두 제품 모두 공식적으로 downgrade를 지원하지 않으므로 단순 이미지 태그 복귀를 복구 절차로 간주하지 않습니다. 실패 시 점검 전에 만든 데이터베이스 백업과 기존 compose 구성으로 복원합니다.

## Immich 3.1.0

### 현재 구성

- 서버와 machine-learning 이미지: `v3.0.3`, 두 컨테이너 모두 healthy
- PostgreSQL: `18.2`, VectorChord `0.5.3`, vector `0.8.1`
- 데이터베이스 크기: 약 2.9 GB
- 대상 `v3.1.0` 서버 이미지의 `linux/amd64`와 machine-learning CUDA 이미지 manifest 확인
- 현재 compose를 `IMMICH_VERSION=v3.1.0`으로 해석했을 때 서버와 CUDA 이미지 태그가 함께 바뀌는 것을 확인

현재 데이터베이스는 이미 공식 VectorChord 이미지 구조를 사용하므로 별도의 pgvecto.rs 전환 작업은 필요하지 않습니다. 최근 thumbnail 작업 오류는 0바이트·손상 JPEG 원본, WebP 출력 형식의 크기 제한, ffmpeg thumbnail 처리 실패로 분류되며 데이터베이스 migration 오류는 없습니다.

2026-08-26 기준 최근 96시간 thumbnail 오류를 고유 자산 27개로 중복 제거했습니다. 0바이트 원본 7개, JPEG 조기 종료 9개, JPEG DCT 손상 6개, WebP 출력 크기 제한 4개, ffmpeg 변환 실패 1개입니다. 원본 삭제나 자동 재인코딩은 하지 않았고 파일명과 경로가 포함된 보고서는 Git에서 제외되는 `/home/lizstudio/docker/immich/reports/thumbnail-errors-2026-08-26.csv`에 mode `600`으로 저장했습니다.

DB 저장값과 현재 원본을 대조한 결과 27개 모두 파일 크기와 수정시각이 일치했습니다. 외부 라이브러리 26개는 내용이 아닌 `sha1("path:" + originalPath)`를 저장하므로 현재 내용 SHA-256을 별도 기준값으로 남겼고, 내용 SHA-1을 저장한 1개는 현재 파일과 일치했습니다. WebP 제한 자산에 남은 파생 파일 6개는 모두 디코딩됐으며 ffmpeg 실패 영상 원본도 전체 디코딩을 통과했습니다. 0바이트 7개와 손상 JPEG 15개에는 복원 가능한 파생 파일이 없어 원본 백업 또는 수리가 필요합니다. 상세 결과는 `/home/lizstudio/docker/immich/reports/thumbnail-errors-forensics-2026-08-26.csv`에 mode `600`으로 저장했습니다.

WebP 실패 4개는 높이 `16,707~28,800px`인 세로 이미지입니다. preview의 WebP override를 공식 설정 API로 제거해 Immich 기본값인 JPEG로 되돌리고 해당 4개만 다시 처리했습니다. JPEG preview 4개, WebP thumbnail 4개와 thumbhash가 모두 등록됐고 실제 파일 디코딩도 통과했습니다. 3.1초 HEVC 영상 1개는 메모리 부족이 아니라 `-skip_frame nointra` 뒤 필터에 전달되는 프레임이 없는 문제였습니다. 해당 자산의 컨테이너 판정값을 작업 중에만 바꿔 문제 옵션을 생략하고 공식 자산 작업 API를 실행한 뒤 원래 MOV 메타데이터를 복원했습니다. 영상의 JPEG preview와 WebP thumbnail도 정상 등록됐습니다. 5개 원본의 SHA-256은 작업 전 기준값과 모두 일치하고 운영 이미지 패치는 만들지 않았습니다.

### 백업과 보류 조건

- 로컬 백업: `/home/lizstudio/db_backups/2026-08-25/immich_postgres_immich.sql.gz`
- gzip 무결성과 main NAS의 동일 크기 사본을 확인했습니다.
- sub NAS의 당일 사본은 이번 점검에서 확인하지 못했으므로 복구 사본으로 계산하지 않습니다.
- 현재 Immich 백업은 PostgreSQL만 저장하며 `/mnt/hdd4tb/library`의 미디어는 복제하지 않습니다.
- 주간 NAS 복제 대상에는 Synology `homes` 공유가 없고 NFS로 노출된 snapshot이나 다른 로컬 미디어 미러도 없습니다. 손상 원본 22개의 접근 가능한 서버 측 복구 사본은 0개이며, DSM 자체 snapshot 또는 Hyper Backup 존재 여부는 별도 확인이 필요합니다.
- `3.1.0`의 배포·서버 breaking change는 없고 모바일의 iOS 14 지원 종료만 확인됐습니다.
- 서버 세션에는 OS 상세 버전이 남지 않지만, 운영 중인 iOS 기기는 모두 iOS 15 이상임을 사용자 확인으로 검증했습니다. iOS 14 지원 종료는 더 이상 업그레이드 보류 조건이 아닙니다.
- 라이브러리에는 HEIC/HEIF 자산 `28,759`개가 있으며 이 중 2025년 이후 자산은 `4,039`개입니다. `3.1.0` 서버 이미지를 운영에 연결하지 않은 채 네트워크·쓰기 권한 없이 Apple 기기 모델별 표본 120개를 디코딩했고 모두 통과했습니다.
- 표본 통과는 전체 자산과 향후 업로드의 안전을 보장하지 않습니다. `3.1.0`의 `libheif 1.21.2`가 일부 정상 iPhone HEIC를 거부하는 회귀와 관련 이슈가 아직 열려 있으므로 `libheif 1.22.2` 이상을 포함한 수정 릴리스가 나오기 전에는 배포하지 않습니다. 표본 결과는 Git에서 제외되는 `/home/lizstudio/docker/immich/reports/heic-v3.1.0-probe-2026-08-26.tsv`에 mode `600`으로 저장했습니다.

### 실행 순서

1. 사용 중인 모든 iOS 기기가 iOS 15 이상인지 확인했습니다. 실제 업그레이드 직전에 Immich 앱의 최신 버전 여부만 다시 확인합니다.
2. HEIC 회귀 수정 릴리스와 포함된 `libheif` 버전을 확인하고 같은 120개 표본 및 신규 iPhone HEIC를 읽기 전용으로 다시 검사합니다.
3. 실행 직전에 PostgreSQL 백업을 다시 만들고 gzip 무결성과 NAS 사본을 확인합니다.
4. `.env`의 `IMMICH_VERSION`을 검증한 수정 버전으로 고정한 뒤 server와 machine-learning 이미지를 함께 pull합니다.
5. compose 전체를 재생성하고 네 컨테이너 health, 서버 버전, migration 로그를 확인합니다.
6. 로그인, 사진 목록, 신규 업로드, 썸네일 생성과 machine-learning 작업을 확인합니다.

근거: [Immich v3.1.0 릴리스](https://github.com/immich-app/immich/releases/tag/v3.1.0), [Immich 업그레이드 지침](https://docs.immich.app/install/upgrading/), [Immich v3.0.3 checksum 정의](https://github.com/immich-app/immich/blob/v3.0.3/server/src/enum.ts), [Immich v3.1.0 thumbnail 구현](https://github.com/immich-app/immich/blob/v3.1.0/server/src/utils/media.ts), [I-frame 부족 thumbnail 분석](https://github.com/immich-app/immich/discussions/15133), [iPhone HEIC 회귀 분석](https://github.com/immich-app/immich/issues/30459), [미해결 HEIC thumbnail 이슈](https://github.com/immich-app/immich/issues/29943)

## Authentik 2026.8.0 (완료)

### 현재 구성

- server와 worker 이미지: `2026.8.0`, 동일 image digest, 두 컨테이너 모두 healthy
- PostgreSQL: `16.11`, 데이터베이스 크기 약 167 MB, Django migration 774건 적용
- proxy outpost 1개는 embedded outpost이며 별도 outpost 컨테이너는 없습니다.
- live/ready endpoint는 `200`, outpost ping은 `204`, 비인증 사용자 API는 `403`을 반환합니다.

공식 compose의 호스트 포트 공개와 Docker socket mount는 현재 구성에 필요하지 않습니다. 로컬 구성은 Traefik `proxy_net`, 내부 PostgreSQL 네트워크, worker의 `cap_drop: ALL`과 `no-new-privileges`를 유지하고 embedded outpost를 server와 함께 올립니다.

### 백업과 변경점

- 직전 복구 백업: `/home/lizstudio/docker/authentik/backups/pre-upgrade-2026.8.0-20260826-015727`
- PostgreSQL custom-format dump와 restore list, compose·환경·마운트 데이터, 전후 컨테이너 상태와 checksum을 mode `600`으로 보관했습니다.
- `hash_password` 명령의 평문 위치 인자가 제거됐지만 현재 자동화에는 해당 명령 사용이 없습니다.
- WebAuthn의 중복 기기 방지 옵션 제거는 별도 조치가 필요하지 않습니다.
- server/proxy outpost의 Rust 진입점과 embedded proxy 경로가 정상 동작하는 것을 확인했습니다.
- `AUTHENTIK_WEB__BASE_URL=https://auth.lizstudio.co.kr`를 server와 worker에 함께 설정했고 tenant 저장값에도 반영됐습니다.

### 실행 결과

1. 대상 이미지를 서비스 중단 전에 pull하고 server와 worker만 함께 재생성했습니다.
2. 시작 중 migration과 worker socket 준비 전의 일시적 health `404`/`503`은 준비 완료 후 `200`으로 정상화됐습니다.
3. proxy provider 13개, embedded outpost 1개와 유효 core session 130개를 업그레이드 후 확인했습니다.
4. 직접 로그인 flow 화면은 `200`, 대표 ForwardAuth 서비스 3개는 비인증 요청을 `302`로 인증 화면에 전달했습니다.
5. 준비 완료 이후 server와 worker에서 error 또는 critical 로그가 발생하지 않았습니다.
6. 재사용 가능한 기존 Authentik 브라우저 세션과 스모크 전용 사용자가 없어 운영 계정의 비밀번호 제출은 수행하지 않았습니다. 세션 추출이나 임시 운영 계정 생성 없이 로그인 전환과 outpost 경계까지만 검증했습니다.

Authentik은 major release 순서를 지켜야 하고 server와 모든 outpost 버전이 일치해야 하며 downgrade를 지원하지 않습니다. 이후 업데이트도 중앙 인증 점검 없이 자동 적용하지 않습니다.

근거: [Authentik 2026.8.0 릴리스](https://github.com/goauthentik/authentik/releases/tag/version/2026.8.0), [2026.8 변경점](https://docs.goauthentik.io/releases/2026.8/), [Authentik 업그레이드 지침](https://docs.goauthentik.io/install-config/upgrade)
