import type { CloudflareDriftCheckResult } from "@/features/settings/api/settingsApi";

import { CloudflareDriftRecordGroups } from "./CloudflareDriftRecordGroups";
import { CloudflareDriftSummaryCards } from "./CloudflareDriftSummaryCards";
import { CloudflareDriftZonesList } from "./CloudflareDriftZonesList";
import { CloudflareExcludedServicesList } from "./CloudflareExcludedServicesList";

export default function CloudflareDriftNotice({
  result,
}: {
  result: CloudflareDriftCheckResult | null;
}) {
  if (!result) return null;

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

      <CloudflareDriftSummaryCards result={result} />
      <CloudflareDriftZonesList zones={result.zones} />
      <CloudflareExcludedServicesList excludedServices={result.excluded_services} />
      <CloudflareDriftRecordGroups result={result} />
    </div>
  );
}
