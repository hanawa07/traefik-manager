import { z } from "zod";

import { extractMiddlewareFormDefaults } from "./middlewareFormDefaults";
import { parseMultiline } from "./middlewareFormParsing";
import { buildMiddlewareTemplatePayload } from "./middlewareFormPayload";

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

export { buildMiddlewareTemplatePayload, extractMiddlewareFormDefaults, parseMultiline };
