import type { CloudflareExcludedService } from "@/features/settings/api/settingsApi";

interface CloudflareExcludedServicesListProps {
  excludedServices: CloudflareExcludedService[];
}

export function CloudflareExcludedServicesList({
  excludedServices,
}: CloudflareExcludedServicesListProps) {
  if (!excludedServices.length) return null;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-900 dark:text-slate-100">비Cloudflare 도메인 제외</p>
        <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {excludedServices.length}개
        </span>
      </div>
      <ul className="space-y-2">
        {excludedServices.slice(0, 5).map((item) => (
          <li key={item.domain} className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            <p className="font-mono text-[11px] font-medium text-slate-900 dark:text-slate-100">{item.domain}</p>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{item.reason}</p>
          </li>
        ))}
        {excludedServices.length > 5 ? (
          <li className="text-[11px] text-slate-500 dark:text-slate-400">
            외 {excludedServices.length - 5}개 더 있음
          </li>
        ) : null}
      </ul>
    </div>
  );
}
