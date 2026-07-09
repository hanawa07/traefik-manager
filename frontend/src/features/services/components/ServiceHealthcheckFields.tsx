import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceHealthcheckFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  errors: FieldErrors<ServiceFormData>;
  healthcheckEnabled: boolean | undefined;
}

export default function ServiceHealthcheckFields({
  register,
  errors,
  healthcheckEnabled,
}: ServiceHealthcheckFieldsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/60">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded accent-blue-600"
          {...register("healthcheck_enabled")}
        />
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">업스트림 헬스 체크 활성화</span>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            서비스 목록의 UP/DOWN 상태와 지연시간 측정에 사용합니다
          </p>
        </div>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
        <div>
          <label className="label">헬스 체크 경로</label>
          <input className="input" placeholder="/health" {...register("healthcheck_path")} />
          {errors.healthcheck_path ? (
            <p className="mt-1 text-xs text-red-500">{errors.healthcheck_path.message}</p>
          ) : null}
        </div>
        <div>
          <label className="label">타임아웃 (ms)</label>
          <input
            type="number"
            className="input"
            placeholder="3000"
            {...register("healthcheck_timeout_ms")}
          />
          {errors.healthcheck_timeout_ms ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.healthcheck_timeout_ms.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="label">기대 상태 코드</label>
        <input
          className="input"
          placeholder="비워두면 모든 HTTP 응답을 정상으로 간주합니다. 예: 200,204"
          {...register("healthcheck_expected_statuses_input")}
        />
        {errors.healthcheck_expected_statuses_input ? (
          <p className="mt-1 text-xs text-red-500">
            {errors.healthcheck_expected_statuses_input.message}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          {healthcheckEnabled
            ? "현재 서비스는 이 설정으로 헬스 체크를 수행합니다."
            : "비활성화하면 목록에서 '체크 안 함'으로 표시됩니다."}
        </p>
      </div>
    </div>
  );
}
