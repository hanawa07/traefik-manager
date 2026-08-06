import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";

export function downloadSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  timezone?: string,
  scope: "all" | "selected" = "all",
): string {
  const exportedAt = new Date().toISOString();
  const content = JSON.stringify(
    {
      metadata: {
        exported_at: exportedAt,
        result_count: entries.length,
        schema_version: 1,
        scope,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
      entries,
    },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `traefik-manager-smoke-failure-metadata-${scope}-${exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return link.download;
}
