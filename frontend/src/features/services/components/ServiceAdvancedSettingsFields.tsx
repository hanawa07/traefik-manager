import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Key, Plus, Trash2 } from "lucide-react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { ServiceFormData } from "./serviceFormSchema";

interface CustomHeaderField {
  id: string;
}

interface ServiceAdvancedSettingsFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  errors: FieldErrors<ServiceFormData>;
  middlewareTemplates: MiddlewareTemplate[];
  isMiddlewareLoading: boolean;
  rateLimitEnabled: boolean | undefined;
  healthcheckEnabled: boolean | undefined;
  customHeaderFields: CustomHeaderField[];
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
                <span className="text-sm text-gray-700">
                  {template.name} ({template.type})
                </span>
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
            onClick={onAddCustomHeader}
          >
            <Plus className="w-3 h-3" /> 추가
          </button>
        </div>
        <div className="space-y-2">
          {customHeaderFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className="input text-sm" placeholder="Key" {...register(`custom_headers.${index}.key`)} />
              <input className="input text-sm" placeholder="Value" {...register(`custom_headers.${index}.value`)} />
              <button type="button" onClick={() => onRemoveCustomHeader(index)} className="p-2 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
