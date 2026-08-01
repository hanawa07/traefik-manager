import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";

interface EncodedPathBlockMonitoringFieldsProps {
  formValue: SecurityAlertSettingsInput;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}

export function EncodedPathBlockMonitoringFields({
  formValue,
  updateForm,
}: EncodedPathBlockMonitoringFieldsProps) {
  const disabled = !formValue.traefik_encoded_path_block_monitoring_enabled;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
        <input
          checked={formValue.traefik_encoded_path_block_monitoring_enabled}
          className="mt-0.5 h-4 w-4 rounded accent-amber-600"
          onChange={(event) =>
            updateForm({
              traefik_encoded_path_block_monitoring_enabled: event.target.checked,
            })
          }
          type="checkbox"
        />
        <span>
          <span className="block font-medium text-gray-900 dark:text-slate-100">
            Traefik 인코딩 경로 급증 감지
          </span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
            예약 문자가 인코딩된 비정상 경로 차단이 급증하면 보안 이벤트로 알립니다.
            URL과 IP는 저장하거나 전송하지 않습니다.
          </span>
        </span>
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          disabled={disabled}
          label="집계 구간"
          max={1440}
          min={5}
          unit="분"
          value={formValue.traefik_encoded_path_block_window_minutes}
          onChange={(value) =>
            updateForm({ traefik_encoded_path_block_window_minutes: value })
          }
        />
        <NumberField
          disabled={disabled}
          label="경고 임계치"
          max={10000}
          min={1}
          unit="건"
          value={formValue.traefik_encoded_path_block_threshold}
          onChange={(value) =>
            updateForm({ traefik_encoded_path_block_threshold: value })
          }
        />
      </div>
      <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
        실제 전송에는 보안 이벤트 알림 활성화와 “Traefik 인코딩 경로 급증” 라우팅 설정이 적용됩니다.
      </p>
    </div>
  );
}

function NumberField({
  disabled,
  label,
  max,
  min,
  unit,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input
          className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) => {
            if (Number.isFinite(event.target.valueAsNumber)) {
              onChange(event.target.valueAsNumber);
            }
          }}
          type="number"
          value={value}
        />
        <span className="text-xs font-normal text-gray-500 dark:text-slate-400">{unit}</span>
      </span>
    </label>
  );
}
