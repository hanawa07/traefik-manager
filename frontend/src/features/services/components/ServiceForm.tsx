"use client";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { Plus, Trash2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "서비스 이름을 입력하세요"),
  domain: z.string().regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "유효한 도메인 형식이 아닙니다"
  ),
  upstream_host: z.string().min(1, "업스트림 호스트를 입력하세요"),
  upstream_port: z.coerce.number().min(1).max(65535, "1~65535 범위의 포트를 입력하세요"),
  tls_enabled: z.boolean(),
  https_redirect_enabled: z.boolean(),
  auth_enabled: z.boolean(),
  authentik_group_id: z.string().optional(),
  allowed_ips_input: z.string().optional(),
  rate_limit_enabled: z.boolean(),
  rate_limit_average: z.coerce.number().int().positive("1 이상의 정수를 입력하세요").optional(),
  rate_limit_burst: z.coerce.number().int().positive("1 이상의 정수를 입력하세요").optional(),
  custom_headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
}).superRefine((value, ctx) => {
  if (value.https_redirect_enabled && !value.tls_enabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["https_redirect_enabled"],
      message: "HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다",
    });
  }
  if (!value.auth_enabled && value.authentik_group_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authentik_group_id"],
      message: "인증이 비활성화된 상태에서는 그룹을 선택할 수 없습니다",
    });
  }
  if (value.rate_limit_enabled && (!value.rate_limit_average || !value.rate_limit_burst)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rate_limit_average"],
      message: "Rate Limit을 활성화하면 average와 burst를 모두 입력해야 합니다",
    });
  }
});

type FormData = z.infer<typeof schema>;

interface ServiceFormDefaultValues {
  name?: string;
  domain?: string;
  upstream_host?: string;
  upstream_port?: number;
  tls_enabled?: boolean;
  https_redirect_enabled?: boolean;
  auth_enabled?: boolean;
  authentik_group_id?: string | null;
  allowed_ips?: string[];
  rate_limit_average?: number | null;
  rate_limit_burst?: number | null;
  custom_headers?: Record<string, string>;
}

