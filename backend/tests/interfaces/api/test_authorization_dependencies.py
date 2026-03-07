import unittest

from fastapi import HTTPException

from app.interfaces.api.dependencies import require_admin, require_write_access


class AuthorizationDependenciesTest(unittest.IsolatedAsyncioTestCase):
    async def test_require_write_access_allows_admin(self):
        user = {"username": "admin", "role": "admin"}

        resolved = await require_write_access(user)

        self.assertEqual(resolved["role"], "admin")

    async def test_require_write_access_blocks_viewer(self):
        user = {"username": "viewer", "role": "viewer"}

        with self.assertRaises(HTTPException) as exc:
            await require_write_access(user)

        self.assertEqual(exc.exception.status_code, 403)

    async def test_require_admin_blocks_viewer(self):
        user = {"username": "viewer", "role": "viewer"}

        with self.assertRaises(HTTPException) as exc:
            await require_admin(user)

        self.assertEqual(exc.exception.status_code, 403)
