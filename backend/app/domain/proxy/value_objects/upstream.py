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

    def __str__(self) -> str:
        return f"{self.host}:{self.port}"
