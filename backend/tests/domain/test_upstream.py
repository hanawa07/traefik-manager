import pytest
from app.domain.proxy.value_objects.upstream import Upstream

def test_upstream_valid_ip():
    # Private IPs should be allowed
    upstream = Upstream(host="10.0.0.1", port=80)
    assert upstream.host == "10.0.0.1"
    assert upstream.port == 80
    
    upstream = Upstream(host="192.168.1.1", port=443)
    assert upstream.host == "192.168.1.1"

    upstream = Upstream(host="172.16.0.1", port=3000)
    assert upstream.host == "172.16.0.1"

def test_upstream_valid_domain():
    upstream = Upstream(host="example.com", port=80)
    assert upstream.host == "example.com"
    
    upstream = Upstream(host="my-service.local", port=8080)
    assert upstream.host == "my-service.local"

    upstream = Upstream(host="backend_api", port=8000)
    assert upstream.host == "backend_api"

def test_upstream_invalid_loopback():
    with pytest.raises(ValueError, match="루프백 주소는 upstream으로 사용할 수 없습니다: 127.0.0.1"):
        Upstream(host="127.0.0.1", port=80)
    
    with pytest.raises(ValueError, match="루프백 주소는 upstream으로 사용할 수 없습니다: ::1"):
        Upstream(host="::1", port=80)

def test_upstream_invalid_link_local():
    with pytest.raises(ValueError, match="링크-로컬 주소는 upstream으로 사용할 수 없습니다: 169.254.1.1"):
        Upstream(host="169.254.1.1", port=80)


def test_upstream_invalid_unspecified():
    with pytest.raises(ValueError, match="미지정 주소는 upstream으로 사용할 수 없습니다: 0.0.0.0"):
        Upstream(host="0.0.0.0", port=80)


def test_upstream_invalid_unique_local_ipv6():
    with pytest.raises(ValueError, match="고유 로컬 IPv6 주소는 upstream으로 사용할 수 없습니다: fc00::1"):
        Upstream(host="fc00::1", port=80)

def test_upstream_invalid_domain_format():
    with pytest.raises(ValueError, match="유효하지 않은 upstream 호스트: invalid@domain"):
        Upstream(host="invalid@domain", port=80)
    
    with pytest.raises(ValueError, match="유효하지 않은 upstream 호스트: domain space.com"):
        Upstream(host="domain space.com", port=80)

def test_upstream_invalid_port():
    with pytest.raises(ValueError, match="유효하지 않은 포트: 0"):
        Upstream(host="example.com", port=0)
    
    with pytest.raises(ValueError, match="유효하지 않은 포트: 65536"):
        Upstream(host="example.com", port=65536)

def test_upstream_empty_host():
    with pytest.raises(ValueError, match="업스트림 호스트는 필수입니다"):
        Upstream(host="", port=80)
