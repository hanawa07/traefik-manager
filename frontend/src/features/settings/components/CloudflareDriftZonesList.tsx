import type { CloudflareDriftZone } from "@/features/settings/api/settingsApi";

interface CloudflareDriftZonesListProps {
  zones: CloudflareDriftZone[];
}

export function CloudflareDriftZonesList({ zones }: CloudflareDriftZonesListProps) {
  if (!zones.length) return null;

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {zones.map((zone) => (
        <div
          key={zone.zone_name}
          className="rounded-lg border border-white/60 bg-white/70 p-3 text-xs text-gray-700"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-gray-900">{zone.zone_name}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              대상 {zone.eligible_services}개
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <CloudflareDriftZoneStat label="정상" value={zone.healthy_services} />
            <CloudflareDriftZoneStat label="누락" value={zone.missing_records.length} />
            <CloudflareDriftZoneStat label="불일치" value={zone.mismatched_records.length} />
            <CloudflareDriftZoneStat label="고아" value={zone.orphan_records.length} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CloudflareDriftZoneStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <p className="text-gray-500">{label}</p>
      <p className="mt-1 font-medium text-gray-900">{value}개</p>
    </div>
  );
}
