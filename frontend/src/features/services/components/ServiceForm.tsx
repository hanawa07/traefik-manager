"use client";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { Database, Plus, Search, Trash2 } from "lucide-react";
import Modal from "@/shared/components/Modal";
import { useDockerContainers } from "@/features/docker/hooks/useDockerContainers";
import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";

const schema = z.object({
  name: z.string().min(1, "서비스 이름을 입력하세요"),
  domain: z.string().regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "유효한 도메인 형식이 아닙니다"
  ),
  upstream_host: z.string().min(1, "업스트림 호스트를 입력하세요"),
  upstream_port: z.coerce.number().min(1).max(65535, "1~65535 범위의 포트를 입력하세요"),
  upstream_scheme: z.enum(["http", "https"]),
  skip_tls_verify: z.boolean(),
  tls_enabled: z.boolean(),
  https_redirect_enabled: z.boolean(),
  auth_enabled: z.boolean(),
  basic_auth_enabled: z.boolean(),
  middleware_template_ids: z.array(z.string()),
  authentik_group_id: z.string().optional(),
  basic_auth_credentials: z.array(
    z.object({
      username: z.string(),
      password: z.string(),
    })
  ),
  allowed_ips_input: z.string().optional(),
  blocked_paths_input: z.string().optional(),
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
  if (value.auth_enabled && value.basic_auth_enabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["basic_auth_enabled"],
      message: "Authentik 인증과 Basic Auth는 동시에 사용할 수 없습니다",
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
  upstream_scheme?: "http" | "https";
  skip_tls_verify?: boolean;
  tls_enabled?: boolean;
  https_redirect_enabled?: boolean;
  auth_enabled?: boolean;
  basic_auth_enabled?: boolean;
  middleware_template_ids?: string[];
  authentik_group_id?: string | null;
  allowed_ips?: string[];
  blocked_paths?: string[];
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

function parseBlockedPaths(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("/") ? p : `/${p}`));
}

