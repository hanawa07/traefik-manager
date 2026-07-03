import type { UseFormRegister } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

const AUTH_MODE_OPTIONS: {
  value: ServiceFormData["auth_mode"];
  label: string;
  desc: string;
}[] = [
  { value: "none", label: "사용 안 함", desc: "누구나 접근 가능" },
  { value: "authentik", label: "Authentik", desc: "중앙 집중형 SSO" },
  { value: "token", label: "백엔드 토큰", desc: "전용 API Key 발급" },
];

interface ServiceAuthModeSelectorProps {
  register: UseFormRegister<ServiceFormData>;
  authMode: ServiceFormData["auth_mode"];
}

export default function ServiceAuthModeSelector({
  register,
  authMode,
}: ServiceAuthModeSelectorProps) {
  return (
    <div>
      <label className="label">인증 모드 (ForwardAuth)</label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {AUTH_MODE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`
              relative flex min-w-0 cursor-pointer flex-col rounded-xl border p-3 transition-all
              ${authMode === option.value
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-gray-200 bg-white hover:border-gray-300"}
            `}
          >
            <input
              type="radio"
              className="sr-only"
              value={option.value}
              {...register("auth_mode")}
            />
            <span
              className={`text-sm font-bold ${
                authMode === option.value ? "text-blue-700" : "text-gray-900"
              }`}
            >
              {option.label}
            </span>
            <span className="mt-1 text-xs leading-snug text-gray-500">
              {option.desc}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
