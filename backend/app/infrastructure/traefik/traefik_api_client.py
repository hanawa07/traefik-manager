import asyncio
import base64
import io
import json
import re
import tarfile
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import httpx

from app.core.config import settings

ACME_JSON_PATH = Path("/acme.json")
DOCKER_LOG_HEADER_LENGTH = 8
ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
DOMAIN_RE = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")


class TraefikApiClientError(Exception):
    """Traefik API 호출 실패 예외"""


class TraefikApiClient:
    """Traefik REST API 클라이언트"""

    def __init__(self):
        self.base_url = settings.TRAEFIK_API_URL.rstrip("/")
        self.timeout = settings.TRAEFIK_API_TIMEOUT_SECONDS

    async def get_health(self) -> dict:
        try:
            overview = await self._get("/api/overview")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik에 연결할 수 없습니다",
                "version": None,
            }

        version = overview.get("version") if isinstance(overview, dict) else None
        return {
            "connected": True,
            "message": "Traefik 연결됨",
            "version": version,
        }

    async def get_router_status(self) -> dict:
        try:
            payload = await self._get("/api/http/routers")
        except TraefikApiClientError:
            return {
                "connected": False,
                "message": "Traefik 라우터 정보를 가져오지 못했습니다",
                "domains": {},
            }

        routers = self._normalize_routers(payload)
        domain_states: dict[str, dict] = {}

        for router in routers:
            router_name = router.get("name") or router.get("service") or "unknown"
            status_raw = str(router.get("status", "enabled")).lower()
            active = status_raw not in ("disabled", "error", "unknown")
            rule = str(router.get("rule", ""))
            domains = self._extract_domains_from_router(router)

            for domain in domains:
                current = domain_states.setdefault(
                    domain,
                    {
                        "active": False,
                        "routers": [],
                    },
                )
                current["active"] = current["active"] or active
                current["routers"].append(
                    {
                        "name": router_name,
                        "status": status_raw,
                        "rule": rule,
                    }
                )

        return {
            "connected": True,
            "message": "Traefik 라우터 상태를 조회했습니다",
            "domains": domain_states,
        }

    async def _load_acme_expiry_map(self) -> dict[str, datetime]:
        """acme.json에서 도메인별 만료일 파싱 (file 라우터 fallback용)"""
        local_text = self._read_local_acme_json_text()
        if local_text:
            expiry_map = self._parse_acme_expiry_map(local_text)
            if expiry_map:
                return expiry_map

        docker_text = await self._read_docker_acme_json_text()
        if docker_text:
            expiry_map = self._parse_acme_expiry_map(docker_text)
            if expiry_map:
                return expiry_map

        return {}

    async def _load_recent_acme_failures(self) -> dict[str, dict]:
        log_text = await self._read_docker_container_logs_text()
        if not log_text:
            return {}
        return self._parse_recent_acme_failures(log_text)

    def _read_local_acme_json_text(self) -> str | None:
        if not ACME_JSON_PATH.exists():
            return None
        try:
            return ACME_JSON_PATH.read_text()
        except OSError:
            return None

    async def _read_docker_acme_json_text(self) -> str | None:
        socket_path = Path(settings.DOCKER_SOCKET_PATH)
        if not socket_path.exists():
            return None

        container_name = settings.TRAEFIK_DOCKER_CONTAINER_NAME.strip()
        acme_storage_path = settings.TRAEFIK_ACME_STORAGE_PATH.strip()
        if not container_name or not acme_storage_path:
            return None

        transport = httpx.AsyncHTTPTransport(uds=settings.DOCKER_SOCKET_PATH)
        path = f"/{settings.DOCKER_API_VERSION.strip('/')}/containers/{container_name}/archive"

        try:
            async with httpx.AsyncClient(
                base_url="http://docker",
                transport=transport,
                timeout=settings.DOCKER_API_TIMEOUT_SECONDS,
            ) as client:
                response = await client.get(path, params={"path": acme_storage_path})
                response.raise_for_status()
        except (httpx.HTTPError, OSError):
            return None

        try:
            with tarfile.open(fileobj=io.BytesIO(response.content)) as archive:
                for member in archive.getmembers():
                    if not member.isfile():
                        continue
                    extracted = archive.extractfile(member)
                    if extracted is None:
                        continue
                    return extracted.read().decode()
        except (tarfile.TarError, OSError, UnicodeDecodeError):
            return None

        return None

    async def _read_docker_container_logs_text(self) -> str | None:
        socket_path = Path(settings.DOCKER_SOCKET_PATH)
        if not socket_path.exists():
            return None

        container_name = settings.TRAEFIK_DOCKER_CONTAINER_NAME.strip()
        if not container_name:
            return None

        transport = httpx.AsyncHTTPTransport(uds=settings.DOCKER_SOCKET_PATH)
        path = f"/{settings.DOCKER_API_VERSION.strip('/')}/containers/{container_name}/logs"

        try:
            async with httpx.AsyncClient(
                base_url="http://docker",
                transport=transport,
                timeout=settings.DOCKER_API_TIMEOUT_SECONDS,
            ) as client:
                response = await client.get(
                    path,
                    params={
                        "stdout": 1,
                        "stderr": 1,
                        "tail": settings.TRAEFIK_LOG_TAIL_LINES,
                        "timestamps": 1,
                    },
                )
                response.raise_for_status()
        except (httpx.HTTPError, OSError):
            return None

        return self._decode_docker_log_stream(response.content)

    def _parse_acme_expiry_map(self, raw_text: str) -> dict[str, datetime]:
        expiry_map: dict[str, datetime] = {}
        try:
            data = json.loads(raw_text)
        except (TypeError, ValueError):
            return expiry_map

        if not isinstance(data, dict):
            return expiry_map

        for resolver_data in data.values():
            if not isinstance(resolver_data, dict):
                continue

            for cert_entry in resolver_data.get("Certificates", []):
                if not isinstance(cert_entry, dict):
                    continue

                cert_b64 = cert_entry.get("certificate", "")
                domain_info = cert_entry.get("domain", {})
                if not isinstance(domain_info, dict):
                    continue

                main = domain_info.get("main", "")
                sans = domain_info.get("sans") or []
                all_domains = [d for d in [main] + sans if isinstance(d, str) and d]
                if not cert_b64 or not all_domains:
                    continue

                expires_at = self._extract_acme_certificate_expiry(cert_b64)
                if expires_at is None:
                    continue

                for domain in all_domains:
                    existing = expiry_map.get(domain)
                    if existing is None or expires_at < existing:
                        expiry_map[domain] = expires_at

        return expiry_map

    def _parse_recent_acme_failures(self, raw_text: str) -> dict[str, dict]:
        failures: dict[str, dict] = {}
        for raw_line in raw_text.splitlines():
            line = ANSI_ESCAPE_RE.sub("", raw_line).strip()
            if not line or "Unable to obtain ACME certificate for domains" not in line:
                continue

            timestamp_raw, message = self._split_log_timestamp(line)
            occurred_at = self._parse_datetime(timestamp_raw) if timestamp_raw else None
            error_message = self._extract_acme_error_message(message)
            error_kind = self._classify_acme_error(error_message)
            domains = self._extract_acme_error_domains(message)

            for domain in domains:
                current = failures.get(domain)
                if current is not None and occurred_at and current.get("occurred_at"):
                    if current["occurred_at"] >= occurred_at:
                        continue

                failures[domain] = {
                    "occurred_at": occurred_at,
                    "message": error_message,
                    "kind": error_kind,
                }

        return failures

    def _extract_acme_certificate_expiry(self, cert_b64: str) -> datetime | None:
        try:
            import subprocess

            cert_der = base64.b64decode(cert_b64)
            result = subprocess.run(
                ["openssl", "x509", "-noout", "-enddate"],
                input=cert_der,
                capture_output=True,
                timeout=5,
                check=False,
            )
            output = result.stdout.decode().strip()
            if not output.startswith("notAfter="):
                return None

            expires_at = parsedate_to_datetime(output[len("notAfter="):])
            if expires_at is None:
                return None
            if expires_at.tzinfo is None:
                return expires_at.replace(tzinfo=timezone.utc)
            return expires_at.astimezone(timezone.utc)
        except Exception:
            return None

    def _decode_docker_log_stream(self, payload: bytes) -> str:
        if not payload:
            return ""

        if len(payload) >= DOCKER_LOG_HEADER_LENGTH and payload[1:4] == b"\x00\x00\x00":
            cursor = 0
            chunks: list[bytes] = []
            while cursor + DOCKER_LOG_HEADER_LENGTH <= len(payload):
                if payload[cursor + 1:cursor + 4] != b"\x00\x00\x00":
                    chunks.append(payload[cursor:])
                    break
                frame_size = int.from_bytes(payload[cursor + 4:cursor + 8], byteorder="big")
                cursor += DOCKER_LOG_HEADER_LENGTH
                chunks.append(payload[cursor:cursor + frame_size])
                cursor += frame_size
            return b"".join(chunks).decode(errors="ignore")

        return payload.decode(errors="ignore")

    def _split_log_timestamp(self, line: str) -> tuple[str | None, str]:
        if " " not in line:
            return None, line
        first, rest = line.split(" ", 1)
        if self._parse_datetime(first):
            return first, rest
        return None, line

    def _extract_acme_error_message(self, line: str) -> str:
        if "error=" not in line:
            return "최근 ACME 실패 원인을 확인하지 못했습니다"

        message = line.split("error=", 1)[1]
        if " ACME CA=" in message:
            message = message.split(" ACME CA=", 1)[0]

        message = message.strip().strip('"').replace("\\n", " ").strip()
        if "DNS problem:" in message:
            return message[message.index("DNS problem:"):].strip()
        if "rate limit" in message.lower():
            return message[message.lower().index("rate limit"):].strip()
        if "invalid authorization" in message.lower():
            return "invalid authorization"
        if "challenge" in message.lower():
            return message
        return message

    def _extract_acme_error_domains(self, line: str) -> list[str]:
        if "domains=" in line:
            domain_segment = line.split("domains=", 1)[1]
            if " providerName=" in domain_segment:
                domain_segment = domain_segment.split(" providerName=", 1)[0]
            domains = DOMAIN_RE.findall(domain_segment)
            if domains:
                return sorted(set(domains))

        return sorted(set(DOMAIN_RE.findall(line)))

    def _classify_acme_error(self, message: str) -> str:
        lowered = message.lower()
        if "dns problem" in lowered or "looking up a " in lowered or "looking up aaaa" in lowered or "looking up caa" in lowered:
            return "dns"
        if "rate limit" in lowered:
            return "rate_limit"
        if "authorization" in lowered or "unauthorized" in lowered:
            return "authorization"
        if "challenge" in lowered:
            return "challenge"
        return "unknown"

    async def list_certificates(self) -> list[dict]:
        overview, routers_payload = await asyncio.gather(
            self._get("/api/overview"),
            self._get("/api/http/routers"),
        )

        expiry_map = self._extract_expiry_map(overview)
        recent_acme_failures = await self._load_recent_acme_failures()
        # acme.json 직접 파싱으로 누락된 도메인 보완 (file 라우터 등)
        acme_map = await self._load_acme_expiry_map()
        for domain, expires_at in acme_map.items():
            if domain not in expiry_map:
                expiry_map[domain] = expires_at
        routers = self._normalize_routers(routers_payload)

        certificates_by_domain: dict[str, dict] = {}
        for router in routers:
            tls_info = router.get("tls")
            if not tls_info:
                continue

            domains = self._extract_domains_from_router(router)
            if not domains:
                continue

            resolver = None
            if isinstance(tls_info, dict):
                resolver = tls_info.get("certResolver")

            router_name = router.get("name") or router.get("service") or "unknown"
            for domain in domains:
                cert = certificates_by_domain.setdefault(
                    domain,
                    {
                        "domain": domain,
                        "router_names": set(),
                        "cert_resolvers": set(),
                        "expires_at": self._find_expiry(domain, expiry_map),
                        "last_acme_error_at": None,
                        "last_acme_error_message": None,
                        "last_acme_error_kind": None,
                    },
                )
                cert["router_names"].add(router_name)
                if resolver:
                    cert["cert_resolvers"].add(str(resolver))
                recent_failure = recent_acme_failures.get(domain)
                if recent_failure:
                    cert["last_acme_error_at"] = recent_failure.get("occurred_at")
                    cert["last_acme_error_message"] = recent_failure.get("message")
                    cert["last_acme_error_kind"] = recent_failure.get("kind")

        result = [self._to_certificate_response(cert) for cert in certificates_by_domain.values()]
        return sorted(result, key=lambda item: (item["days_remaining"] is None, item["days_remaining"] or 99999, item["domain"]))

    async def _get(self, path: str) -> dict | list:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.get(path)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise TraefikApiClientError(f"Traefik API 호출 실패: {path}") from exc

    def _normalize_routers(self, payload: dict | list) -> list[dict]:
        if isinstance(payload, list):
            return [router for router in payload if isinstance(router, dict)]

        if isinstance(payload, dict):
            if "routers" in payload and isinstance(payload["routers"], list):
                return [router for router in payload["routers"] if isinstance(router, dict)]

            if all(isinstance(value, dict) for value in payload.values()):
                normalized = []
                for name, value in payload.items():
                    router = value.copy()
                    router.setdefault("name", name)
                    normalized.append(router)
                return normalized

        return []

    def _extract_domains_from_router(self, router: dict) -> list[str]:
        domains: set[str] = set()

        rule = router.get("rule")
        if isinstance(rule, str):
            domains.update(self._extract_domains_from_rule(rule))

        tls = router.get("tls")
        if isinstance(tls, dict):
            tls_domains = tls.get("domains")
            if isinstance(tls_domains, list):
                for item in tls_domains:
                    if not isinstance(item, dict):
                        continue
                    main = item.get("main")
                    if isinstance(main, str) and main:
                        domains.add(main)
                    sans = item.get("sans")
                    if isinstance(sans, list):
                        for san in sans:
                            if isinstance(san, str) and san:
                                domains.add(san)

        return sorted(domains)

    def _extract_domains_from_rule(self, rule: str) -> list[str]:
        domains: set[str] = set()
        for match in re.findall(r"Host\(([^)]+)\)", rule):
            for token in match.split(","):
                value = token.strip().strip("`").strip('"').strip("'")
                if value:
                    domains.add(value)
        return list(domains)

    def _extract_expiry_map(self, payload: dict | list) -> dict[str, datetime]:
        expiry_map: dict[str, datetime] = {}

        def walk(node):
            if isinstance(node, dict):
                domain_candidates = self._extract_domain_candidates(node)
                expires_at = self._extract_expiry(node)
                if domain_candidates and expires_at:
                    for domain in domain_candidates:
                        existing = expiry_map.get(domain)
                        if existing is None or expires_at < existing:
                            expiry_map[domain] = expires_at
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(payload)
        return expiry_map

    def _extract_domain_candidates(self, node: dict) -> set[str]:
        domains: set[str] = set()

        single_domain = node.get("domain")
        if isinstance(single_domain, str) and single_domain:
            domains.add(single_domain)
        elif isinstance(single_domain, dict):
            main = single_domain.get("main")
            if isinstance(main, str) and main:
                domains.add(main)
            sans = single_domain.get("sans")
            if isinstance(sans, list):
                for san in sans:
                    if isinstance(san, str) and san:
                        domains.add(san)

        domain_list = node.get("domains")
        if isinstance(domain_list, list):
            for item in domain_list:
                if isinstance(item, str) and item:
                    domains.add(item)
                elif isinstance(item, dict):
                    main = item.get("main")
                    if isinstance(main, str) and main:
                        domains.add(main)
                    sans = item.get("sans")
                    if isinstance(sans, list):
                        for san in sans:
                            if isinstance(san, str) and san:
                                domains.add(san)

        return domains

    def _extract_expiry(self, node: dict) -> datetime | None:
        for key in ("notAfter", "not_after", "expiresAt", "expires_at", "expiration", "expirationDate", "expiryDate"):
            value = node.get(key)
            parsed = self._parse_datetime(value)
            if parsed:
                return parsed
        return None

    def _parse_datetime(self, value) -> datetime | None:
        if not isinstance(value, str) or not value.strip():
            return None

        raw = value.strip()
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            pass

        try:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except (TypeError, ValueError):
            return None

    def _find_expiry(self, domain: str, expiry_map: dict[str, datetime]) -> datetime | None:
        if domain in expiry_map:
            return expiry_map[domain]

        for cert_domain, expires_at in expiry_map.items():
            if cert_domain.startswith("*.") and domain.endswith(cert_domain[1:]):
                return expires_at
        return None

    def _to_certificate_response(self, cert: dict) -> dict:
        now = datetime.now(timezone.utc)
        expires_at = cert.get("expires_at")
        cert_resolvers = sorted(cert["cert_resolvers"])

        status = "warning"
        message = "만료일 정보를 확인할 수 없습니다"
        days_remaining = None

        if isinstance(expires_at, datetime):
            days_remaining = int((expires_at - now).total_seconds() // 86400)
            if expires_at < now:
                status = "error"
                message = "인증서가 만료되었습니다"
            elif days_remaining <= 30:
                status = "warning"
                message = f"{days_remaining}일 이내 만료 예정"
            else:
                status = "active"
                message = "정상"
        elif cert_resolvers:
            status = "pending"
            message = "정식 인증서 발급 대기 또는 검증 실패"
        else:
            status = "inactive"
            message = "자동 인증서 발급 미설정"

        return {
            "domain": cert["domain"],
            "router_names": sorted(cert["router_names"]),
            "cert_resolvers": cert_resolvers,
            "expires_at": expires_at,
            "days_remaining": days_remaining,
            "status": status,
            "status_message": message,
            "last_acme_error_at": cert.get("last_acme_error_at"),
            "last_acme_error_message": cert.get("last_acme_error_message"),
            "last_acme_error_kind": cert.get("last_acme_error_kind"),
        }
