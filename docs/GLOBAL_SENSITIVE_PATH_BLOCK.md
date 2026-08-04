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

`readme.html`, `license.txt`, 테스트 파일, WordPress 로그인·XML-RPC, ACME challenge, Authentik outpost, 일반 관리자·API 경로는 공통 차단하지 않는다. `.env-logo.svg`, `.gitignore`, `wp-config-guide`처럼 민감 이름을 일부 포함하는 정상 파일과 쿼리 문자열도 제외한다. 정규식은 비슷한 정상 경로까지 잡는 `PathPrefix` 대신 파일명과 디렉터리 경계를 명시한다.

## 검증과 롤백

```bash
cd backend
PYTHONPATH=. .venv/bin/python -m pytest -q \
  tests/infrastructure/test_global_sensitive_paths_config.py

docker exec traefik wget -qO- http://127.0.0.1:8080/api/http/routers
docker exec traefik wget -qO- http://127.0.0.1:8080/api/rawdata
```

적용 후 두 공통 라우터와 거부 미들웨어가 `enabled`인지, API 오류가 없는지, 대표 민감 경로는 `403`이고 정상 경로의 기존 응답은 유지되는지 확인한다. 문제가 있으면 공통 정책 파일 하나만 제거해 file provider가 이전 라우팅으로 즉시 복귀하게 하고 같은 항목을 다시 확인한다.