export default function ServiceForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: ServiceFormProps) {
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
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
      upstream_scheme: defaultValues?.upstream_scheme || "http",
      skip_tls_verify: defaultValues?.skip_tls_verify ?? false,
      tls_enabled: defaultValues?.tls_enabled ?? true,
      https_redirect_enabled: defaultValues?.https_redirect_enabled ?? true,
      auth_enabled: defaultValues?.auth_enabled ?? false,
      basic_auth_enabled: defaultValues?.basic_auth_enabled ?? false,
      middleware_template_ids: defaultValues?.middleware_template_ids || [],
      allowed_ips_input: defaultValues?.allowed_ips?.join("\n") || "",
      blocked_paths_input: defaultValues?.blocked_paths?.join("\n") || "",
      authentik_group_id: defaultValues?.authentik_group_id || "",
      basic_auth_credentials: [{ username: "", password: "" }],
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
  const {
    fields: basicAuthFields,
    append: appendBasicAuthField,
    remove: removeBasicAuthField,
  } = useFieldArray({
    control,
    name: "basic_auth_credentials",
  });

  const tlsEnabled = watch("tls_enabled");
  const authEnabled = watch("auth_enabled");
  const basicAuthEnabled = watch("basic_auth_enabled");
  const rateLimitEnabled = watch("rate_limit_enabled");
  const upstreamScheme = watch("upstream_scheme");
  const { data: authentikGroups = [], isLoading: isGroupLoading } = useAuthentikGroups(authEnabled);
  const { data: middlewareTemplates = [], isLoading: isMiddlewareLoading } = useMiddlewareTemplates();
  const {
    data: dockerContainers,
    isLoading: isDockerLoading,
    refetch: refetchDockerContainers,
  } = useDockerContainers(isContainerModalOpen);
  const dockerCandidates = useMemo(() => {
    return (dockerContainers?.containers || []).flatMap((container) =>
      container.candidates.map((candidate) => ({
        containerName: container.name,
        image: container.image,
        ...candidate,
      }))
    );
  }, [dockerContainers]);

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
    if (authEnabled) {
      setValue("basic_auth_enabled", false);
      setValue("basic_auth_credentials", [{ username: "", password: "" }]);
    }
  }, [authEnabled, setValue]);

  useEffect(() => {
    if (!basicAuthEnabled) {
      setValue("basic_auth_credentials", [{ username: "", password: "" }]);
    }
  }, [basicAuthEnabled, setValue]);

  useEffect(() => {
    if (!rateLimitEnabled) {
      setValue("rate_limit_average", undefined);
      setValue("rate_limit_burst", undefined);
    }
  }, [rateLimitEnabled, setValue]);

  useEffect(() => {
    if (upstreamScheme === "http") {
      setValue("skip_tls_verify", false);
    }
  }, [upstreamScheme, setValue]);

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

    const basicAuthCredentials = data.basic_auth_credentials
      .map((item) => ({
        username: item.username.trim(),
        password: item.password,
      }))
      .filter((item) => item.username && item.password);

    const hasExistingBasicAuth = defaultValues?.basic_auth_enabled ?? false;
    const shouldSendBasicAuthCredentials =
      !data.basic_auth_enabled ||
      basicAuthCredentials.length > 0 ||
      !hasExistingBasicAuth;

    onSubmit({
      name: data.name,
      domain: data.domain,
      upstream_host: data.upstream_host,
      upstream_port: data.upstream_port,
      upstream_scheme: data.upstream_scheme,
      skip_tls_verify: data.upstream_scheme === "https" ? data.skip_tls_verify : false,
      tls_enabled: data.tls_enabled,
      https_redirect_enabled: data.https_redirect_enabled,
      auth_enabled: data.auth_enabled,
      basic_auth_enabled: data.basic_auth_enabled,
      middleware_template_ids: data.middleware_template_ids,
      rate_limit_enabled: data.rate_limit_enabled,
      allowed_ips: parseAllowedIps(data.allowed_ips_input),
      blocked_paths: parseBlockedPaths(data.blocked_paths_input),
      rate_limit_average: data.rate_limit_enabled ? data.rate_limit_average ?? null : null,
      rate_limit_burst: data.rate_limit_enabled ? data.rate_limit_burst ?? null : null,
      custom_headers: customHeaders,
      basic_auth_credentials: shouldSendBasicAuthCredentials
        ? (data.basic_auth_enabled ? basicAuthCredentials : [])
        : undefined,
      authentik_group_id: data.auth_enabled ? data.authentik_group_id || null : null,
    });
  };

  return (
    <>
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

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">컨테이너 자동 감지</p>
            <p className="text-xs text-gray-500">Traefik 라벨이 있는 컨테이너에서 값을 가져옵니다</p>
          </div>
          <button
            type="button"
            className="btn-secondary py-1.5 text-sm inline-flex items-center gap-1.5"
            onClick={async () => {
              setIsContainerModalOpen(true);
              await refetchDockerContainers();
            }}
          >
            <Database className="w-3.5 h-3.5" />
            컨테이너에서 가져오기
          </button>
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

          <div className="pt-2 pb-1 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-blue-600"
                checked={upstreamScheme === "https"}
                onChange={(e) => setValue("upstream_scheme", e.target.checked ? "https" : "http")}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">업스트림 HTTPS 사용</span>
                <p className="text-xs text-gray-500">백엔드 서비스가자체 HTTPS를 사용하는 경우 체크</p>
              </div>
            </label>

            {upstreamScheme === "https" && (
              <label className="flex items-center gap-3 cursor-pointer mt-3 ml-7 animate-in fade-in slide-in-from-left-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-600"
                  {...register("skip_tls_verify")}
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">TLS 인증서 검증 무시</span>
                  <p className="text-xs text-gray-500">자체서명 인증서를 사용하는 경우 체크</p>
                </div>
              </label>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer border-t border-gray-100 pt-3">
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

          <label className={`flex items-center gap-3 ${authEnabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-blue-600"
              disabled={authEnabled}
              {...register("basic_auth_enabled")}
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Basic Auth 활성화</span>
              <p className="text-xs text-gray-500">
                {authEnabled
                  ? "Authentik 인증 활성화 시 Basic Auth를 함께 사용할 수 없습니다"
                  : "간단한 사용자 이름/비밀번호 기반 인증을 적용합니다"}
              </p>
            </div>
          </label>
          {errors.basic_auth_enabled && (
            <p className="text-xs text-red-500 mt-1">{errors.basic_auth_enabled.message}</p>
          )}
        </div>

        {basicAuthEnabled && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Basic Auth 사용자</p>
                <p className="text-xs text-gray-500">입력한 비밀번호는 서버에서 htpasswd 형식으로 해시 저장됩니다</p>
              </div>
              <button
                type="button"
                className="btn-secondary py-1.5 text-sm inline-flex items-center gap-1.5"
                onClick={() => appendBasicAuthField({ username: "", password: "" })}
              >
                <Plus className="w-3.5 h-3.5" />
                사용자 추가
              </button>
            </div>

            <div className="space-y-2">
              {basicAuthFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    className="input"
                    placeholder="사용자 이름"
                    {...register(`basic_auth_credentials.${index}.username`)}
                  />
                  <input
                    type="password"
                    className="input"
                    placeholder="비밀번호"
                    {...register(`basic_auth_credentials.${index}.password`)}
                  />
                  <button
                    type="button"
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    onClick={() => removeBasicAuthField(index)}
                    disabled={basicAuthFields.length === 1}
                    title="사용자 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-500">서비스 수정 시 비워두면 기존 Basic Auth 사용자를 유지합니다.</p>
            </div>
          </div>
        )}

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
          <label className="label">미들웨어 템플릿 (선택)</label>
          {isMiddlewareLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : middlewareTemplates.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">등록된 템플릿이 없습니다. 미들웨어 메뉴에서 먼저 생성하세요.</p>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 max-h-48 overflow-y-auto">
              {middlewareTemplates.map((template) => (
                <label key={template.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-600 mt-0.5"
                    value={template.id}
                    {...register("middleware_template_ids")}
                  />
                  <span className="text-sm text-gray-700">
                    {template.name}
                    <span className="ml-2 text-xs text-gray-500">
                      ({template.type} · {template.shared_name})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.middleware_template_ids && (
            <p className="text-xs text-red-500 mt-1">{errors.middleware_template_ids.message as string}</p>
          )}
        </div>

        <div>
          <label className="label">허용 IP 목록 (선택)</label>
          <textarea
            className="input min-h-24"
            placeholder={"예:\n192.168.0.0/24\n10.0.0.1"}
            {...register("allowed_ips_input")}
          />
          <p className="text-xs text-gray-500 mt-1">한 줄에 하나씩 입력하세요. IP 또는 CIDR 형식을 지원합니다.</p>
        </div>

        <div>
          <label className="label">차단 경로 목록 (선택)</label>
          <textarea
            className="input min-h-24"
            placeholder={"예:\n/admin\n/api/debug"}
            {...register("blocked_paths_input")}
          />
          <p className="text-xs text-gray-500 mt-1">차단할 경로를 한 줄에 하나씩 입력하세요. 해당 경로는 외부에서 403으로 차단됩니다.</p>
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

      <Modal
        isOpen={isContainerModalOpen}
        onClose={() => setIsContainerModalOpen(false)}
        title="컨테이너에서 서비스 가져오기"
      >
        <div className="space-y-3">
          {!dockerContainers?.enabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-700">{dockerContainers?.message || "Docker 자동 감지를 사용할 수 없습니다"}</p>
            </div>
          ) : isDockerLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : dockerCandidates.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <Search className="w-5 h-5 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Traefik 라벨이 있는 컨테이너 후보가 없습니다</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {dockerCandidates.map((candidate, index) => (
                <button
                  key={`${candidate.containerName}-${candidate.domain}-${index}`}
                  type="button"
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  onClick={() => {
                    setValue("name", candidate.containerName);
                    setValue("domain", candidate.domain);
                    setValue("upstream_host", candidate.upstream_host);
                    setValue("upstream_port", candidate.upstream_port);
                    setValue("tls_enabled", candidate.tls_enabled);
                    if (!candidate.tls_enabled) {
                      setValue("https_redirect_enabled", false);
                    }
                    setIsContainerModalOpen(false);
                  }}
                >
                  <p className="text-sm font-medium text-gray-900">{candidate.containerName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {candidate.domain} → {candidate.upstream_host}:{candidate.upstream_port}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    라우터: {candidate.router_name} {candidate.image ? `· 이미지: ${candidate.image}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
