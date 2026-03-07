import ipaddress
import re
from dataclasses import dataclass


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
            if addr.is_loopback:
                raise ValueError(f"루프백 주소는 upstream으로 사용할 수 없습니다: {host}")
            if addr.is_link_local:
                raise ValueError(f"링크-로컬 주소는 upstream으로 사용할 수 없습니다: {host}")
        except ValueError as e:
            if "upstream" in str(e):
                raise
            # IP가 아닌 도메인명 - 기본 형식 검증
            if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$', host):
                raise ValueError(f"유효하지 않은 upstream 호스트: {host}")

    def __str__(self) -> str:
        return f"{self.host}:{self.port}"
