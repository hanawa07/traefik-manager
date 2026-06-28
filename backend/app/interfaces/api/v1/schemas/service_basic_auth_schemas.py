from pydantic import BaseModel, field_validator


class BasicAuthCredential(BaseModel):
    username: str
    password: str = ""

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Basic Auth 사용자 이름을 입력하세요")
        if ":" in value:
            raise ValueError("Basic Auth 사용자 이름에는 ':' 문자를 사용할 수 없습니다")
        if "\n" in value or "\r" in value:
            raise ValueError("유효하지 않은 Basic Auth 사용자 이름입니다")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if value and ("\n" in value or "\r" in value):
            raise ValueError("유효하지 않은 Basic Auth 비밀번호입니다")
        return value
