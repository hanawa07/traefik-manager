import pytest

from app.application.proxy.middleware_template_use_cases import MiddlewareTemplateUseCases
from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service


class StubMiddlewareTemplateRepository:
    def __init__(self, templates: list[MiddlewareTemplate]):
        self.templates = {template.id: template for template in templates}

    async def save(self, template: MiddlewareTemplate) -> None:
        self.templates[template.id] = template

    async def find_by_id(self, template_id):
        return self.templates.get(template_id)

    async def find_all(self):
        return list(self.templates.values())

    async def find_many_by_ids(self, template_ids):
        return [self.templates[template_id] for template_id in template_ids if template_id in self.templates]

    async def delete(self, template_id):
        self.templates.pop(template_id, None)


class StubServiceRepository:
    def __init__(self, services: list[Service]):
        self.services = services

    async def save(self, service: Service) -> None:
        raise NotImplementedError

    async def find_by_id(self, service_id):
        raise NotImplementedError

    async def find_all(self):
        return self.services

    async def find_by_domain(self, domain: str):
        raise NotImplementedError

    async def delete(self, service_id):
        raise NotImplementedError


class StubFileWriter:
    def __init__(self):
        self.writes: list[dict] = []

    def write(self, service: Service, middleware_templates: list[MiddlewareTemplate] | None = None) -> None:
        self.writes.append(
            {
                "service_name": service.name,
                "middleware_names": [template.name for template in middleware_templates or []],
            }
        )


class StubUpdatePayload:
    def __init__(self, **payload):
        self.payload = payload

    def model_dump(self, exclude_unset=True):
        return self.payload


@pytest.mark.asyncio
async def test_update_template_rewrites_attached_services():
    ddos_template = MiddlewareTemplate.create(
        name="DDoS 방어",
        type="rateLimit",
        config={"average": 100, "burst": 200},
    )
    headers_template = MiddlewareTemplate.create(
        name="보안 헤더",
        type="headers",
        config={"customResponseHeaders": {"X-Test": "1"}},
    )

    english_service = Service.create(
        name="English",
        domain="english.example.com",
        upstream_host="english-app",
        upstream_port=3000,
        middleware_template_ids=[str(ddos_template.id), str(headers_template.id)],
    )
    blog_service = Service.create(
        name="Blog",
        domain="blog.example.com",
        upstream_host="blog-app",
        upstream_port=3001,
    )

    file_writer = StubFileWriter()
    use_cases = MiddlewareTemplateUseCases(
        repository=StubMiddlewareTemplateRepository([ddos_template, headers_template]),
        service_repository=StubServiceRepository([english_service, blog_service]),
        file_writer=file_writer,
    )

    updated = await use_cases.update_template(
        ddos_template.id,
        StubUpdatePayload(config={"average": 300, "burst": 500}),
    )

    assert updated is not None
    assert updated.config == {"average": 300, "burst": 500}
    assert file_writer.writes == [
        {
            "service_name": "English",
            "middleware_names": ["DDoS 방어", "보안 헤더"],
        }
    ]


@pytest.mark.asyncio
async def test_update_template_blocks_basicauth_for_auth_enabled_services():
    ddos_template = MiddlewareTemplate.create(
        name="DDoS 방어",
        type="rateLimit",
        config={"average": 100, "burst": 200},
    )
    token_service = Service.create(
        name="API",
        domain="api.example.com",
        upstream_host="api-app",
        upstream_port=8080,
        auth_mode="token",
        middleware_template_ids=[str(ddos_template.id)],
    )

    file_writer = StubFileWriter()
    use_cases = MiddlewareTemplateUseCases(
        repository=StubMiddlewareTemplateRepository([ddos_template]),
        service_repository=StubServiceRepository([token_service]),
        file_writer=file_writer,
    )

    with pytest.raises(ValueError, match="BasicAuth"):
        await use_cases.update_template(
            ddos_template.id,
            StubUpdatePayload(type="basicAuth", config={"users": ["admin:$apr1$hashed"]}),
        )

    assert file_writer.writes == []
