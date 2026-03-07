from dataclasses import dataclass
from datetime import datetime
from ipaddress import ip_network
import re
from typing import Literal
from uuid import UUID, uuid4


MiddlewareTemplateType = Literal["ipAllowList", "rateLimit", "basicAuth", "headers"]


@dataclass
class MiddlewareTemplate:
    """재사용 가능한 Traefik 미들웨어 템플릿 엔티티"""

    id: UUID
    name: str
    type: MiddlewareTemplateType
    config: dict
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        name: str,
        type: MiddlewareTemplateType,
        config: dict,
    ) -> "MiddlewareTemplate":
        now = datetime.utcnow()
        return cls(
            id=uuid4(),
            name=cls._normalize_name(name),
            type=type,
            config=cls._normalize_config(type, config),
            created_at=now,
            updated_at=now,
        )

    def update(
        self,
        name: str | None = None,
        type: MiddlewareTemplateType | None = None,
        config: dict | None = None,
    ) -> None:
        next_type = type if type is not None else self.type
        next_config = config if config is not None else self.config

        if name is not None:
            self.name = self._normalize_name(name)
        self.type = next_type
        self.config = self._normalize_config(next_type, next_config)
        self.updated_at = datetime.utcnow()

    @property
    def shared_name(self) -> str:
        # UUID 접두어로 YAML 미들웨어 이름을 안정적으로 생성한다.
        return f"shared-{str(self.id).replace('-', '')[:8]}"

    @staticmethod
    def _normalize_name(name: str) -> str:
        value = name.strip()
        if not value:
            raise ValueError("미들웨어 템플릿 이름은 필수입니다")
        return value

    @classmethod
    def _normalize_config(cls, type: MiddlewareTemplateType, config: dict | None) -> dict:
        raw = config or {}
        if not isinstance(raw, dict):
            raise ValueError("미들웨어 설정 형식이 올바르지 않습니다")

        if type == "ipAllowList":
            source_range = raw.get("sourceRange")
            if not isinstance(source_range, list) or not source_range:
                raise ValueError("ipAllowList 템플릿은 sourceRange 목록이 필요합니다")
            normalized: list[str] = []
            seen: set[str] = set()
            for item in source_range:
                cidr = str(ip_network(str(item).strip(), strict=False))
                if cidr not in seen:
                    seen.add(cidr)
                    normalized.append(cidr)
            return {"sourceRange": normalized}

        if type == "rateLimit":
            average = raw.get("average")
            burst = raw.get("burst")
            if not isinstance(average, int) or average <= 0:
                raise ValueError("rateLimit 템플릿의 average는 1 이상의 정수여야 합니다")
            if not isinstance(burst, int) or burst <= 0:
                raise ValueError("rateLimit 템플릿의 burst는 1 이상의 정수여야 합니다")
            return {"average": average, "burst": burst}

        if type == "basicAuth":
            users = raw.get("users")
            if not isinstance(users, list) or not users:
                raise ValueError("basicAuth 템플릿은 users 목록이 필요합니다")

            normalized_users: list[str] = []
            seen_users: set[str] = set()
            for item in users:
                value = str(item).strip()
                if not value or ":" not in value:
                    raise ValueError("basicAuth users 형식이 올바르지 않습니다")
                if "\n" in value or "\r" in value:
                    raise ValueError("basicAuth users 형식이 올바르지 않습니다")
                if value not in seen_users:
                    seen_users.add(value)
                    normalized_users.append(value)
            return {"users": normalized_users}

        if type == "headers":
            headers = raw.get("customResponseHeaders")
            if not isinstance(headers, dict) or not headers:
                raise ValueError("headers 템플릿은 customResponseHeaders가 필요합니다")

            token_pattern = re.compile(r"^[A-Za-z0-9-]+$")
            normalized_headers: dict[str, str] = {}
            for raw_key, raw_value in headers.items():
                key = str(raw_key).strip()
                value = str(raw_value).strip()
                if not key:
                    continue
                if not token_pattern.match(key):
                    raise ValueError(f"유효하지 않은 헤더 키입니다: {key}")
                if "\n" in key or "\r" in key or "\n" in value or "\r" in value:
                    raise ValueError(f"유효하지 않은 헤더 값입니다: {key}")
                normalized_headers[key] = value
            if not normalized_headers:
                raise ValueError("headers 템플릿은 최소 1개 이상의 헤더가 필요합니다")
            return {"customResponseHeaders": normalized_headers}

        raise ValueError("지원하지 않는 미들웨어 템플릿 타입입니다")
