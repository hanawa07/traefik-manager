import type {
  ManagerHttpErrorPreview,
  SecurityAlertSettingsInput,
} from "@/features/settings/api/settingsApi";
import { usePreviewManagerHttpErrors } from "@/features/settings/hooks/useSettings";

interface ManagerHttpErrorMonitoringFieldsProps {
  formValue: SecurityAlertSettingsInput;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}

export function ManagerHttpErrorMonitoringFields({
  formValue,
  updateForm,
}: ManagerHttpErrorMonitoringFieldsProps) {
  const disabled = !formValue.manager_http_error_monitoring_enabled;
  const preview = usePreviewManagerHttpErrors();
  const previewData = preview.data;
  const updatePreviewInput = (patch: Partial<SecurityAlertSettingsInput>) => {
    preview.reset();
    updateForm(patch);
  };
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
        <input
          checked={formValue.manager_http_error_monitoring_enabled}
          className="mt-0.5 h-4 w-4 rounded accent-amber-600"
          onChange={(event) =>
            updateForm({ manager_http_error_monitoring_enabled: event.target.checked })
          }
          type="checkbox"
        />
        <span>
          <span className="block font-medium text-gray-900 dark:text-slate-100">
            Manager API 오류 임계치 감지
          </span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
            짧은 구간의 404·5xx 급증과 정상화를 감사 로그에 기록합니다. 알림 전송에는 운영 변경 알림도 활성화되어 있어야 합니다.
          </span>
        </span>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <NumberField
          disabled={disabled}
          label="집계 구간"
          max={60}
          min={5}
          suffix="분"
          value={formValue.manager_http_error_window_minutes}
          onChange={(value) => updatePreviewInput({ manager_http_error_window_minutes: value })}
        />
        <NumberField
          disabled={disabled}
          label="404 임계치"
          max={10000}
          min={1}
          suffix="건"
          value={formValue.manager_http_not_found_threshold}
          onChange={(value) => updateForm({ manager_http_not_found_threshold: value })}
        />
        <NumberField
          disabled={disabled}
          label="5xx 임계치"
          max={10000}
          min={1}
          suffix="건"
          value={formValue.manager_http_server_error_threshold}
          onChange={(value) => updateForm({ manager_http_server_error_threshold: value })}
        />
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-700 dark:text-slate-300">
        임계치 제외 경로
        <textarea
          aria-label="임계치 제외 경로"
          className="mt-1 block min-h-24 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder:font-sans placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          maxLength={10049}
          onChange={(event) =>
            updatePreviewInput({ manager_http_excluded_paths: event.target.value.split("\n") })
          }
          placeholder={"/api/v1/example\n/api/v1/health"}
          rows={3}
          value={formValue.manager_http_excluded_paths.join("\n")}
        />
        <span className="mt-1 block font-normal text-gray-500 dark:text-slate-400">
          한 줄에 하나씩 최대 50개를 입력합니다. 해당 경로와 하위 경로는 임계치 계산에서만 제외됩니다.
        </span>
      </label>
      <div className="mt-3 border-t border-amber-200 pt-3 dark:border-amber-500/30">
        <button
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/50 dark:bg-slate-950 dark:text-amber-100 dark:hover:bg-amber-500/10"
          data-testid="manager-http-error-preview-button"
          disabled={disabled || preview.isPending}
          onClick={() =>
            preview.mutate({
              window_minutes: formValue.manager_http_error_window_minutes,
              excluded_paths: formValue.manager_http_excluded_paths,
            })
          }
          type="button"
        >
          {preview.isPending ? "최근 로그 계산 중" : "24시간 권장값 계산"}
        </button>
        {preview.isError ? (
          <p className="mt-2 text-xs text-rose-700 dark:text-rose-200">
            최근 로그 기준 권장값을 계산하지 못했습니다.
          </p>
        ) : null}
        {previewData ? (
          <HttpErrorPreviewResult
            onApply={() =>
              updateForm({
                manager_http_not_found_threshold:
                  previewData.recommended_not_found_threshold,
                manager_http_server_error_threshold:
                  previewData.recommended_server_error_threshold,
              })
            }
            preview={previewData}
          />
        ) : null}
      </div>
    </div>
  );
}

function HttpErrorPreviewResult({
  onApply,
  preview,
}: {
  onApply: () => void;
  preview: ManagerHttpErrorPreview;
}) {
  if (!preview.available) {
    return (
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-100" role="status">
        {preview.message}
      </p>
    );
  }

  return (
    <div
      className="mt-3 rounded-lg border border-amber-200 bg-white/80 p-3 text-xs text-gray-700 dark:border-amber-500/30 dark:bg-slate-950/70 dark:text-slate-300"
      data-recommended-not-found={preview.recommended_not_found_threshold}
      data-recommended-server-error={preview.recommended_server_error_threshold}
      data-testid="manager-http-error-preview"
    >
      <p className="font-semibold text-gray-900 dark:text-slate-100">24시간 권장값</p>
      <p className="mt-1">
        최고 {preview.window_minutes}분 구간: 404 {preview.peak_not_found_count}건 · 5xx {preview.peak_server_error_count}건
      </p>
      <p className="mt-1 font-medium text-amber-800 dark:text-amber-100">
        권장 임계치: 404 {preview.recommended_not_found_threshold}건 · 5xx {preview.recommended_server_error_threshold}건
      </p>
      <p className="mt-1 text-gray-500 dark:text-slate-400">
        최고치에 20% 여유를 두고 기존 기본값보다 낮지 않게 계산합니다.
      </p>
      {preview.excluded_paths.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-amber-100 pt-2 dark:border-amber-500/20">
          <p className="font-medium text-gray-900 dark:text-slate-100">제외 경로별 오류</p>
          {preview.excluded_paths.map((item) => (
            <p className="break-all" key={item.path}>
              <code>{item.path}</code> · 404 {item.not_found_count}건 · 5xx {item.server_error_count}건
            </p>
          ))}
        </div>
      ) : null}
      <button
        className="mt-3 rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700"
        onClick={onApply}
        type="button"
      >
        권장값 적용
      </button>
    </div>
  );
}

function NumberField({
  disabled,
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        <input
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) => {
            if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
          }}
          type="number"
          value={value}
        />
        <span className="font-normal text-gray-500 dark:text-slate-400">{suffix}</span>
      </span>
    </label>
  );
}
