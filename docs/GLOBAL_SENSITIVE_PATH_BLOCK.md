# Traefik 공통 민감 경로 차단

## 목적

`traefik-config/dynamic/global-sensitive-paths.yml`은 공개 라우터의 고신뢰 민감 경로 요청을 Authentik과 업스트림보다 먼저 거부한다. HTTP와 HTTPS에 각각 우선순위 `10000` 라우터를 두며, 기존 서비스별 라우터와 설정은 변경하지 않는다.

거부 미들웨어는 서비스별 차단 경로와 같은 `ipAllowList` 방식을 사용한다. 허용될 수 없는 `255.255.255.255/32`만 source range로 지정하므로 일치 요청은 `403`이 된다. 요청은 Traefik access log에 남아 기존 `traefik-web-probe` Jail의 반복 탐색 차단도 계속 동작한다.

## 차단 범위

- 경로 어느 위치에서든 파일명 경계가 일치하는 `.env` 변형
- 경로 어느 위치에서든 디렉터리 경계가 일치하는 `.git`, `.htaccess`
- 알려진 `vendor/phpunit` 실행 경로
- `phpinfo.php`, `info.php`, `wp-config*.php`
- `/etc/passwd`, `/proc/self/environ`
- 대표 SSH 개인키 파일명
- `docker-compose.yml`, `docker-compose.yaml`
- SQL 덤프 파일과 압축 변형(`*.sql`, `*.sql.gz`, `*.sql.zip`, `*.sql.bak`)

`readme.html`, `license.txt`, 테스트 파일, WordPress 로그인·XML-RPC, ACME challenge, Authentik outpost, 일반 관리자·API 경로는 공통 차단하지 않는다. `.env-logo.svg`, `.gitignore`, `wp-config-guide`처럼 민감 이름을 일부 포함하는 정상 파일과 쿼리 문자열도 제외한다. 정규식은 비슷한 정상 경로까지 잡는 `PathPrefix` 대신 파일명과 디렉터리 경계를 명시한다.

2026-08-23 점검에서 최근 7일간 SQL 덤프 경로 요청 510건은 모두 Hanastay를 겨냥한 단일 출발지 스캔이었고 정상 응답은 없었다. HTTPS 요청 459건은 WordPress까지 전달된 뒤 거부됐으므로 같은 경로를 공통 라우터에서 먼저 차단하도록 범위를 확장했다.

## 24시간 운영 관측

2026-08-04 12:41:53부터 2026-08-05 12:41:53 KST까지 `CONTAINER_NAME=traefik` journal을 정확한 시각 범위로 읽고 원문·IP·Host를 출력하지 않은 채 집계했다. 이 구간에는 access 요청 52,581건과 access 형식이 아닌 Traefik 상태 로그 48건이 있었으며, 검증 요청도 포함되므로 아래 적중 수 전체를 자연 공격 수로 해석하지 않는다.

- 공통 차단 라우터 적중 1,691건: HTTPS 1,468건, HTTP 223건, 고유 출발지 82개
- 응답: `403` 1,682건, `400` 9건. 모든 요청의 업스트림 서버 URL 기록은 0건
- 같은 민감 경로 규칙에 해당한 전체 1,707건 중 나머지 16건은 Host와 맞는 라우터가 없는 `404`였고 업스트림 전달도 0건
- 공통 라우터가 규칙 경계 밖 요청을 받은 건수와 민감 경로가 다른 라우터를 통해 업스트림으로 전달된 건수는 각각 0건
- 관측된 허용 경계 표본 27건(`.env-*` 2건, `.gitignore` 1건, `wp-config-guide` 1건, 쿼리 문자열 1건, ACME challenge 22건)은 공통 라우터 적중 0건
- 관측 종료 시점에 두 공통 라우터와 거부 미들웨어는 모두 `enabled`였고 Traefik API 오류는 0건

따라서 관측 및 회귀 범위에서 정상·유사 경로 오탐과 업스트림 우회는 없었다. 현재 경로 집합과 우선순위를 유지하며, 새 노출 경로가 확인될 때만 범위를 좁게 확장한다.

## 검증과 롤백

```bash
cd backend
PYTHONPATH=. .venv/bin/python -m pytest -q \
  tests/infrastructure/test_global_sensitive_paths_config.py

docker exec traefik wget -qO- http://127.0.0.1:8080/api/http/routers
docker exec traefik wget -qO- http://127.0.0.1:8080/api/rawdata
```

적용 후 두 공통 라우터와 거부 미들웨어가 `enabled`인지, API 오류가 없는지, 대표 민감 경로는 `403`이고 정상 경로의 기존 응답은 유지되는지 확인한다. 문제가 있으면 공통 정책 파일 하나만 제거해 file provider가 이전 라우팅으로 즉시 복귀하게 하고 같은 항목을 다시 확인한다.
