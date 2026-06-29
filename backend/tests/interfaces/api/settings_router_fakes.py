class StubSettingsRepository:
    def __init__(self, _session):
        self.store = StubSettingsRepository.store

    store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def get_all_dict(self) -> dict[str, str]:
        return dict(self.store)

    async def set(self, key: str, value: str | None) -> None:
        if value is None:
            self.store.pop(key, None)
        else:
            self.store[key] = value

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)


class RecordingDashboardFileWriter:
    def __init__(self):
        self.write_calls = []
        self.deleted = False

    def write_traefik_dashboard_public_route(self, domain, basic_auth_username, basic_auth_password_hash):
        self.write_calls.append((domain, basic_auth_username, basic_auth_password_hash))

    def delete_traefik_dashboard_public_route(self):
        self.deleted = True


class StubDomainRepository:
    domain_result = None

    def __init__(self, _session):
        pass

    async def find_by_domain(self, _domain: str):
        return self.domain_result


class StubNoConflictRepository:
    def __init__(self, _session):
        pass

    async def find_by_domain(self, _domain: str):
        return None
