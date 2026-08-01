import re


def build_container_candidate(container: dict) -> dict:
    labels = container.get("Labels") or {}
    if not isinstance(labels, dict):
        labels = {}

    return {
        "id": container.get("Id"),
        "name": _get_container_name(container),
        "image": container.get("Image"),
        "state": container.get("State"),
        "status": container.get("Status"),
        "compose_project": _optional_label(labels, "com.docker.compose.project"),
        "compose_service": _optional_label(labels, "com.docker.compose.service"),
        "ports": _extract_ports(container),
        "networks": extract_networks(container),
        "traefik_candidates": _extract_traefik_candidates(container, labels),
    }


def _optional_label(labels: dict, key: str) -> str | None:
    value = labels.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def extract_networks(container: dict) -> list[str]:
    network_settings = container.get("NetworkSettings") or {}
    if not isinstance(network_settings, dict):
        return []

    networks = network_settings.get("Networks") or {}
    if not isinstance(networks, dict):
        return []

    return sorted(name for name in networks if isinstance(name, str) and name.strip())


def _extract_traefik_candidates(container: dict, labels: dict) -> list[dict]:
    router_rule_map: dict[str, str] = {}
    for key, value in labels.items():
        if not isinstance(key, str) or not isinstance(value, str):
            continue
        match = re.match(r"^traefik\.http\.routers\.([^.]+)\.rule$", key)
        if match:
            router_rule_map[match.group(1)] = value

    candidates: list[dict] = []
    for router_name, rule in sorted(router_rule_map.items()):
        domains = _extract_domains(rule)
        if not domains:
            continue

        entry_points = str(labels.get(f"traefik.http.routers.{router_name}.entrypoints", ""))
        service_label_name = labels.get(f"traefik.http.routers.{router_name}.service", router_name)
        port_value = labels.get(
            f"traefik.http.services.{service_label_name}.loadbalancer.server.port"
        ) or labels.get(f"traefik.http.services.{router_name}.loadbalancer.server.port")
        upstream_port = _parse_port(port_value) or _detect_private_port(container) or 80
        upstream_host = _get_container_name(container)

        for domain in domains:
            candidates.append(
                {
                    "router_name": router_name,
                    "domain": domain,
                    "upstream_host": upstream_host,
                    "upstream_port": upstream_port,
                    "tls_enabled": "websecure" in entry_points.lower(),
                }
            )

    return candidates


def _extract_ports(container: dict) -> list[dict]:
    ports = container.get("Ports") or []
    if not isinstance(ports, list):
        return []

    extracted: list[dict] = []
    seen: set[tuple[int, int | None, str | None]] = set()
    for item in ports:
        if not isinstance(item, dict):
            continue

        private_port = item.get("PrivatePort")
        if not isinstance(private_port, int):
            continue

        public_port = item.get("PublicPort")
        if not isinstance(public_port, int):
            public_port = None
        port_type = item.get("Type")
        if not isinstance(port_type, str):
            port_type = None

        key = (private_port, public_port, port_type)
        if key in seen:
            continue
        seen.add(key)
        extracted.append(
            {
                "private_port": private_port,
                "public_port": public_port,
                "type": port_type,
            }
        )

    return sorted(
        extracted,
        key=lambda item: (
            item["private_port"],
            item["public_port"] if item["public_port"] is not None else -1,
            item["type"] or "",
        ),
    )


def _extract_domains(rule: str) -> list[str]:
    domains: set[str] = set()
    for match in re.findall(r"Host\(([^)]+)\)", rule):
        for token in match.split(","):
            value = token.strip().strip("`").strip('"').strip("'")
            if value:
                domains.add(value)
    return sorted(domains)


def _parse_port(value) -> int | None:
    try:
        port = int(str(value))
        return port if 1 <= port <= 65535 else None
    except (TypeError, ValueError):
        return None


def _detect_private_port(container: dict) -> int | None:
    ports = container.get("Ports") or []
    if not isinstance(ports, list):
        return None
    for item in ports:
        if isinstance(item, dict) and isinstance(item.get("PrivatePort"), int):
            return item["PrivatePort"]
    return None


def _get_container_name(container: dict) -> str:
    names = container.get("Names") or []
    if isinstance(names, list) and names:
        first = str(names[0]).strip()
        return first[1:] if first.startswith("/") else first
    return str(container.get("Id", ""))[:12]
