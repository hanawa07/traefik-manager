import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";

export type MiddlewareTab = "templates" | "generated";
export type BadgeStatus = "active" | "inactive" | "warning" | "error" | "pending";

export type GeneratedMiddlewareItem = {
  label: string;
  runtimeName: string;
  description: string;
  scope?: "service" | "shared";
  status: BadgeStatus;
  runtimeStatusLabel: string;
};

function toSafeName(domain: string) {
  return domain.replaceAll(".", "-").replaceAll("_", "-");
}

export function mapRuntimeStatus(
  runtime: TraefikMiddlewareItem | undefined,
  {
    runtimeConnected,
    missingStatus = "warning",
  }: {
    runtimeConnected: boolean;
    missingStatus?: BadgeStatus;
  },
): BadgeStatus {
  if (!runtimeConnected) return "pending";
  if (!runtime) return missingStatus;

  const normalized = runtime.status.toLowerCase();
  if (normalized === "enabled") return "active";
  if (normalized === "disabled") return "inactive";
  if (normalized === "error") return "error";
  return "warning";
}

export function buildGeneratedMiddlewareItems(
  service: Service,
  runtimeMap: Map<string, TraefikMiddlewareItem>,
  runtimeConnected: boolean,
): GeneratedMiddlewareItem[] {
  const routerName = toSafeName(service.domain);
  const items: GeneratedMiddlewareItem[] = [];

  const register = (
    runtimeName: string,
    label: string,
    description: string,
    scope: "service" | "shared" = "service",
  ) => {
    const runtime = runtimeMap.get(runtimeName);
    items.push({
      label,
      runtimeName,
      description,
      scope,
      status: mapRuntimeStatus(runtime, { runtimeConnected }),
      runtimeStatusLabel: runtimeConnected ? runtime?.status || "runtime 미발견" : "Traefik 연결 확인 중",
    });
  };

  if (service.allowed_ips.length > 0) {
    register(
      `${routerName}-ipallowlist@file`,
      "허용 IP 미들웨어",
      `${service.allowed_ips.length}개 IP/CIDR 대역만 통과`,
    );
  }

  if (
    service.rate_limit_enabled &&
    service.rate_limit_average != null &&
    service.rate_limit_burst != null
  ) {
    register(
      `${routerName}-ratelimit@file`,
      "서비스 Rate Limit",
      `average ${service.rate_limit_average} / burst ${service.rate_limit_burst}`,
    );
  }

  if (Object.keys(service.custom_headers).length > 0) {
    register(
      `${routerName}-response-headers@file`,
      "응답 헤더 미들웨어",
      `${Object.keys(service.custom_headers).length}개 응답 헤더 주입`,
    );
  }

  if (service.frame_policy !== "off") {
    register(
      `${routerName}-frame-policy@file`,
      "프레임 정책",
      service.frame_policy === "sameorigin" ? "SAMEORIGIN 적용" : "DENY 적용",
    );
  }

  if (service.basic_auth_enabled) {
    register(
      `${routerName}-basicauth@file`,
      "서비스 Basic Auth",
      `${service.basic_auth_user_count}개 계정 인증`,
    );
  }

  if (service.blocked_paths.length > 0) {
    register(
      `${routerName}-block@file`,
      "차단 경로 보호",
      `${service.blocked_paths.length}개 경로 차단`,
    );
  }

  if (service.tls_enabled && service.https_redirect_enabled) {
    register(
      `${routerName}-redirectscheme@file`,
      "HTTP → HTTPS 리다이렉트",
      "HTTP 요청을 HTTPS로 강제 전환",
    );
  }

  if (service.auth_mode === "token") {
    register(
      `${routerName}-token-auth@file`,
      "백엔드 토큰 ForwardAuth",
      "서비스 전용 API Key 검증",
    );
  }

  if (service.auth_mode === "authentik") {
    register(
      "authentik@file",
      "Authentik ForwardAuth",
      "공용 Authentik 미들웨어를 이 서비스가 공유 사용",
      "shared",
    );
  }

  return items;
}

export function generatedSearchValue(value: string) {
  return value.trim().toLowerCase();
}
