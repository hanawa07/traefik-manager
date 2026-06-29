import type {
  FieldArrayWithId,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { Database } from "lucide-react";

import type { AuthentikGroup } from "../api/serviceApi";
import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import ServiceAdvancedSettingsFields from "./ServiceAdvancedSettingsFields";
import ServiceAuthenticationFields from "./ServiceAuthenticationFields";
import ServiceNetworkSecurityFields from "./ServiceNetworkSecurityFields";
import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceFormFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  setValue: UseFormSetValue<ServiceFormData>;
  errors: FieldErrors<ServiceFormData>;
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  tlsEnabled: boolean;
  authMode: ServiceFormData["auth_mode"];
  apiKeyValue: string | null | undefined;
  basicAuthEnabled: boolean | undefined;
  rateLimitEnabled: boolean | undefined;
  upstreamScheme: ServiceFormData["upstream_scheme"];
  healthcheckEnabled: boolean | undefined;
  isAnyAuthEnabled: boolean;
  authentikGroups: AuthentikGroup[];
  middlewareTemplates: MiddlewareTemplate[];
  isMiddlewareLoading: boolean;
  customHeaderFields: FieldArrayWithId<ServiceFormData, "custom_headers", "id">[];
  basicAuthFields: FieldArrayWithId<ServiceFormData, "basic_auth_credentials", "id">[];
  copied: boolean;
  loading?: boolean;
  submitLabel: string;
  onOpenContainerImportModal: () => void;
  onRegenerateApiKey: () => void;
  onCopyApiKey: (value: string) => void;
  onAddBasicAuthUser: () => void;
  onRemoveBasicAuthUser: (index: number) => void;
  onAddCustomHeader: () => void;
  onRemoveCustomHeader: (index: number) => void;
}

export default function ServiceFormFields({
  register,
  setValue,
  errors,
  onSubmit,
  tlsEnabled,
  authMode,
  apiKeyValue,
  basicAuthEnabled,
  rateLimitEnabled,
  upstreamScheme,
  healthcheckEnabled,
  isAnyAuthEnabled,
  authentikGroups,
  middlewareTemplates,
  isMiddlewareLoading,
  customHeaderFields,
  basicAuthFields,
  copied,
  loading,
  submitLabel,
  onOpenContainerImportModal,
  onRegenerateApiKey,
  onCopyApiKey,
  onAddBasicAuthUser,
  onRemoveBasicAuthUser,
  onAddCustomHeader,
  onRemoveCustomHeader,
}: ServiceFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label">서비스 이름</label>
        <input className="input" placeholder="예: Portainer" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

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
          onClick={onOpenContainerImportModal}
        >
          <Database className="w-3.5 h-3.5" />
          컨테이너 정보 가져오기
        </button>
      </div>

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

      <ServiceAuthenticationFields
        register={register}
        authMode={authMode}
        apiKeyValue={apiKeyValue}
        basicAuthEnabled={basicAuthEnabled}
        isAnyAuthEnabled={isAnyAuthEnabled}
        authentikGroups={authentikGroups}
        basicAuthFields={basicAuthFields}
        copied={copied}
        onRegenerateApiKey={onRegenerateApiKey}
        onCopyApiKey={onCopyApiKey}
        onAddBasicAuthUser={onAddBasicAuthUser}
        onRemoveBasicAuthUser={onRemoveBasicAuthUser}
      />

      <ServiceAdvancedSettingsFields
        register={register}
        errors={errors}
        middlewareTemplates={middlewareTemplates}
        isMiddlewareLoading={isMiddlewareLoading}
        rateLimitEnabled={rateLimitEnabled}
        healthcheckEnabled={healthcheckEnabled}
        customHeaderFields={customHeaderFields}
        onAddCustomHeader={onAddCustomHeader}
        onRemoveCustomHeader={onRemoveCustomHeader}
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button type="submit" className="btn-primary min-w-[100px]" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
