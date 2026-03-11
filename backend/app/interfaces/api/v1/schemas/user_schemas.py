from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


UserRole = Literal["admin", "viewer"]


class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole
    is_active: bool = True

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("사용자 이름을 입력하세요")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value:
            raise ValueError("비밀번호를 입력하세요")
        if "\n" in value or "\r" in value:
            raise ValueError("유효하지 않은 비밀번호 형식입니다")
        return value


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("사용자 이름을 입력하세요")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value:
            raise ValueError("비밀번호를 입력하세요")
        if "\n" in value or "\r" in value:
            raise ValueError("유효하지 않은 비밀번호 형식입니다")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

class UserListResponse(BaseModel):
    users: list[UserResponse] = Field(default_factory=list)
