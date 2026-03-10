import ipaddress
import re
from dataclasses import dataclass

IPV4_BROADCAST = ipaddress.ip_address("255.255.255.255")
IPV4_RESERVED_NETWORK = ipaddress.ip_network("240.0.0.0/4")
IPV4_MULTICAST_NETWORK = ipaddress.ip_network("224.0.0.0/4")
IPV4_DOCUMENTATION_NETWORKS = (
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
)
IPV6_MULTICAST_NETWORK = ipaddress.ip_network("ff00::/8")
IPV6_UNIQUE_LOCAL_NETWORK = ipaddress.ip_network("fc00::/7")
IPV6_DOCUMENTATION_NETWORK = ipaddress.ip_network("2001:db8::/32")


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
        try:
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
        except ValueError as e:
            if "upstream" in str(e):
                raise
            # IP가 아닌 도메인명 - 기본 형식 검증
            if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$', host):
                raise ValueError(f"유효하지 않은 upstream 호스트: {host}")

    def __str__(self) -> str:
        return f"{self.host}:{self.port}"
