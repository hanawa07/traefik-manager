import ipaddress
import re
from dataclasses import dataclass

IPV4_BROADCAST = ipaddress.ip_address("255.255.255.255")
IPV4_RESERVED_NETWORK = ipaddress.ip_network("240.0.0.0/4")
IPV4_MULTICAST_NETWORK = ipaddress.ip_network("224.0.0.0/4")
IPV4_RFC1918_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
)
IPV4_TAILSCALE_NETWORK = ipaddress.ip_network("100.64.0.0/10")
IPV4_DOCUMENTATION_NETWORKS = (
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
)
IPV6_MULTICAST_NETWORK = ipaddress.ip_network("ff00::/8")
IPV6_UNIQUE_LOCAL_NETWORK = ipaddress.ip_network("fc00::/7")
IPV6_DOCUMENTATION_NETWORK = ipaddress.ip_network("2001:db8::/32")
DOMAIN_SUFFIX_PATTERN = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$"
)


def is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def validate_upstream_ip_address(host: str) -> None:
    addr = ipaddress.ip_address(host)
    if addr.is_unspecified:
        raise ValueError(f"미지정 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr.is_loopback:
        raise ValueError(f"루프백 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr.is_link_local:
        raise ValueError(f"링크-로컬 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr in IPV4_MULTICAST_NETWORK or addr in IPV6_MULTICAST_NETWORK:
        raise ValueError(f"멀티캐스트 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr == IPV4_BROADCAST:
        raise ValueError(f"브로드캐스트 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr.version == 4 and addr in IPV4_RESERVED_NETWORK:
        raise ValueError(f"예약된 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr.version == 4 and any(addr in network for network in IPV4_DOCUMENTATION_NETWORKS):
        raise ValueError(f"문서 예제 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr.version == 6 and addr in IPV6_DOCUMENTATION_NETWORK:
        raise ValueError(f"문서 예제 주소는 upstream으로 사용할 수 없습니다: {host}")
    if addr.version == 6 and addr in IPV6_UNIQUE_LOCAL_NETWORK:
        raise ValueError(f"고유 로컬 IPv6 주소는 upstream으로 사용할 수 없습니다: {host}")


def validate_upstream_host(host: str) -> None:
    if is_ip_literal(host):
        validate_upstream_ip_address(host)
        return

    if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$", host):
        raise ValueError(f"유효하지 않은 upstream 호스트: {host}")


def normalize_domain_suffix(value: str) -> str:
    normalized = value.strip().lower()
    while normalized.startswith("*."):
        normalized = normalized[2:]
    normalized = normalized.lstrip(".")
    normalized = normalized.rstrip(".")
    if not normalized or not DOMAIN_SUFFIX_PATTERN.match(normalized):
        raise ValueError(f"유효하지 않은 도메인 suffix입니다: {value}")
    return normalized


def normalize_domain_suffixes(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = normalize_domain_suffix(value)
        if item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


def matches_domain_suffix(host: str, suffixes: list[str]) -> bool:
    normalized_host = host.strip().lower().rstrip(".")
    return any(
        normalized_host == suffix or normalized_host.endswith(f".{suffix}")
        for suffix in suffixes
    )


def is_private_network_upstream_ip(host: str) -> bool:
    addr = ipaddress.ip_address(host)
    if addr.version != 4:
        return False
    return any(addr in network for network in IPV4_RFC1918_NETWORKS) or addr in IPV4_TAILSCALE_NETWORK


@dataclass(frozen=True)
class Upstream:
    host: str
    port: int

    def __post_init__(self):
        if not self.host:
            raise ValueError("업스트림 호스트는 필수입니다")
        if not (1 <= self.port <= 65535):
            raise ValueError(f"유효하지 않은 포트: {self.port}")
        self._validate_host(self.host)

    def _validate_host(self, host: str) -> None:
        validate_upstream_host(host)

    def __str__(self) -> str:
        return f"{self.host}:{self.port}"
