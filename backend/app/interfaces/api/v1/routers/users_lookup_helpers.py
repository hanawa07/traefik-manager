from uuid import UUID

from app.application.auth.user_use_cases import UserUseCases


async def get_user_for_update(use_cases: UserUseCases, user_id: UUID):
    get_user = getattr(use_cases, "get_user", None)
    if callable(get_user):
        return await get_user(user_id)
    return await use_cases.repository.find_by_id(user_id)
