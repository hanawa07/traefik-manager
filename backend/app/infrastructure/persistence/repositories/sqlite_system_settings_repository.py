from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import SystemSettingModel


class SQLiteSystemSettingsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, key: str) -> str | None:
        stmt = select(SystemSettingModel.value).where(SystemSettingModel.key == key)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def set(self, key: str, value: str | None) -> None:
        stmt = select(SystemSettingModel).where(SystemSettingModel.key == key)
        result = await self.session.execute(stmt)
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            self.session.add(SystemSettingModel(key=key, value=value))

    async def delete(self, key: str) -> None:
        stmt = delete(SystemSettingModel).where(SystemSettingModel.key == key)
        await self.session.execute(stmt)

    async def get_all_dict(self) -> dict[str, str]:
        stmt = select(SystemSettingModel.key, SystemSettingModel.value)
        result = await self.session.execute(stmt)
        return {row.key: row.value for row in result.all() if row.value is not None}
