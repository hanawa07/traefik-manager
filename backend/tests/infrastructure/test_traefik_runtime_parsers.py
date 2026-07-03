from datetime import datetime, timezone

from app.infrastructure.traefik.acme_parsers import parse_recent_acme_failures
from app.infrastructure.traefik.docker_api import decode_docker_log_stream
from app.infrastructure.traefik.runtime_parsers import compare_versions


def test_compare_versions_handles_v_prefix_and_metadata():
    assert compare_versions("3.5.4", "v3.5.4") == 0
    assert compare_versions("v1.36.7-251-g8539794", "v1.36.7") == 0
    assert compare_versions("v3.5.3+build", "v3.5.4") == -1
    assert compare_versions("3.6.0", "v3.5.4") == 1
    assert compare_versions(None, "v3.5.4") is None


def test_decode_docker_log_stream_strips_multiplex_headers():
    first = b"2026-03-12T11:09:13Z first line\n"
    second = b"2026-03-12T11:10:13Z second line\n"
    payload = (
        b"\x01\x00\x00\x00"
        + len(first).to_bytes(4, byteorder="big")
        + first
        + b"\x01\x00\x00\x00"
        + len(second).to_bytes(4, byteorder="big")
        + second
    )

    decoded = decode_docker_log_stream(payload)

    assert "first line" in decoded
    assert "second line" in decoded
    assert "\x00" not in decoded


def test_parse_recent_acme_failures_extracts_domain_kind_and_message():
    raw_text = (
        '2026-03-12T11:09:13Z ERR Unable to obtain ACME certificate for domains '
        'error="unable to generate a certificate for the domains [traefik.lizstudio.co.kr]: '
        'error: one or more domains had a problem:\\n'
        '[traefik.lizstudio.co.kr] invalid authorization: acme: error: 400 :: '
        'urn:ietf:params:acme:error:dns :: While processing CAA for traefik.lizstudio.co.kr: '
        'DNS problem: query timed out looking up CAA for traefik.lizstudio.co.kr\\n" '
        'ACME CA=https://acme-v02.api.letsencrypt.org/directory '
        'domains=["traefik.lizstudio.co.kr"] providerName=letsencrypt.acme '
        'routerName=traefik-dashboard-public@file'
    )

    failures = parse_recent_acme_failures(raw_text)

    assert failures["traefik.lizstudio.co.kr"]["kind"] == "dns"
    assert failures["traefik.lizstudio.co.kr"]["message"] == (
        "DNS problem: query timed out looking up CAA for traefik.lizstudio.co.kr"
    )
    assert failures["traefik.lizstudio.co.kr"]["occurred_at"] == datetime(
        2026, 3, 12, 11, 9, 13, tzinfo=timezone.utc
    )
