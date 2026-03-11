"use client";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthMode, FramePolicy, ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { Database, Plus, Trash2, Shield, Key, Lock, Copy, Check, RefreshCw } from "lucide-react";
import Modal from "@/shared/components/Modal";
import { useDockerContainers } from "@/features/docker/hooks/useDockerContainers";
import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";

function parseHealthcheckExpectedStatuses(input: string | undefined): number[] {
  if (!input) return [];
  const normalized = input
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));

  const uniqueStatuses = Array.from(new Set(normalized));
  return uniqueStatuses.sort((a, b) => a - b);
}

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
  auth_mode: z.enum(["none", "authentik", "token"]),
  api_key: z.string().optional().nullable(),
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
  frame_policy: z.enum(["deny", "sameorigin", "off"]),
  healthcheck_enabled: z.boolean(),
  healthcheck_path: z.string(),
  healthcheck_timeout_ms: z.coerce.number().int().positive("1 이상의 정수를 입력하세요"),
  healthcheck_expected_statuses_input: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.https_redirect_enabled && !value.tls_enabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["https_redirect_enabled"],
      message: "HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다",
    });
  }
  if (value.auth_mode !== "authentik" && value.authentik_group_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authentik_group_id"],
      message: "Authentik 인증 모드에서만 그룹을 선택할 수 없습니다",
    });
  }
  if (value.auth_mode !== "none" && value.basic_auth_enabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["basic_auth_enabled"],
      message: "외부 인증(Authentik/Token)과 Basic Auth는 동시에 사용할 수 없습니다",
    });
  }
  if (value.rate_limit_enabled && (!value.rate_limit_average || !value.rate_limit_burst)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rate_limit_average"],
      message: "Rate Limit을 활성화하면 average와 burst를 모두 입력해야 합니다",
    });
  }
  if (!value.healthcheck_path.trim().startsWith("/")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["healthcheck_path"],
      message: "헬스 체크 경로는 '/'로 시작해야 합니다",
    });
  }
  try {
    const statuses = parseHealthcheckExpectedStatuses(value.healthcheck_expected_statuses_input);
    if (statuses.some((status) => !Number.isInteger(status) || status < 100 || status > 599)) {
      throw new Error("invalid");
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["healthcheck_expected_statuses_input"],
      message: "기대 상태 코드는 100~599 범위 정수만 입력할 수 있습니다",
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
  auth_mode?: AuthMode;
  api_key?: string | null;
  basic_auth_enabled?: boolean;
  middleware_template_ids?: string[];
  authentik_group_id?: string | null;
  allowed_ips?: string[];
  blocked_paths?: string[];
  rate_limit_average?: number | null;
  rate_limit_burst?: number | null;
  custom_headers?: Record<string, string>;
  frame_policy?: FramePolicy;
  healthcheck_enabled?: boolean;
  healthcheck_path?: string;
  healthcheck_timeout_ms?: number;
  healthcheck_expected_statuses?: number[];
  basic_auth_usernames?: string[];
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

// 보안 랜덤 토큰 생성기
const generateSecureToken = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const randomStr = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `service_${btoa(randomStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").substring(0, 44)}`;
};

export default function ServiceForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: ServiceFormProps) {
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const headerEntries = Object.entries(defaultValues?.custom_headers || {}).map(([key, value]) => ({
    key,
    value,
  }));

  const initialBasicAuthCredentials = useMemo(() => {
    if (defaultValues?.basic_auth_usernames && defaultValues.basic_auth_usernames.length > 0) {
      return defaultValues.basic_auth_usernames.map(username => ({ username, password: "" }));
    }
    return [{ username: "", password: "" }];
  }, [defaultValues?.basic_auth_usernames]);

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
      auth_mode: defaultValues?.auth_mode || "none",
      api_key: defaultValues?.api_key || null,
      basic_auth_enabled: defaultValues?.basic_auth_enabled ?? false,
      middleware_template_ids: defaultValues?.middleware_template_ids || [],
      allowed_ips_input: defaultValues?.allowed_ips?.join("\n") || "",
      blocked_paths_input: defaultValues?.blocked_paths?.join("\n") || "",
      authentik_group_id: defaultValues?.authentik_group_id || "",
      basic_auth_credentials: initialBasicAuthCredentials,
      rate_limit_enabled:
        defaultValues?.rate_limit_average != null && defaultValues?.rate_limit_burst != null,
      rate_limit_average: defaultValues?.rate_limit_average ?? undefined,
      rate_limit_burst: defaultValues?.rate_limit_burst ?? undefined,
      custom_headers: headerEntries.length > 0 ? headerEntries : [{ key: "", value: "" }],
      frame_policy: defaultValues?.frame_policy || "deny",
      healthcheck_enabled: defaultValues?.healthcheck_enabled ?? true,
      healthcheck_path: defaultValues?.healthcheck_path || "/",
      healthcheck_timeout_ms: defaultValues?.healthcheck_timeout_ms ?? 3000,
      healthcheck_expected_statuses_input: defaultValues?.healthcheck_expected_statuses?.join(", ") || "",
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
  const authMode = watch("auth_mode");
  const apiKeyValue = watch("api_key");
  const basicAuthEnabled = watch("basic_auth_enabled");
  const rateLimitEnabled = watch("rate_limit_enabled");
  const upstreamScheme = watch("upstream_scheme");
  const healthcheckEnabled = watch("healthcheck_enabled");
  
  const isAuthentikEnabled = authMode === "authentik";
  const isAnyAuthEnabled = authMode !== "none";

  const { data: authentikGroups = [] } = useAuthentikGroups(isAuthentikEnabled);
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

  // 외부 데이터 변경 시 리셋 (api_key 반영용)
  useEffect(() => {
    if (defaultValues?.api_key) {
      setValue("api_key", defaultValues.api_key);
    }
  }, [defaultValues?.api_key, setValue]);

  // ★ 백엔드 토큰 선택 시 즉시 생성 로직
  useEffect(() => {
    if (authMode === "token" && !apiKeyValue) {
      setValue("api_key", generateSecureToken());
    }
  }, [authMode, apiKeyValue, setValue]);

  useEffect(() => {
    if (!tlsEnabled) {
      setValue("https_redirect_enabled", false);
    }
  }, [tlsEnabled, setValue]);

  useEffect(() => {
    if (authMode !== "authentik") {
      setValue("authentik_group_id", "");
    }
  }, [authMode, setValue]);

  useEffect(() => {
    if (authMode !== "none") {
      setValue("basic_auth_enabled", false);
      setValue("basic_auth_credentials", [{ username: "", password: "" }]);
    }
  }, [authMode, setValue]);

  useEffect(() => {
    if (upstreamScheme === "http") {
      setValue("skip_tls_verify", false);
    }
  }, [upstreamScheme, setValue]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const submitForm = (data: FormData) => {
    const customHeaders = data.custom_headers.reduce<Record<string, string>>((acc, item) => {
      const key = item.key.trim();
      const value = item.value.trim();
      if (!key) return acc;
      acc[key] = value;
      return acc;
    }, {});

    const basicAuthCredentials = data.basic_auth_credentials
      .map((item) => ({
        username: item.username.trim(),
        password: item.password,
      }))
      // 빈 비밀번호는 기존 해시 유지 또는 백엔드 검증 대상으로 전달한다.
      .filter((item) => item.username);

    onSubmit({
      name: data.name,
      domain: data.domain,
      upstream_host: data.upstream_host,
      upstream_port: data.upstream_port,
      upstream_scheme: data.upstream_scheme,
      skip_tls_verify: data.upstream_scheme === "https" ? data.skip_tls_verify : false,
      tls_enabled: data.tls_enabled,
      https_redirect_enabled: data.https_redirect_enabled,
      auth_mode: data.auth_mode,
      api_key: data.auth_mode === "token" ? data.api_key : null,
      basic_auth_enabled: data.basic_auth_enabled,
      middleware_template_ids: data.middleware_template_ids,
      rate_limit_enabled: data.rate_limit_enabled,
      allowed_ips: parseAllowedIps(data.allowed_ips_input),
      blocked_paths: parseBlockedPaths(data.blocked_paths_input),
      rate_limit_average: data.rate_limit_enabled ? data.rate_limit_average ?? null : null,
      rate_limit_burst: data.rate_limit_enabled ? data.rate_limit_burst ?? null : null,
      custom_headers: customHeaders,
      frame_policy: data.frame_policy,
      healthcheck_enabled: data.healthcheck_enabled,
      healthcheck_path: data.healthcheck_path.trim() || "/",
      healthcheck_timeout_ms: data.healthcheck_timeout_ms,
      healthcheck_expected_statuses: parseHealthcheckExpectedStatuses(data.healthcheck_expected_statuses_input),
      basic_auth_credentials: data.basic_auth_enabled ? basicAuthCredentials : [],
      authentik_group_id: data.auth_mode === "authentik" ? data.authentik_group_id || null : null,
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

        {/* 네트워크 및 보안 옵션 */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            네트워크 및 보안
          </h3>
          
          <div className="space-y-3 pl-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("tls_enabled")} />
              <div>
                <span className="text-sm font-medium text-gray-700">HTTPS (TLS) 활성화</span>
                    <p className="text-xs text-gray-500">Let&apos;s Encrypt 인증서 자동 발급</p>
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

            <div className="pt-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-600"
                  checked={upstreamScheme === "https"}
                  onChange={(e) => setValue("upstream_scheme", e.target.checked ? "https" : "http")}
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">업스트림 HTTPS 사용</span>
                  <p className="text-xs text-gray-500">백엔드 서비스가 자체 HTTPS를 사용하는 경우 체크</p>
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

            <div className="pt-2">
              <label className="label">프레임 정책</label>
              <select className="input" {...register("frame_policy")}>
                <option value="deny">DENY (기본 권장)</option>
                <option value="sameorigin">SAMEORIGIN (Cockpit/iframe 기반 앱)</option>
                <option value="off">OFF (특수한 임베드 환경만)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                전역 보안 헤더와 별도로 이 서비스가 어떤 X-Frame-Options 정책을 가질지 결정합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 인증 설정 섹션 */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            인증 설정
          </h3>

          <div className="space-y-4 pl-1">
            <div>
              <label className="label">인증 모드 (ForwardAuth)</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "none", label: "사용 안 함", desc: "누구나 접근 가능" },
                  { value: "authentik", label: "Authentik", desc: "중앙 집중형 SSO" },
                  { value: "token", label: "백엔드 토큰", desc: "전용 API Key 발급" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`
                      relative flex flex-col p-3 border rounded-xl cursor-pointer transition-all
                      ${authMode === option.value 
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" 
                        : "border-gray-200 hover:border-gray-300 bg-white"}
                    `}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      value={option.value}
                      {...register("auth_mode")}
                    />
                    <span className={`text-sm font-bold ${authMode === option.value ? "text-blue-700" : "text-gray-900"}`}>
                      {option.label}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-1 leading-tight">
                      {option.desc}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 토큰 표시 섹션 */}
            {authMode === "token" && apiKeyValue && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">서비스 전용 API Key</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setValue("api_key", generateSecureToken())}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      새로 고침
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(apiKeyValue)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "복사됨" : "복사하기"}
                    </button>
                  </div>
                </div>
                <div className="bg-white/60 border border-purple-200 rounded-lg px-3 py-2 text-xs font-mono text-purple-900 break-all select-all">
                  {apiKeyValue}
                </div>
                <p className="text-[10px] text-purple-600 mt-2 leading-relaxed italic">
                  * [저장] 버튼을 눌러야 최종적으로 이 키가 활성화됩니다.
                </p>
              </div>
            )}

            {authMode === "authentik" && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="label">Authentik 접근 그룹</label>
                <select className="input" {...register("authentik_group_id")}>
                  <option value="">그룹 선택 안 함 (모든 사용자)</option>
                  {authentikGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-2 border-t border-gray-50">
              <label className={`flex items-center gap-3 ${isAnyAuthEnabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-600"
                  disabled={isAnyAuthEnabled}
                  {...register("basic_auth_enabled")}
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Basic Auth 활성화</span>
                  <p className="text-xs text-gray-500">ForwardAuth 모드에서는 사용할 수 없습니다</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {basicAuthEnabled && !isAnyAuthEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
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
            </div>
          </div>
        )}

        {/* 고급 설정 및 미들웨어 */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" />
            고급 설정 및 미들웨어
          </h3>

          <div>
            <label className="label">미들웨어 템플릿 (선택)</label>
            {isMiddlewareLoading ? (
              <div className="h-20 bg-gray-50 rounded-lg animate-pulse" />
            ) : middlewareTemplates.length === 0 ? (
              <p className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg border">등록된 템플릿이 없습니다.</p>
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
                    <span className="text-sm text-gray-700">{template.name} ({template.type})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">허용 IP 목록</label>
            <textarea
              className="input min-h-24"
              placeholder={"한 줄에 하나씩 입력\n192.168.0.0/24"}
              {...register("allowed_ips_input")}
            />
          </div>

          <div>
            <label className="label">차단 경로</label>
            <textarea
              className="input min-h-24"
              placeholder={"예: /admin"}
              {...register("blocked_paths_input")}
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("rate_limit_enabled")} />
              <span className="text-sm font-medium text-gray-700">Rate Limit 활성화</span>
            </label>

            {rateLimitEnabled && (
              <div className="grid grid-cols-2 gap-3 pl-1">
                <input type="number" className="input" placeholder="초당 평균" {...register("rate_limit_average")} />
                <input type="number" className="input" placeholder="순간 허용" {...register("rate_limit_burst")} />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("healthcheck_enabled")} />
              <div>
                <span className="text-sm font-medium text-gray-700">업스트림 헬스 체크 활성화</span>
                <p className="text-xs text-gray-500">
                  서비스 목록의 UP/DOWN 상태와 지연시간 측정에 사용합니다
                </p>
              </div>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
              <div>
                <label className="label">헬스 체크 경로</label>
                <input
                  className="input"
                  placeholder="/health"
                  {...register("healthcheck_path")}
                />
                {errors.healthcheck_path && (
                  <p className="text-xs text-red-500 mt-1">{errors.healthcheck_path.message}</p>
                )}
              </div>
              <div>
                <label className="label">타임아웃 (ms)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="3000"
                  {...register("healthcheck_timeout_ms")}
                />
                {errors.healthcheck_timeout_ms && (
                  <p className="text-xs text-red-500 mt-1">{errors.healthcheck_timeout_ms.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">기대 상태 코드</label>
              <input
                className="input"
                placeholder="비워두면 모든 HTTP 응답을 정상으로 간주합니다. 예: 200,204"
                {...register("healthcheck_expected_statuses_input")}
              />
              {errors.healthcheck_expected_statuses_input && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.healthcheck_expected_statuses_input.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {healthcheckEnabled
                  ? "현재 서비스는 이 설정으로 헬스 체크를 수행합니다."
                  : "비활성화하면 목록에서 '체크 안 함'으로 표시됩니다."}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">커스텀 응답 헤더</p>
              <button
                type="button"
                className="btn-secondary py-1 text-xs px-2 gap-1"
                onClick={() => append({ key: "", value: "" })}
              >
                <Plus className="w-3 h-3" /> 추가
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input className="input text-sm" placeholder="Key" {...register(`custom_headers.${index}.key`)} />
                  <input className="input text-sm" placeholder="Value" {...register(`custom_headers.${index}.value`)} />
                  <button type="button" onClick={() => remove(index)} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="submit" className="btn-primary min-w-[100px]" disabled={loading}>
            {loading ? "처리 중..." : submitLabel}
          </button>
        </div>
      </form>

      <Modal
        isOpen={isContainerModalOpen}
        onClose={() => setIsContainerModalOpen(false)}
        title="컨테이너에서 서비스 가져오기"
      >
        <div className="max-h-80 overflow-y-auto space-y-2">
          {!dockerContainers?.enabled ? (
            <p className="text-sm text-amber-600">Docker 자동 감지를 사용할 수 없습니다.</p>
          ) : isDockerLoading ? (
            <div className="h-20 bg-gray-50 rounded animate-pulse" />
          ) : dockerCandidates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">후보 컨테이너가 없습니다.</p>
          ) : (
            dockerCandidates.map((candidate, index) => (
              <button
                key={index}
                type="button"
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                onClick={() => {
                  setValue("name", candidate.containerName);
                  setValue("domain", candidate.domain);
                  setValue("upstream_host", candidate.upstream_host);
                  setValue("upstream_port", candidate.upstream_port);
                  setValue("tls_enabled", candidate.tls_enabled);
                  setIsContainerModalOpen(false);
                }}
              >
                <p className="text-sm font-medium text-gray-900">{candidate.containerName}</p>
                <p className="text-xs text-gray-500">{candidate.domain}</p>
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
