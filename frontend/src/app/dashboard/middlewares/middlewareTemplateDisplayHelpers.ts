import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";

export function getTemplateTypeLabel(type: MiddlewareTemplate["type"]) {
  switch (type) {
    case "ipAllowList":
      return "허용 IP";
    case "rateLimit":
      return "Rate Limit";
    case "basicAuth":
      return "Basic Auth";
    case "headers":
      return "응답 헤더";
    default:
      return type;
  }
}

export function getTemplateConfigSummary(template: MiddlewareTemplate) {
  if (template.type === "ipAllowList") {
    const ranges = Array.isArray(template.config.sourceRange) ? template.config.sourceRange : [];
    return `${ranges.length}개 IP/CIDR 대역 허용`;
  }

  if (template.type === "rateLimit") {
    return `average ${template.config.average} / burst ${template.config.burst}`;
  }

  if (template.type === "basicAuth") {
    const users = Array.isArray(template.config.users) ? template.config.users : [];
    return `${users.length}개 계정 인증`;
  }

  const headers =
    template.config.customResponseHeaders &&
    typeof template.config.customResponseHeaders === "object" &&
    !Array.isArray(template.config.customResponseHeaders)
      ? Object.keys(template.config.customResponseHeaders as Record<string, unknown>)
      : [];
  return `${headers.length}개 응답 헤더 설정`;
}
