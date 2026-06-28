"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { Database, Plus, Trash2, Key, Lock, Copy, Check, RefreshCw } from "lucide-react";
import type { DockerContainer } from "@/features/docker/api/dockerApi";
import { useDockerContainers } from "@/features/docker/hooks/useDockerContainers";
import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";
import ServiceContainerImportModal, {
  type ContainerImportMode,
  type TraefikImportCandidate,
} from "./ServiceContainerImportModal";
import ServiceNetworkSecurityFields from "./ServiceNetworkSecurityFields";
import {
  serviceFormSchema,
  type ServiceFormData,
  type ServiceFormDefaultValues,
} from "./serviceFormSchema";
import {
  formatDockerPortLabel,
  generateSecureToken,
  getSuggestedUpstreamPort,
  parseAllowedIps,
  parseBlockedPaths,
  parseHealthcheckExpectedStatuses,
} from "./serviceFormUtils";

interface ServiceFormProps {
  defaultValues?: ServiceFormDefaultValues;
  onSubmit: (data: ServiceCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

export default function ServiceForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: ServiceFormProps) {
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [containerImportMode, setContainerImportMode] = useState<ContainerImportMode>("basic");
  const [containerSearchQuery, setContainerSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const deferredContainerSearchQuery = useDeferredValue(containerSearchQuery);
  
  const headerEntries = Object.entries(defaultValues?.custom_headers || {}).map(([key, value]) => ({
    key,
    value,
  }));
  const basicAuthUsernames = defaultValues?.basic_auth_usernames;

  const initialBasicAuthCredentials = useMemo(() => {
    if (basicAuthUsernames && basicAuthUsernames.length > 0) {
      return basicAuthUsernames.map((username) => ({ username, password: "" }));
    }
    return [{ username: "", password: "" }];
  }, [basicAuthUsernames]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
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

  const [tlsEnabled, authMode, apiKeyValue, basicAuthEnabled, rateLimitEnabled, upstreamScheme, healthcheckEnabled] =
    useWatch({
      control,
      name: [
        "tls_enabled",
        "auth_mode",
        "api_key",
        "basic_auth_enabled",
        "rate_limit_enabled",
        "upstream_scheme",
        "healthcheck_enabled",
      ],
    });
  
  const isAuthentikEnabled = authMode === "authentik";
  const isAnyAuthEnabled = authMode !== "none";

  const { data: authentikGroups = [] } = useAuthentikGroups(isAuthentikEnabled);
  const { data: middlewareTemplates = [], isLoading: isMiddlewareLoading } = useMiddlewareTemplates();
  const {
    data: dockerContainers,
    isLoading: isDockerLoading,
    isFetching: isDockerFetching,
    isError: isDockerError,
    error: dockerContainersError,
  } = useDockerContainers(isContainerModalOpen);
  
  const availableContainers = useMemo(() => dockerContainers?.containers || [], [dockerContainers]);
  const traefikImportCandidates = useMemo(() => {
    return availableContainers.flatMap((container) =>
      container.traefik_candidates.map((candidate) => ({
        containerName: container.name,
        image: container.image,
        networks: container.networks,
        ...candidate,
      }))
    );
  }, [availableContainers]);
  const normalizedContainerSearchQuery = deferredContainerSearchQuery.trim().toLowerCase();
  const filteredContainers = useMemo(() => {
    if (!normalizedContainerSearchQuery) {
      return availableContainers;
    }

    return availableContainers.filter((container) => {
      const haystack = [
        container.name,
        container.image || "",
        container.state || "",
        container.status || "",
        ...container.networks,
        ...container.ports.map((port) => formatDockerPortLabel(port)),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedContainerSearchQuery);
    });
  }, [availableContainers, normalizedContainerSearchQuery]);
  const filteredTraefikImportCandidates = useMemo(() => {
    if (!normalizedContainerSearchQuery) {
      return traefikImportCandidates;
    }

    return traefikImportCandidates.filter((candidate) => {
      const haystack = [
        candidate.domain,
        candidate.containerName,
        candidate.image || "",
        candidate.router_name,
        String(candidate.upstream_port),
        ...candidate.networks,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedContainerSearchQuery);
    });
  }, [normalizedContainerSearchQuery, traefikImportCandidates]);

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

  const openContainerImportModal = () => {
    setContainerImportMode("basic");
    setContainerSearchQuery("");
    setIsContainerModalOpen(true);
  };

  const applyBasicContainerImport = (container: DockerContainer) => {
    setValue("name", container.name);
    setValue("upstream_host", container.name);
    setValue("upstream_port", getSuggestedUpstreamPort(container));
    setIsContainerModalOpen(false);
  };

  const applyTraefikContainerImport = (candidate: TraefikImportCandidate) => {
    setValue("name", candidate.containerName);
    setValue("domain", candidate.domain);
    setValue("upstream_host", candidate.upstream_host);
    setValue("upstream_port", candidate.upstream_port);
    setValue("tls_enabled", candidate.tls_enabled);
    setIsContainerModalOpen(false);
  };

  const submitForm = (data: ServiceFormData) => {
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
            <p className="text-sm font-medium text-gray-700">컨테이너에서 값 가져오기</p>
            <p className="text-xs text-gray-500">
              신규 서비스는 수동 입력이 기본이며, 기존 컨테이너 정보나 Traefik 라벨을 가져와 빠르게 채울 수 있습니다
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary py-1.5 text-sm inline-flex items-center gap-1.5"
            onClick={openContainerImportModal}
          >
            <Database className="w-3.5 h-3.5" />
            컨테이너 정보 가져오기
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

        <ServiceNetworkSecurityFields
          register={register}
          setValue={setValue}
          tlsEnabled={tlsEnabled}
          upstreamScheme={upstreamScheme}
        />

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

      <ServiceContainerImportModal
        isOpen={isContainerModalOpen}
        onClose={() => setIsContainerModalOpen(false)}
        mode={containerImportMode}
        onModeChange={setContainerImportMode}
        searchQuery={containerSearchQuery}
        onSearchQueryChange={setContainerSearchQuery}
        dockerContainers={dockerContainers}
        dockerContainersError={dockerContainersError}
        isDockerLoading={isDockerLoading}
        isDockerFetching={isDockerFetching}
        isDockerError={isDockerError}
        availableContainers={availableContainers}
        filteredContainers={filteredContainers}
        normalizedSearchQuery={normalizedContainerSearchQuery}
        traefikImportCandidates={traefikImportCandidates}
        filteredTraefikImportCandidates={filteredTraefikImportCandidates}
        onBasicImport={applyBasicContainerImport}
        onTraefikImport={applyTraefikContainerImport}
      />
    </>
  );
}
