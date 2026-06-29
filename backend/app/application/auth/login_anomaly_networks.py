from ipaddress import ip_address, ip_network


def is_trusted_client_ip(client_ip: str, trusted_networks: list[str] | None) -> bool:
    if not trusted_networks:
        return False
    try:
        address = ip_address(client_ip)
    except ValueError:
        return False

    for trusted_network in trusted_networks:
        try:
            if address in ip_network(trusted_network, strict=False):
                return True
        except ValueError:
            continue
    return False
