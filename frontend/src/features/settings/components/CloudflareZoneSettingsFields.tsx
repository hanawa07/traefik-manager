import type { CloudflareZoneInput } from "@/features/settings/api/settingsApi";
import { CloudflareDnsTextField } from "@/features/settings/components/CloudflareDnsTextField";

interface CloudflareZoneSettingsFieldsProps {
  zone: CloudflareZoneInput;
  onUpdate: (patch: Partial<CloudflareZoneInput>) => void;
}

export function CloudflareZoneSettingsFields({
  zone,
  onUpdate,
}: CloudflareZoneSettingsFieldsProps) {
  return (
    <>
      <CloudflareDnsTextField
        label="Zone ID"
        value={zone.zone_id}
        help={
          "Cloudflare 도메인 대시보드 우측 하단 `Zone ID`. " +
          "이 zone에 속한 도메인만 자동 DNS 등록과 드리프트 진단 대상이 됩니다."
        }
        onChange={(zone_id) => onUpdate({ zone_id })}
      />
      <CloudflareDnsTextField
        label="Record Target"
        labelSuffix="(선택)"
        placeholder="예: 1.2.3.4 (비워두면 서비스 업스트림 호스트 사용)"
        value={zone.record_target}
        help={
          "DNS A/CNAME 레코드가 가리킬 대상입니다. 비워두면 서비스 upstream_host를 " +
          "사용하지만, upstream이 내부 IP인 경우 공인 IP나 외부 hostname을 직접 입력해야 합니다."
        }
        onChange={(record_target) => onUpdate({ record_target })}
      />

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={zone.proxied}
            onChange={(event) => onUpdate({ proxied: event.target.checked })}
          />
          Cloudflare Proxy (Proxied) 사용
        </label>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
          활성화 시 트래픽이 Cloudflare를 경유하며 실제 서버 IP가 숨겨집니다.
          DNS only가 필요하면 체크를 해제하세요.
        </p>
      </div>
    </>
  );
}
