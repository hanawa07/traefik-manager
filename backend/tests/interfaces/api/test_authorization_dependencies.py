import pytest
from fastapi import HTTPException

from app.interfaces.api.dependencies import require_admin, require_write_access

@pytest.mark.asyncio
async def test_require_write_access_allows_admin():
    user = {"username": "admin", "role": "admin"}

    resolved = await require_write_access(user)

    assert resolved["role"] == "admin"

@pytest.mark.asyncio
async def test_require_write_access_blocks_viewer():
    user = {"username": "viewer", "role": "viewer"}

    with pytest.raises(HTTPException) as exc:
        await require_write_access(user)

    assert exc.value.status_code == 403

@pytest.mark.asyncio
async def test_require_admin_blocks_viewer():
    user = {"username": "viewer", "role": "viewer"}

    with pytest.raises(HTTPException) as exc:
        await require_admin(user)

    assert exc.value.status_code == 403