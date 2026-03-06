import re
from dataclasses import dataclass


@dataclass(frozen=True)
class DomainName:
    value: str

    def __post_init__(self):
        pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
        if not re.match(pattern, self.value):
            raise ValueError(f"유효하지 않은 도메인: {self.value}")

    def __str__(self) -> str:
        return self.value
