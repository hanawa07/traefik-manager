import type { MiddlewareTemplateCreate } from "../api/middlewareApi";
import type { MiddlewareFormData } from "./middlewareFormModel";
import { parseMultiline } from "./middlewareFormParsing";

export function buildMiddlewareTemplatePayload(data: MiddlewareFormData): MiddlewareTemplateCreate {
  return {
    name: data.name.trim(),
    type: data.type,
    config: buildMiddlewareConfig(data),
  };
}

function buildMiddlewareConfig(data: MiddlewareFormData): Record<string, unknown> {
  if (data.type === "ipAllowList") {
    return { sourceRange: parseMultiline(data.source_range_input) };
  }
  if (data.type === "rateLimit") {
    return {
      average: data.rate_limit_average,
      burst: data.rate_limit_burst,
    };
  }
  if (data.type === "basicAuth") {
    return { users: parseMultiline(data.basic_auth_users_input) };
  }

  return { customResponseHeaders: buildCustomResponseHeaders(data) };
}

function buildCustomResponseHeaders(data: MiddlewareFormData) {
  return data.custom_headers.reduce<Record<string, string>>((acc, item) => {
    const key = item.key.trim();
    if (!key) return acc;
    acc[key] = item.value.trim();
    return acc;
  }, {});
}
