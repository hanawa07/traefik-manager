import type { UseFormRegister } from "react-hook-form";
import { Check, Copy, Lock, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { AuthentikGroup } from "../api/serviceApi";
import type { ServiceFormData } from "./serviceFormSchema";

interface BasicAuthField {
  id: string;
}

interface ServiceAuthenticationFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  authMode: ServiceFormData["auth_mode"];
  apiKeyValue: string | null | undefined;
  basicAuthEnabled: boolean | undefined;
  isAnyAuthEnabled: boolean;
  authentikGroups: AuthentikGroup[];
  basicAuthFields: BasicAuthField[];
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

          {authMode === "token" && apiKeyValue && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">서비스 전용 API Key</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRegenerateApiKey}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    새로 고침
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopyApiKey(apiKeyValue)}
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
              onClick={onAddBasicAuthUser}
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
                  onClick={() => onRemoveBasicAuthUser(index)}
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
    </>
  );
}
