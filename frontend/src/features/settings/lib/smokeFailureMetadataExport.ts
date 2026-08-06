import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";

const CSV_COLUMNS = [
  "run_id",
  "failure_type",
  "captured_at",
  "check_name",
  "screen_path",
  "page_title",
] as const satisfies readonly (keyof SmokeFailureMetadataEntry)[];

export type SmokeFailureMetadataExportFormat = "csv" | "json";
export type SmokeFailureMetadataExportScope = "all" | "selected";

interface SmokeFailureMetadataExportOptions {
  exportedAt?: string;
  format: SmokeFailureMetadataExportFormat;
  scope: SmokeFailureMetadataExportScope;
  timezone?: string;
}

export function buildSmokeFailureMetadataExport(
  entries: SmokeFailureMetadataEntry[],
  options: SmokeFailureMetadataExportOptions,
): { content: string; filename: string; mimeType: string } {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const extension = options.format;
  const content = options.format === "csv"
    ? buildCsv(entries)
    : JSON.stringify(
        {
          metadata: {
            exported_at: exportedAt,
            result_count: entries.length,
            schema_version: 1,
            scope: options.scope,
            timezone:
              options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          },
          entries,
        },
        null,
        2,
      );
  return {
    content,
    filename: `traefik-manager-smoke-failure-metadata-${options.scope}-${exportedAt.slice(0, 10)}.${extension}`,
    mimeType:
      options.format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  };
}

export function downloadSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  timezone?: string,
  scope: SmokeFailureMetadataExportScope = "all",
  format: SmokeFailureMetadataExportFormat = "json",
): string {
  const exported = buildSmokeFailureMetadataExport(entries, { format, scope, timezone });
  const url = URL.createObjectURL(new Blob([exported.content], { type: exported.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = exported.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return link.download;
}

function buildCsv(entries: SmokeFailureMetadataEntry[]): string {
  const rows = entries.map((entry) => CSV_COLUMNS.map((column) => entry[column]));
  return `\uFEFF${[CSV_COLUMNS, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\r\n")}\r\n`;
}

function toCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
