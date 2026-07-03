import type { MiddlewareTemplate, MiddlewareTemplateType } from "../api/middlewareApi";

export function extractMiddlewareFormDefaults(template?: MiddlewareTemplate) {
  const config = template?.config || {};

  return {
    name: template?.name || "",
    type: (template?.type as MiddlewareTemplateType) || "ipAllowList",
    source_range_input: extractArrayInput(config.sourceRange),
    rate_limit_average: typeof config.average === "number" ? config.average : undefined,
    rate_limit_burst: typeof config.burst === "number" ? config.burst : undefined,
    basic_auth_users_input: extractArrayInput(config.users),
    custom_headers: extractCustomHeaderDefaults(config),
  };
}

function extractArrayInput(value: unknown) {
  return Array.isArray(value) ? value.map(String).join("\n") : "";
}

function extractCustomHeaderDefaults(config: Record<string, unknown>) {
  if (
    config.customResponseHeaders &&
    typeof config.customResponseHeaders === "object" &&
    !Array.isArray(config.customResponseHeaders)
  ) {
    const entries = Object.entries(config.customResponseHeaders as Record<string, unknown>).map(
      ([key, value]) => ({
        key,
        value: String(value),
      }),
    );
    if (entries.length > 0) return entries;
  }
  return [{ key: "", value: "" }];
}
