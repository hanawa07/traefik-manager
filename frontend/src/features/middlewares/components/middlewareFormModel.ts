import { z } from "zod";

import type {
  MiddlewareTemplate,
  MiddlewareTemplateCreate,
  MiddlewareTemplateType,
} from "../api/middlewareApi";

export const middlewareFormSchema = z.object({
  name: z.string().min(1, "템플릿 이름을 입력하세요"),
  type: z.enum(["ipAllowList", "rateLimit", "basicAuth", "headers"]),
  source_range_input: z.string().optional(),
  rate_limit_average: z.coerce.number().int().positive("1 이상의 정수를 입력하세요").optional(),
  rate_limit_burst: z.coerce.number().int().positive("1 이상의 정수를 입력하세요").optional(),
  basic_auth_users_input: z.string().optional(),
  custom_headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
}).superRefine((value, ctx) => {
  if (value.type === "ipAllowList") {
    const entries = parseMultiline(value.source_range_input);
    if (entries.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_range_input"],
        message: "sourceRange를 1개 이상 입력하세요",
      });
    }
  }

  if (value.type === "rateLimit" && (!value.rate_limit_average || !value.rate_limit_burst)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rate_limit_average"],
      message: "average와 burst를 모두 입력하세요",
    });
  }

  if (value.type === "basicAuth") {
    const users = parseMultiline(value.basic_auth_users_input);
    if (users.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basic_auth_users_input"],
        message: "users를 1개 이상 입력하세요 (예: user:$apr1$...)",
      });
    }
  }

  if (value.type === "headers") {
    const hasHeader = value.custom_headers.some((item) => item.key.trim() !== "");
    if (!hasHeader) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_headers"],
        message: "헤더를 1개 이상 입력하세요",
      });
    }
  }
});

export type MiddlewareFormData = z.infer<typeof middlewareFormSchema>;

export function parseMultiline(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function extractMiddlewareFormDefaults(template?: MiddlewareTemplate) {
  const config = template?.config || {};

  const sourceRange = Array.isArray(config.sourceRange)
    ? config.sourceRange.map(String).join("\n")
    : "";
  const rateLimitAverage = typeof config.average === "number" ? config.average : undefined;
  const rateLimitBurst = typeof config.burst === "number" ? config.burst : undefined;
  const basicAuthUsers = Array.isArray(config.users) ? config.users.map(String).join("\n") : "";
  const customHeaders = extractCustomHeaderDefaults(config);

  return {
    name: template?.name || "",
    type: (template?.type as MiddlewareTemplateType) || "ipAllowList",
    source_range_input: sourceRange,
    rate_limit_average: rateLimitAverage,
    rate_limit_burst: rateLimitBurst,
    basic_auth_users_input: basicAuthUsers,
    custom_headers: customHeaders,
  };
}

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

  const headers = data.custom_headers.reduce<Record<string, string>>((acc, item) => {
    const key = item.key.trim();
    if (!key) return acc;
    acc[key] = item.value.trim();
    return acc;
  }, {});
  return { customResponseHeaders: headers };
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
