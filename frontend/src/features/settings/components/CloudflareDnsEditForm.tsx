import type { Dispatch, SetStateAction } from "react";

import type { CloudflareZoneInput } from "@/features/settings/api/settingsApi";
import { CloudflareDnsEditActions } from "@/features/settings/components/CloudflareDnsEditActions";
import { CloudflareDnsEditNotice } from "@/features/settings/components/CloudflareDnsEditNotice";
import { CloudflareZoneForm } from "@/features/settings/components/CloudflareZoneForm";
import { createDefaultCloudflareZoneForm } from "@/features/settings/lib/settingsDefaults";

interface CloudflareDnsEditFormProps {
  zones: CloudflareZoneInput[];
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<CloudflareZoneInput[]>>;
}

export function CloudflareDnsEditForm({
  zones,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: CloudflareDnsEditFormProps) {
  const updateZone = (index: number, patch: Partial<CloudflareZoneInput>) => {
    onFormChange((current) =>
      current.map((zone, currentIndex) =>
        currentIndex === index ? { ...zone, ...patch } : zone,
      ),
    );
  };
  const addZone = () => {
    onFormChange((current) => [...current, createDefaultCloudflareZoneForm()]);
  };
  const removeZone = (index: number) => {
    onFormChange((current) =>
      current.length === 1
        ? [createDefaultCloudflareZoneForm()]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  return (
    <div className="space-y-4">
      {zones.map((zone, index) => (
        <CloudflareZoneForm
          key={`cf-zone-${index}`}
          zone={zone}
          index={index}
          canRemove={zones.length > 1}
          onUpdate={updateZone}
          onRemove={removeZone}
        />
      ))}

      <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addZone}>
        영역 추가
      </button>

      <CloudflareDnsEditNotice />

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <CloudflareDnsEditActions
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}
