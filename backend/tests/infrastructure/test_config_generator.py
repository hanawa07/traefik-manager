import pytest
from app.infrastructure.traefik.config_generator import TraefikConfigGenerator

@pytest.fixture
def generator():
    return TraefikConfigGenerator()

def test_generate_basic_service(generator, make_service):
    service = make_service(name="test", domain="example.com", tls_enabled=False, https_redirect_enabled=False)
    config = generator.generate(service)

    router_name = "example-com"
    assert "http" in config
    assert router_name in config["http"]["routers"]
    assert config["http"]["routers"][router_name]["rule"] == "Host(`example.com`)"
    assert config["http"]["routers"][router_name]["service"] == router_name
    assert config["http"]["routers"][router_name]["entryPoints"] == ["web"]
    assert config["http"]["services"][router_name]["loadBalancer"]["servers"][0]["url"] == "http://10.0.0.1:8080"

def test_generate_tls_enabled(generator, make_service):
    service = make_service(domain="secure.com", tls_enabled=True, https_redirect_enabled=False)
    config = generator.generate(service)

    router_name = "secure-com"
    router = config["http"]["routers"][router_name]
    assert router["entryPoints"] == ["websecure"]
    assert "tls" in router

def test_generate_https_redirect(generator, make_service):
    service = make_service(domain="redirect.com", tls_enabled=True, https_redirect_enabled=True)
    config = generator.generate(service)

    router_name = "redirect-com"
    redirect_router_name = f"{router_name}-redirect"
    assert redirect_router_name in config["http"]["routers"]
    
    redirect_router = config["http"]["routers"][redirect_router_name]
    assert redirect_router["entryPoints"] == ["web"]
    
    middleware_name = f"{router_name}-redirectscheme"
    assert middleware_name in redirect_router["middlewares"]
    assert config["http"]["middlewares"][middleware_name]["redirectScheme"]["scheme"] == "https"

def test_generate_ip_allowlist(generator, make_service):
    service = make_service(domain="ip.com", allowed_ips=["192.168.1.0/24"])
    config = generator.generate(service)

    router_name = "ip-com"
    middleware_name = f"{router_name}-ipallowlist"
    assert middleware_name in config["http"]["routers"][router_name]["middlewares"]
    assert config["http"]["middlewares"][middleware_name]["ipAllowList"]["sourceRange"] == ["192.168.1.0/24"]

def test_generate_rate_limit(generator, make_service):
    service = make_service(domain="rate.com", rate_limit_average=100, rate_limit_burst=50)
    config = generator.generate(service)

    router_name = "rate-com"
    middleware_name = f"{router_name}-ratelimit"
    assert middleware_name in config["http"]["routers"][router_name]["middlewares"]
    assert config["http"]["middlewares"][middleware_name]["rateLimit"]["average"] == 100
    assert config["http"]["middlewares"][middleware_name]["rateLimit"]["burst"] == 50

def test_generate_auth_enabled(generator, make_service):
    service = make_service(domain="auth.com", auth_enabled=True)
    config = generator.generate(service)

    router_name = "auth-com"
    assert "authentik@file" in config["http"]["routers"][router_name]["middlewares"]

def test_generate_token_auth(generator, make_service):
    service = make_service(domain="token.com", auth_mode="token")
    config = generator.generate(service)

    router_name = "token-com"
    middleware_name = f"{router_name}-token-auth"
    assert middleware_name in config["http"]["routers"][router_name]["middlewares"]
    
    assert "forwardAuth" in config["http"]["middlewares"][middleware_name]
    forward_auth = config["http"]["middlewares"][middleware_name]["forwardAuth"]
    assert "backend:8000/api/v1/auth/verify" in forward_auth["address"]
    assert forward_auth["trustForwardHeader"] is True
    assert "X-Auth-User" in forward_auth["authResponseHeaders"]
