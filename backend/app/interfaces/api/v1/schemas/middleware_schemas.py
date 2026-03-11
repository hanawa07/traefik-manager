from datetime import datetime
from ipaddress import ip_network
import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MiddlewareTemplateType = Literal["ipAllowList", "rateLimit", "basicAuth", "headers"]


class MiddlewareTemplateCreate(BaseModel):
    name: str
    type: MiddlewareTemplateType
    config: dict = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("미들웨어 템플릿 이름을 입력하세요")
        return normalized

    @model_validator(mode="after")
    def validate_config(self):
        _validate_template_config(self.type, self.config)
        return self


class MiddlewareTemplateUpdate(BaseModel):
    name: str | None = None
    type: MiddlewareTemplateType | None = None
    config: dict | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("미들웨어 템플릿 이름을 입력하세요")
        return normalized

    @model_validator(mode="after")
    def validate_config(self):
        if self.type is not None and self.config is not None:
            _validate_template_config(self.type, self.config)
        return self


class MiddlewareTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    type: MiddlewareTemplateType
    config: dict
    shared_name: str
    created_at: datetime
    updated_at: datetime

def _validate_template_config(template_type: MiddlewareTemplateType, config: dict) -> None:
    if not isinstance(config, dict):
        raise ValueError("미들웨어 설정 형식이 올바르지 않습니다")

    if template_type == "ipAllowList":
        source_range = config.get("sourceRange")
        if not isinstance(source_range, list) or not source_range:
            raise ValueError("ipAllowList 템플릿은 sourceRange 목록이 필요합니다")
        for item in source_range:
            ip_network(str(item).strip(), strict=False)
        return

    if template_type == "rateLimit":
        average = config.get("average")
        burst = config.get("burst")
        if not isinstance(average, int) or average <= 0:
            raise ValueError("rateLimit 템플릿의 average는 1 이상의 정수여야 합니다")
        if not isinstance(burst, int) or burst <= 0:
            raise ValueError("rateLimit 템플릿의 burst는 1 이상의 정수여야 합니다")
        return

    if template_type == "basicAuth":
        users = config.get("users")
        if not isinstance(users, list) or not users:
            raise ValueError("basicAuth 템플릿은 users 목록이 필요합니다")
        for item in users:
            value = str(item).strip()
            if ":" not in value:
                raise ValueError("basicAuth users 형식이 올바르지 않습니다")
            if "\n" in value or "\r" in value:
                raise ValueError("basicAuth users 형식이 올바르지 않습니다")
        return

    if template_type == "headers":
        headers = config.get("customResponseHeaders")
        if not isinstance(headers, dict) or not headers:
            raise ValueError("headers 템플릿은 customResponseHeaders가 필요합니다")
        token_pattern = re.compile(r"^[A-Za-z0-9-]+$")
        for raw_key, raw_value in headers.items():
            key = str(raw_key).strip()
            value = str(raw_value).strip()
            if not key:
                raise ValueError("headers 템플릿 헤더 키가 비어 있습니다")
            if not token_pattern.match(key):
                raise ValueError(f"유효하지 않은 헤더 키입니다: {key}")
            if "\n" in key or "\r" in key or "\n" in value or "\r" in value:
                raise ValueError(f"유효하지 않은 헤더 값입니다: {key}")
        return
