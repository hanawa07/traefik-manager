import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";

import { UpstreamSecurityCheckboxRow } from "./UpstreamSecurityCheckboxRow";

interface UpstreamSecurityAllowlistSectionProps {
  formValue: UpstreamSecurityForm;
  onFormChange: (value: UpstreamSecurityForm) => void;
}

export function UpstreamSecurityAllowlistSection({
  formValue,
  onFormChange,
}: UpstreamSecurityAllowlistSectionProps) {
  return (
    <div className="space-y-3">
      <UpstreamSecurityCheckboxRow
        checked={formValue.allowlist_enabled}
        title="업스트림 allowlist 활성화"
        description="외부 FQDN은 아래 suffix 목록과 일치해야만 저장할 수 있습니다. strict mode와는 별개로 동작합니다."
        onChange={(checked) => onFormChange({ ...formValue, allowlist_enabled: checked })}
      />

      <div>
        <label className="label">허용 도메인 suffix</label>
        <textarea
          className="input min-h-28 py-3 font-mono text-sm"
          placeholder={"예:\nexample.com\nhanadays.co.kr"}
          value={formValue.allowed_domain_suffixes_text}
          onChange={(event) =>
            onFormChange({
              ...formValue,
              allowed_domain_suffixes_text: event.target.value,
            })
          }
        />
        <p className="mt-1 text-xs text-gray-500">
          줄바꿈 또는 쉼표로 구분합니다. `*.example.com` 입력도 허용됩니다.
        </p>
      </div>
    </div>
  );
}
