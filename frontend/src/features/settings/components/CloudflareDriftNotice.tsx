import type { CloudflareDriftCheckResult } from "@/features/settings/api/settingsApi";

export default function CloudflareDriftNotice({ result }: { result: CloudflareDriftCheckResult | null }) {
  if (!result) return null;

  const groups = [
    {
      title: "누락",
      color: "border-amber-200 bg-amber-50 text-amber-900",
      items: result.missing_records,
    },
    {
      title: "불일치",
      color: "border-red-200 bg-red-50 text-red-900",
      items: result.mismatched_records,
    },
    {
      title: "고아",
      color: "border-violet-200 bg-violet-50 text-violet-900",
      items: result.orphan_records,
    },
  ];

  return (
    <div
      className={`space-y-3 rounded-lg border p-3 text-sm ${
        result.success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div>
        <p className="font-medium">{result.message}</p>
        {result.detail ? <p className="mt-1 text-xs opacity-90">{result.detail}</p> : null}
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">대상 서비스</p>
          <p className="mt-1 font-medium text-gray-900">
            {result.eligible_services}개
            {result.skipped_services ? ` / 건너뜀 ${result.skipped_services}개` : ""}
          </p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">정상</p>
          <p className="mt-1 font-medium text-gray-900">{result.healthy_services}개</p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">드리프트</p>
          <p className="mt-1 font-medium text-gray-900">
            {result.missing_records.length + result.mismatched_records.length + result.orphan_records.length}개
          </p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">영역</p>
          <p className="mt-1 font-medium text-gray-900">{result.zone_count}개</p>
        </div>
      </div>
      {result.zones.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {result.zones.map((zone) => (
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
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">정상</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.healthy_services}개</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">누락</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.missing_records.length}개</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">불일치</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.mismatched_records.length}개</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">고아</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.orphan_records.length}개</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {result.excluded_services.length ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-900">비Cloudflare 도메인 제외</p>
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-700">
              {result.excluded_services.length}개
            </span>
          </div>
          <ul className="space-y-2">
            {result.excluded_services.slice(0, 5).map((item) => (
              <li key={item.domain} className="rounded-md border border-slate-200 bg-white p-2">
                <p className="font-mono text-[11px] font-medium text-slate-900">{item.domain}</p>
                <p className="mt-1 text-[11px] text-slate-600">{item.reason}</p>
              </li>
            ))}
            {result.excluded_services.length > 5 ? (
              <li className="text-[11px] text-slate-500">외 {result.excluded_services.length - 5}개 더 있음</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {!result.success ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title} className={`rounded-lg border p-3 text-xs ${group.color}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{group.title}</p>
                <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">{group.items.length}개</span>
              </div>
              {group.items.length ? (
                <ul className="mt-2 space-y-2">
                  {group.items.slice(0, 5).map((item) => (
                    <li
                      key={`${group.title}-${item.domain}`}
                      className="rounded-md border border-white/60 bg-white/60 p-2"
                    >
                      <p className="font-mono text-[11px] font-medium">{item.domain}</p>
                      <p className="mt-1 break-all text-[11px] opacity-90">{item.detail}</p>
                    </li>
                  ))}
                  {group.items.length > 5 ? (
                    <li className="text-[11px] opacity-80">외 {group.items.length - 5}개 더 있음</li>
                  ) : null}
                </ul>
              ) : (
                <p className="mt-2 opacity-80">없음</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
