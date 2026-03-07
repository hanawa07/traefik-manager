from dataclasses import dataclass
from datetime import datetime
import re
from urllib.parse import urlparse
from uuid import UUID, uuid4

from ..value_objects.domain_name import DomainName


@dataclass
class RedirectHost:
    """도메인 리다이렉트 엔티티"""

    id: UUID
    domain: DomainName
    target_url: str
    permanent: bool
    tls_enabled: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        domain: str,
        target_url: str,
        permanent: bool = True,
        tls_enabled: bool = True,
    ) -> "RedirectHost":
        now = datetime.utcnow()
        return cls(
            id=uuid4(),
            domain=DomainName(domain),
            target_url=cls._normalize_target_url(target_url),
            permanent=permanent,
            tls_enabled=tls_enabled,
            created_at=now,
            updated_at=now,
        )

    def update(
        self,
        domain: str | None = None,
        target_url: str | None = None,
        permanent: bool | None = None,
        tls_enabled: bool | None = None,
    ) -> None:
        if domain is not None:
            self.domain = DomainName(domain)
        if target_url is not None:
            self.target_url = self._normalize_target_url(target_url)
        if permanent is not None:
            self.permanent = permanent
        if tls_enabled is not None:
            self.tls_enabled = tls_enabled
        self.updated_at = datetime.utcnow()

    @staticmethod
    def _normalize_target_url(target_url: str) -> str:
        value = target_url.strip()
        if not value:
            raise ValueError("리다이렉트 대상 URL은 필수입니다")
        if any(char.isspace() for char in value):
            raise ValueError("리다이렉트 대상 URL에는 공백을 포함할 수 없습니다")

        parsed = urlparse(value)
        if parsed.scheme in ("http", "https"):
            return value
        if parsed.scheme:
            raise ValueError("리다이렉트 대상 URL은 http 또는 https만 지원합니다")

        # 도메인/경로만 입력한 경우 기본적으로 HTTPS 타겟으로 변환
        if re.match(r"^[A-Za-z0-9.-]+(:\d+)?(/.*)?$", value):
            return f"https://{value}"

        raise ValueError("유효하지 않은 리다이렉트 대상 URL입니다")
