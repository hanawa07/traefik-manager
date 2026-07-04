from app.domain.proxy.entities.middleware_template import MiddlewareTemplate


def build_shared_middleware_templates_config(templates: list[MiddlewareTemplate]) -> dict:
    middlewares = {
        template.shared_name: {
            template.type: template.config,
        }
        for template in sorted(templates, key=lambda item: item.shared_name)
    }
    return {"http": {"middlewares": middlewares}}
