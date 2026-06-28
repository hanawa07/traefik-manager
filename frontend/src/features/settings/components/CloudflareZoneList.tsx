import type { CloudflareSettingsStatus } from "@/features/settings/api/settingsApi";

export function CloudflareZoneList({ status }: { status: CloudflareSettingsStatus }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <p className="text-xs font-medium text-gray-700">설정된 영역 목록</p>
      <div className="space-y-2">
        {status.zones.map((zone) => (
          <div
            key={zone.zone_id}
            className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-gray-900">{zone.zone_name || "(영역 이름 미확인)"}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                {zone.proxied ? "프록시 활성" : "DNS only"}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-gray-500">{zone.zone_id}</p>
            <p className="mt-2 text-[11px] text-gray-600">
              대상: <span className="font-mono text-gray-700">{zone.record_target || "(서비스 업스트림 사용)"}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
