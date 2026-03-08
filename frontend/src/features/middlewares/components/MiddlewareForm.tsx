"use client";

import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

import {
  MiddlewareTemplate,
  MiddlewareTemplateCreate,
  MiddlewareTemplateType,
} from "../api/middlewareApi";

const schema = z.object({
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
    })
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

  if (value.type === "rateLimit") {
    if (!value.rate_limit_average || !value.rate_limit_burst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rate_limit_average"],
        message: "average와 burst를 모두 입력하세요",
      });
    }
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

type FormData = z.infer<typeof schema>;

interface MiddlewareFormProps {
  defaultValues?: MiddlewareTemplate;
  onSubmit: (data: MiddlewareTemplateCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

function parseMultiline(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractDefaults(template?: MiddlewareTemplate) {
  const config = template?.config || {};

  const sourceRange = Array.isArray(config.sourceRange)
    ? config.sourceRange.map(String).join("\n")
    : "";
  const rateLimitAverage = typeof config.average === "number" ? config.average : undefined;
  const rateLimitBurst = typeof config.burst === "number" ? config.burst : undefined;
  const basicAuthUsers = Array.isArray(config.users) ? config.users.map(String).join("\n") : "";
  const customHeaders = (() => {
    if (
      config.customResponseHeaders &&
      typeof config.customResponseHeaders === "object" &&
      !Array.isArray(config.customResponseHeaders)
    ) {
      const entries = Object.entries(config.customResponseHeaders as Record<string, unknown>).map(
        ([key, value]) => ({
          key,
          value: String(value),
        })
      );
      if (entries.length > 0) return entries;
    }
    return [{ key: "", value: "" }];
  })();

  return {
    sourceRange,
    rateLimitAverage,
    rateLimitBurst,
    basicAuthUsers,
    customHeaders,
  };
}

export default function MiddlewareForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: MiddlewareFormProps) {
  const extractedDefaults = useMemo(() => extractDefaults(defaultValues), [defaultValues]);
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name || "",
      type: (defaultValues?.type as MiddlewareTemplateType) || "ipAllowList",
      source_range_input: extractedDefaults.sourceRange,
      rate_limit_average: extractedDefaults.rateLimitAverage,
      rate_limit_burst: extractedDefaults.rateLimitBurst,
      basic_auth_users_input: extractedDefaults.basicAuthUsers,
      custom_headers: extractedDefaults.customHeaders,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_headers",
  });
  const type = watch("type");

  return (
    <form
      onSubmit={handleSubmit((data) => {
        let config: Record<string, unknown> = {};

        if (data.type === "ipAllowList") {
          config = { sourceRange: parseMultiline(data.source_range_input) };
        } else if (data.type === "rateLimit") {
          config = {
            average: data.rate_limit_average,
            burst: data.rate_limit_burst,
          };
        } else if (data.type === "basicAuth") {
          config = { users: parseMultiline(data.basic_auth_users_input) };
        } else if (data.type === "headers") {
          const headers = data.custom_headers.reduce<Record<string, string>>((acc, item) => {
            const key = item.key.trim();
            if (!key) return acc;
            acc[key] = item.value.trim();
            return acc;
          }, {});
          config = { customResponseHeaders: headers };
        }

        onSubmit({
          name: data.name.trim(),
          type: data.type,
          config,
        });
      })}
      className="space-y-5"
    >
      <div>
        <label className="label">템플릿 이름</label>
        <input className="input" placeholder="예: 사내망 허용 IP" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="label">미들웨어 타입</label>
        <select className="input" {...register("type")}>
          <option value="ipAllowList">ipAllowList — 특정 IP만 접근 허용</option>
          <option value="rateLimit">rateLimit — 초당 요청 수 제한 (DDoS 방어)</option>
          <option value="basicAuth">basicAuth — 아이디/비밀번호 팝업 인증</option>
          <option value="headers">headers — 응답 헤더 추가/수정</option>
        </select>
      </div>

      {type === "ipAllowList" && (
        <div>
          <label className="label">허용 IP 목록</label>
          <textarea
            className="input min-h-24"
            placeholder={"예:\n192.168.0.0/24\n10.0.0.1"}
            {...register("source_range_input")}
          />
          <p className="text-xs text-gray-400 mt-1">한 줄에 IP 또는 CIDR 형식으로 입력. 목록에 없는 IP는 403 차단됩니다.</p>
          {errors.source_range_input && (
            <p className="text-xs text-red-500 mt-1">{errors.source_range_input.message}</p>
          )}
        </div>
      )}

      {type === "rateLimit" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">average <span className="text-gray-400 font-normal">(초당 평균 요청 수)</span></label>
            <input type="number" className="input" min={1} placeholder="예: 100" {...register("rate_limit_average")} />
          </div>
          <div>
            <label className="label">burst <span className="text-gray-400 font-normal">(순간 최대 요청 수)</span></label>
            <input type="number" className="input" min={1} placeholder="예: 200" {...register("rate_limit_burst")} />
          </div>
          <p className="text-xs text-gray-400 col-span-2">일반 웹: 100/200 · API: 50/100 · 관리자: 20/30. 초과 시 429 응답.</p>
          {errors.rate_limit_average && (
            <p className="text-xs text-red-500 mt-1 col-span-2">{errors.rate_limit_average.message}</p>
          )}
        </div>
      )}

      {type === "basicAuth" && (
        <div>
          <label className="label">users (htpasswd 형식)</label>
          <textarea
            className="input min-h-24"
            placeholder={"예:\nadmin:$apr1$...\nviewer:$2y$..."}
            {...register("basic_auth_users_input")}
          />
          {errors.basic_auth_users_input && (
            <p className="text-xs text-red-500 mt-1">{errors.basic_auth_users_input.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">한 줄에 `username:hashedPassword` 형태로 입력합니다</p>
        </div>
      )}

      {type === "headers" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">customResponseHeaders</p>
            <button
              type="button"
              className="btn-secondary py-1.5 text-sm inline-flex items-center gap-1.5"
              onClick={() => append({ key: "", value: "" })}
            >
              <Plus className="w-3.5 h-3.5" />
              헤더 추가
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input className="input" placeholder="헤더 키" {...register(`custom_headers.${index}.key`)} />
                <input className="input" placeholder="헤더 값" {...register(`custom_headers.${index}.value`)} />
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  title="헤더 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {errors.custom_headers && (
            <p className="text-xs text-red-500 mt-1">{errors.custom_headers.message as string}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
