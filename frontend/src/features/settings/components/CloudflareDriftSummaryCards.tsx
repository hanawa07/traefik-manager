import type { CloudflareDriftCheckResult } from "@/features/settings/api/settingsApi";

interface CloudflareDriftSummaryCardsProps {
  result: CloudflareDriftCheckResult;
}

export function CloudflareDriftSummaryCards({ result }: CloudflareDriftSummaryCardsProps) {
  const driftCount =
    result.missing_records.length +
    result.mismatched_records.length +
    result.orphan_records.length;

  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
      <CloudflareDriftSummaryCard
        label="대상 서비스"
        value={`${result.eligible_services}개${result.skipped_services ? ` / 건너뜀 ${result.skipped_services}개` : ""}`}
      />
      <CloudflareDriftSummaryCard label="정상" value={`${result.healthy_services}개`} />
      <CloudflareDriftSummaryCard label="드리프트" value={`${driftCount}개`} />
      <CloudflareDriftSummaryCard label="영역" value={`${result.zone_count}개`} />
    </div>
  );
}

function CloudflareDriftSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/60 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/80">
      <p className="text-gray-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-gray-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
