import type {
  FieldArrayWithId,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import type { AuthentikGroup } from "../api/serviceApi";
import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import ServiceAdvancedSettingsFields from "./ServiceAdvancedSettingsFields";
import ServiceAuthenticationFields from "./ServiceAuthenticationFields";
import ServiceBasicInfoFields from "./ServiceBasicInfoFields";
import ServiceFormSubmitActions from "./ServiceFormSubmitActions";
import ServiceNetworkSecurityFields from "./ServiceNetworkSecurityFields";
import ServiceRoutingModeFields from "./ServiceRoutingModeFields";
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
      <ServiceRoutingModeFields register={register} />

      <ServiceBasicInfoFields
        register={register}
        errors={errors}
        onOpenContainerImportModal={onOpenContainerImportModal}
      />

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

      <ServiceFormSubmitActions loading={loading} submitLabel={submitLabel} />
    </form>
  );
}
