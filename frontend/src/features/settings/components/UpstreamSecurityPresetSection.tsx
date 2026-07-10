import type { UpstreamSecurityPreset } from "@/features/settings/api/settingsApi";
import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";
import {
  applyUpstreamPreset,
  inferUpstreamPresetKey,
} from "@/features/settings/lib/settingsFormHelpers";

interface UpstreamSecurityPresetSectionProps {
  formValue: UpstreamSecurityForm;
  presets: UpstreamSecurityPreset[];
  onFormChange: (value: UpstreamSecurityForm) => void;
}

export function UpstreamSecurityPresetSection({
  formValue,
  presets,
  onFormChange,
}: UpstreamSecurityPresetSectionProps) {
  const selectedPresetKey = inferUpstreamPresetKey(presets, formValue);

  return (
    <div>
      <label className="label">정책 preset</label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {presets.map((preset) => {
          const isSelected = selectedPresetKey === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              className={`rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-rose-300 bg-rose-50 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600"
              }`}
              onClick={() => onFormChange(applyUpstreamPreset(formValue, preset))}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{preset.name}</span>
                {isSelected ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                    현재 조합
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">{preset.description}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        preset을 누르면 권장 조합이 바로 적용됩니다. 이후 세부 옵션을 직접 바꾸면 조합은 자동으로 `사용자 정의`
        상태가 됩니다.
      </p>
      {selectedPresetKey === "custom" ? (
        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-200">
          현재 조합은 preset과 다르게 직접 조정된 사용자 정의 상태입니다.
        </p>
      ) : null}
    </div>
  );
}