interface ServiceFormProps {
  defaultValues?: ServiceFormDefaultValues;
  onSubmit: (data: ServiceCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

function parseAllowedIps(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function ServiceForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: ServiceFormProps) {
  const headerEntries = Object.entries(defaultValues?.custom_headers || {}).map(([key, value]) => ({
    key,
    value,
  }));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name || "",
      domain: defaultValues?.domain || "",
      upstream_host: defaultValues?.upstream_host || "",
      upstream_port: defaultValues?.upstream_port ?? 80,
      tls_enabled: defaultValues?.tls_enabled ?? true,
      https_redirect_enabled: defaultValues?.https_redirect_enabled ?? true,
      auth_enabled: defaultValues?.auth_enabled ?? false,
      allowed_ips_input: defaultValues?.allowed_ips?.join("\n") || "",
      authentik_group_id: defaultValues?.authentik_group_id || "",
      rate_limit_enabled:
        defaultValues?.rate_limit_average != null && defaultValues?.rate_limit_burst != null,
      rate_limit_average: defaultValues?.rate_limit_average ?? undefined,
      rate_limit_burst: defaultValues?.rate_limit_burst ?? undefined,
      custom_headers: headerEntries.length > 0 ? headerEntries : [{ key: "", value: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_headers",
  });

  const tlsEnabled = watch("tls_enabled");
  const authEnabled = watch("auth_enabled");
  const rateLimitEnabled = watch("rate_limit_enabled");
  const { data: authentikGroups = [], isLoading: isGroupLoading } = useAuthentikGroups(authEnabled);

  useEffect(() => {
    if (!tlsEnabled) {
      setValue("https_redirect_enabled", false);
    }
  }, [tlsEnabled, setValue]);

  useEffect(() => {
    if (!authEnabled) {
      setValue("authentik_group_id", "");
    }
  }, [authEnabled, setValue]);

  useEffect(() => {
    if (!rateLimitEnabled) {
      setValue("rate_limit_average", undefined);
      setValue("rate_limit_burst", undefined);
    }
  }, [rateLimitEnabled, setValue]);

  const submitForm = (data: FormData) => {
    const customHeaders = data.custom_headers.reduce<Record<string, string>>((acc, item) => {
      const key = item.key.trim();
      const value = item.value.trim();
      if (!key) {
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});

    onSubmit({
      name: data.name,
      domain: data.domain,
      upstream_host: data.upstream_host,
      upstream_port: data.upstream_port,
      tls_enabled: data.tls_enabled,
      https_redirect_enabled: data.https_redirect_enabled,
      auth_enabled: data.auth_enabled,
      rate_limit_enabled: data.rate_limit_enabled,
      allowed_ips: parseAllowedIps(data.allowed_ips_input),
      rate_limit_average: data.rate_limit_enabled ? data.rate_limit_average ?? null : null,
      rate_limit_burst: data.rate_limit_enabled ? data.rate_limit_burst ?? null : null,
      custom_headers: customHeaders,
      authentik_group_id: data.auth_enabled ? data.authentik_group_id || null : null,
    });
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-5">
      {/* 서비스 이름 */}
      <div>
        <label className="label">서비스 이름</label>
        <input className="input" placeholder="예: Portainer" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* 도메인 */}
      <div>
        <label className="label">도메인</label>
        <input className="input" placeholder="예: portainer.example.com" {...register("domain")} />
        {errors.domain && <p className="text-xs text-red-500 mt-1">{errors.domain.message}</p>}
      </div>

      {/* 업스트림 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">업스트림 호스트</label>
          <input className="input" placeholder="예: 192.168.1.100" {...register("upstream_host")} />
          {errors.upstream_host && <p className="text-xs text-red-500 mt-1">{errors.upstream_host.message}</p>}
        </div>
        <div>
          <label className="label">포트</label>
          <input type="number" className="input" placeholder="8080" {...register("upstream_port")} />
          {errors.upstream_port && <p className="text-xs text-red-500 mt-1">{errors.upstream_port.message}</p>}
        </div>
      </div>

      {/* 토글 옵션 */}
      <div className="space-y-3 pt-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("tls_enabled")} />
          <div>
            <span className="text-sm font-medium text-gray-700">HTTPS (TLS) 활성화</span>
            <p className="text-xs text-gray-500">Let's Encrypt 인증서 자동 발급</p>
          </div>
        </label>

        <label className={`flex items-center gap-3 ${tlsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-blue-600"
            disabled={!tlsEnabled}
            {...register("https_redirect_enabled")}
          />
          <div>
            <span className="text-sm font-medium text-gray-700">HTTP → HTTPS 자동 리다이렉트</span>
            <p className="text-xs text-gray-500">HTTP 요청을 HTTPS로 강제 전환합니다</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("auth_enabled")} />
          <div>
            <span className="text-sm font-medium text-gray-700">Authentik 인증 활성화</span>
            <p className="text-xs text-gray-500">
              {authEnabled
                ? "Authentik에 Provider/Application이 자동 생성됩니다"
                : "활성화 시 웹 로그인 폼이 추가됩니다"}
            </p>
          </div>
        </label>
      </div>

      {authEnabled && (
        <div>
          <label className="label">Authentik 접근 그룹</label>
          <select className="input" {...register("authentik_group_id")}>
            <option value="">그룹 선택 안 함</option>
            {authentikGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {isGroupLoading && <p className="text-xs text-gray-500 mt-1">그룹 목록을 불러오는 중입니다...</p>}
          {errors.authentik_group_id && (
            <p className="text-xs text-red-500 mt-1">{errors.authentik_group_id.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">선택 시 해당 그룹 사용자만 서비스 접근이 허용됩니다</p>
        </div>
      )}

      <div>
        <label className="label">허용 IP 목록 (선택)</label>
        <textarea
          className="input min-h-24"
          placeholder={"예:\n192.168.0.0/24\n10.0.0.1"}
          {...register("allowed_ips_input")}
        />
        <p className="text-xs text-gray-500 mt-1">한 줄에 하나씩 입력하세요. IP 또는 CIDR 형식을 지원합니다.</p>
      </div>

      <div className="space-y-3 pt-1 border-t border-gray-100">
        <label className="flex items-center gap-3 cursor-pointer pt-4">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("rate_limit_enabled")} />
          <div>
            <span className="text-sm font-medium text-gray-700">Rate Limit 활성화</span>
            <p className="text-xs text-gray-500">서비스별 초당 요청 수를 제한합니다</p>
          </div>
        </label>

        {rateLimitEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Average (초당 평균 요청)</label>
              <input type="number" min={1} className="input" placeholder="예: 100" {...register("rate_limit_average")} />
              {errors.rate_limit_average && (
                <p className="text-xs text-red-500 mt-1">{errors.rate_limit_average.message}</p>
              )}
            </div>
            <div>
              <label className="label">Burst (순간 허용량)</label>
              <input type="number" min={1} className="input" placeholder="예: 200" {...register("rate_limit_burst")} />
              {errors.rate_limit_burst && (
                <p className="text-xs text-red-500 mt-1">{errors.rate_limit_burst.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-1 border-t border-gray-100">
        <div className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">커스텀 응답 헤더</p>
            <p className="text-xs text-gray-500">서비스 응답에 헤더를 추가합니다</p>
          </div>
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
              <input
                className="input"
                placeholder="헤더 키 (예: X-Frame-Options)"
                {...register(`custom_headers.${index}.key`)}
              />
              <input
                className="input"
                placeholder="헤더 값 (예: DENY)"
                {...register(`custom_headers.${index}.value`)}
              />
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
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
