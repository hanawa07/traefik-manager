import type { CloudflareZoneInput } from "@/features/settings/api/settingsApi";
import { CloudflareZoneApiTokenField } from "@/features/settings/components/CloudflareZoneApiTokenField";
import { CloudflareZoneSettingsFields } from "@/features/settings/components/CloudflareZoneSettingsFields";

interface CloudflareZoneFormProps {
  zone: CloudflareZoneInput;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, patch: Partial<CloudflareZoneInput>) => void;
  onRemove: (index: number) => void;
}

export function CloudflareZoneForm({
  zone,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: CloudflareZoneFormProps) {
  const updateCurrentZone = (patch: Partial<CloudflareZoneInput>) => {
    onUpdate(index, patch);
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Cloudflare 영역 {index + 1}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            한 zone과 그 하위 도메인만 자동 연동 대상으로 포함됩니다.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary w-full py-1.5 text-xs sm:w-auto"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
        >
          영역 제거
        </button>
      </div>

      <CloudflareZoneApiTokenField
        value={zone.api_token}
        onChange={(api_token) => updateCurrentZone({ api_token })}
      />
      <CloudflareZoneSettingsFields zone={zone} onUpdate={updateCurrentZone} />
    </div>
  );
}
