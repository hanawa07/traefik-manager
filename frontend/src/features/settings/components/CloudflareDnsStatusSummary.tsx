import type { CloudflareSettingsStatus } from "@/features/settings/api/settingsApi";
import { CloudflareZoneList } from "@/features/settings/components/CloudflareZoneList";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";

interface CloudflareDnsStatusSummaryProps {
  status?: CloudflareSettingsStatus;
}

export function CloudflareDnsStatusSummary({ status }: CloudflareDnsStatusSummaryProps) {
  return (
    <>
      <p className={`text-sm font-medium ${status?.enabled ? "text-green-700" : "text-gray-600"}`}>
        {status?.enabled ? "활성화됨" : "비활성화됨"}
      </p>
      <p className="text-xs text-gray-500 mt-1">{status?.message}</p>
      <div className="pt-1">
        <SettingsSummaryRow label="설정된 영역 수" value={`${status?.zone_count ?? 0}개`} />
        <SettingsSummaryRow label="적용 범위" value="Cloudflare zone과 일치하는 도메인만 자동 연동" />
        <SettingsSummaryRow label="비Cloudflare 도메인" value="자동 제외 후 진단 결과에 표시" />
      </div>
      {status?.zones?.length ? <CloudflareZoneList status={status} /> : null}
    </>
  );
}
