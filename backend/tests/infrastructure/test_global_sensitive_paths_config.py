import re
from pathlib import Path
from urllib.parse import urlsplit

import yaml


CONFIG_PATH = (
    Path(__file__).resolve().parents[3]
    / "traefik-config"
    / "dynamic"
    / "global-sensitive-paths.yml"
)


def load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def extract_path_regexp(rule: str) -> re.Pattern[str]:
    match = re.fullmatch(r"PathRegexp\(`(.+)`\)", rule)
    assert match is not None
    return re.compile(match.group(1))


def test_global_sensitive_path_routers_cover_http_and_https() -> None:
    config = load_config()
    routers = config["http"]["routers"]

    assert set(routers) == {
        "global-sensitive-paths-http",
        "global-sensitive-paths-https",
    }
    assert routers["global-sensitive-paths-http"]["entryPoints"] == ["web"]
    assert "tls" not in routers["global-sensitive-paths-http"]
    assert routers["global-sensitive-paths-https"]["entryPoints"] == ["websecure"]
    assert routers["global-sensitive-paths-https"]["tls"] == {}

    rules = {router["rule"] for router in routers.values()}
    assert len(rules) == 1
    for router in routers.values():
        assert router["priority"] == 10000
        assert router["service"] == "noop@internal"
        assert router["middlewares"] == ["global-sensitive-path-deny"]


def test_global_sensitive_path_rule_has_bounded_matches() -> None:
    config = load_config()
    rule = config["http"]["routers"]["global-sensitive-paths-http"]["rule"]
    pattern = extract_path_regexp(rule)
    blocked_paths = [
        "/.env",
        "/.env.local",
        "/app/.env",
        "/api/.env",
        "/.git/config",
        "/source/.git/config",
        "/.htaccess",
        "/vendor/phpunit/Util/PHP/eval-stdin.php",
        "/laravel/vendor/phpunit/x",
        "/yii/vendor/phpunit/x",
        "/zend/vendor/phpunit/x",
        "/lib/vendor/phpunit/x",
        "/phpinfo.php",
        "/INFO.PHP",
        "/wp-config.php",
        "/wp-config-sample.php",
        "/public/wp-config-docker.php",
        "/wp-config.php~",
        "/etc/passwd",
        "/proc/self/environ",
        "/id_rsa",
        "/home/id_ed25519",
        "/docker-compose.yml",
        "/docker-compose.yaml",
        "/docs/docker-compose.yml",
    ]
    allowed_paths = [
        "/",
        "/.well-known/acme-challenge/token",
        "/.environment",
        "/.gitignore",
        "/assets/.env-logo.svg",
        "/vendor/phpunit-guide",
        "/docs/wp-config-guide",
        "/readme.html",
        "/license.txt",
        "/test.php",
        "/test_file.txt",
        "/wp-login.php",
        "/xmlrpc.php",
        "/outpost.goauthentik.io/start",
        "/admin",
        "/api/health",
        "/api/webhook/example",
        "/api?file=/.env",
        "/search?q=/etc/passwd",
        "/info.php5",
    ]

    assert [
        path for path in blocked_paths if pattern.match(urlsplit(path).path) is None
    ] == []
    assert [
        path for path in allowed_paths if pattern.match(urlsplit(path).path) is not None
    ] == []


def test_global_sensitive_path_middleware_always_denies_clients() -> None:
    config = load_config()
    middleware = config["http"]["middlewares"]["global-sensitive-path-deny"]

    assert middleware == {
        "ipAllowList": {
            "sourceRange": ["255.255.255.255/32"],
        }
    }
