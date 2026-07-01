import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Key } from "lucide-react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import ServiceAccessRulesFields from "./ServiceAccessRulesFields";
import ServiceCustomHeadersFields, { type ServiceCustomHeaderField } from "./ServiceCustomHeadersFields";
import ServiceHealthcheckFields from "./ServiceHealthcheckFields";
import ServiceMiddlewareTemplateFields from "./ServiceMiddlewareTemplateFields";
import ServiceRateLimitFields from "./ServiceRateLimitFields";
import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceAdvancedSettingsFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  errors: FieldErrors<ServiceFormData>;
  middlewareTemplates: MiddlewareTemplate[];
  isMiddlewareLoading: boolean;
  rateLimitEnabled: boolean | undefined;
  healthcheckEnabled: boolean | undefined;
  customHeaderFields: ServiceCustomHeaderField[];
  onAddCustomHeader: () => void;
  onRemoveCustomHeader: (index: number) => void;
}

export default function ServiceAdvancedSettingsFields({
  register,
  errors,
  middlewareTemplates,
  isMiddlewareLoading,
  rateLimitEnabled,
  healthcheckEnabled,
  customHeaderFields,
  onAddCustomHeader,
  onRemoveCustomHeader,
}: ServiceAdvancedSettingsFieldsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Key className="w-4 h-4 text-blue-600" />
        고급 설정 및 미들웨어
      </h3>

      <ServiceMiddlewareTemplateFields
        register={register}
        middlewareTemplates={middlewareTemplates}
        isMiddlewareLoading={isMiddlewareLoading}
      />
      <ServiceAccessRulesFields register={register} />
      <ServiceRateLimitFields register={register} rateLimitEnabled={rateLimitEnabled} />
      <ServiceHealthcheckFields
        register={register}
        errors={errors}
        healthcheckEnabled={healthcheckEnabled}
      />
      <ServiceCustomHeadersFields
        register={register}
        customHeaderFields={customHeaderFields}
        onAddCustomHeader={onAddCustomHeader}
        onRemoveCustomHeader={onRemoveCustomHeader}
      />
    </div>
  );
}
