import pytest
from datetime import datetime, timedelta
from jose import jwt
from fastapi import HTTPException
from app.core.security import create_access_token, decode_token
from app.core.config import settings

def test_jwt_create_and_decode():
    data = {"sub": "admin"}
    token = create_access_token(data)
    decoded = decode_token(token)
    assert decoded["sub"] == "admin"
    assert "exp" in decoded

def test_jwt_decode_expired_token():
    data = {"sub": "admin", "exp": datetime.utcnow() - timedelta(minutes=1)}
    token = jwt.encode(data, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    with pytest.raises(HTTPException) as exc:
        decode_token(token)
    
    assert exc.value.status_code == 401
    assert exc.value.detail == "유효하지 않은 토큰입니다"

def test_jwt_decode_invalid_token():
    with pytest.raises(HTTPException) as exc:
        decode_token("invalid-token")
    
    assert exc.value.status_code == 401
    assert exc.value.detail == "유효하지 않은 토큰입니다"
