import type { UseFormRegister } from "react-hook-form";
import { Lock } from "lucide-react";

import type { AuthentikGroup } from "../api/serviceApi";
import ServiceApiKeyPanel from "./ServiceApiKeyPanel";
import ServiceAuthentikGroupSelect from "./ServiceAuthentikGroupSelect";
import ServiceAuthModeSelector from "./ServiceAuthModeSelector";
import ServiceBasicAuthToggle from "./ServiceBasicAuthToggle";
import ServiceBasicAuthUsers, { type ServiceBasicAuthField } from "./ServiceBasicAuthUsers";
import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceAuthenticationFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  authMode: ServiceFormData["auth_mode"];
  apiKeyValue: string | null | undefined;
  basicAuthEnabled: boolean | undefined;
  isAnyAuthEnabled: boolean;
  authentikGroups: AuthentikGroup[];
  basicAuthFields: ServiceBasicAuthField[];
  copied: boolean;
  onRegenerateApiKey: () => void;
  onCopyApiKey: (value: string) => void;
  onAddBasicAuthUser: () => void;
  onRemoveBasicAuthUser: (index: number) => void;
}

export default function ServiceAuthenticationFields({
  register,
  authMode,
  apiKeyValue,
  basicAuthEnabled,
  isAnyAuthEnabled,
  authentikGroups,
  basicAuthFields,
  copied,
  onRegenerateApiKey,
  onCopyApiKey,
  onAddBasicAuthUser,
  onRemoveBasicAuthUser,
}: ServiceAuthenticationFieldsProps) {
  return (
    <>
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-600" />
          인증 설정
        </h3>

        <div className="space-y-4 pl-1">
          <ServiceAuthModeSelector register={register} authMode={authMode} />
          <ServiceApiKeyPanel
            authMode={authMode}
            apiKeyValue={apiKeyValue}
            copied={copied}
            onRegenerateApiKey={onRegenerateApiKey}
            onCopyApiKey={onCopyApiKey}
          />
          <ServiceAuthentikGroupSelect
            register={register}
            authMode={authMode}
            authentikGroups={authentikGroups}
          />
          <ServiceBasicAuthToggle
            register={register}
            isAnyAuthEnabled={isAnyAuthEnabled}
          />
        </div>
      </div>

      {basicAuthEnabled && !isAnyAuthEnabled && (
        <ServiceBasicAuthUsers
          register={register}
          basicAuthFields={basicAuthFields}
          onAddBasicAuthUser={onAddBasicAuthUser}
          onRemoveBasicAuthUser={onRemoveBasicAuthUser}
        />
      )}
    </>
  );
}
