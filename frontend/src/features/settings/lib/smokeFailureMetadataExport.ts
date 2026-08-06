import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";
import type {
  SmokeFailureMetadataPeriodFilter,
  SmokeFailureMetadataSort,
  SmokeFailureMetadataTypeFilter,
} from "@/features/settings/lib/smokeFailureMetadataFilters";

const CSV_COLUMNS = [
  "run_id",
  "failure_type",
  "captured_at",
  "check_name",
  "screen_path",
  "page_title",
] as const satisfies readonly (keyof SmokeFailureMetadataEntry)[];

const CSV_FILTER_COLUMNS = [
  "filter_type",
  "filter_period",
  "filter_start_date",
  "filter_end_date",
  "filter_timezone",
  "filter_query",
  "filter_sort",
] as const;

export type SmokeFailureMetadataExportFormat = "csv" | "json";
export type SmokeFailureMetadataExportScope = "all" | "filtered" | "selected";
export const DEFAULT_SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME =
  "traefik-manager-smoke-failure-metadata";
export const SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME_LIMIT = 80;
export const SMOKE_FAILURE_METADATA_EXPORT_FILENAME_STORAGE_KEY =
  "traefik-manager:smoke-failure-metadata-export-filename";

export interface SmokeFailureMetadataExportFilters {
  end_date: string;
  period: SmokeFailureMetadataPeriodFilter;
  query: string;
  sort: SmokeFailureMetadataSort;
  start_date: string;
  type: SmokeFailureMetadataTypeFilter;
}

export interface SmokeFailureMetadataExportOptions {
  exportedAt?: string;
  filenameBase?: string;
  filters?: SmokeFailureMetadataExportFilters;
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
  const timezone =
    options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const content = options.format === "csv"
    ? buildCsv(entries, options.filters, timezone)
    : JSON.stringify(
        {
          metadata: {
            exported_at: exportedAt,
            result_count: entries.length,
            schema_version: 2,
            scope: options.scope,
            ...(options.filters ? { filters: options.filters } : {}),
            timezone,
          },
          entries,
        },
        null,
        2,
      );
  return {
    content,
    filename: `${normalizeSmokeFailureMetadataExportBaseName(options.filenameBase)}-${options.scope}-${exportedAt.slice(0, 10)}.${extension}`,
    mimeType:
      options.format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  };
}

export function normalizeSmokeFailureMetadataExportBaseName(
  value?: string,
): string {
  const normalized = Array.from(
    (value || DEFAULT_SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME)
      .normalize("NFKC")
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/-{2,}/g, "-"),
  )
    .slice(0, SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME_LIMIT)
    .join("")
    .replace(/^[._-]+|[._-]+$/g, "");
  return normalized || DEFAULT_SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME;
}

export function resolveSmokeFailureMetadataExportFilenamePreference(
  value: string | null,
): string {
  if (!value) return DEFAULT_SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME;
  return Array.from(value)
    .slice(0, SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME_LIMIT)
    .join("");
}

export function downloadSmokeFailureMetadata(
  entries: SmokeFailureMetadataEntry[],
  options: Omit<SmokeFailureMetadataExportOptions, "exportedAt">,
): string {
  const exported = buildSmokeFailureMetadataExport(entries, options);
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

function buildCsv(
  entries: SmokeFailureMetadataEntry[],
  filters: SmokeFailureMetadataExportFilters | undefined,
  timezone: string,
): string {
  const filterValues = filters
    ? [
        filters.type,
        filters.period,
        filters.start_date,
        filters.end_date,
        timezone,
        filters.query,
        filters.sort,
      ]
    : ["", "", "", "", "", "", ""];
  const rows = entries.map((entry) => [
    ...CSV_COLUMNS.map((column) => entry[column]),
    ...filterValues,
  ]);
  return `\uFEFF${[[...CSV_COLUMNS, ...CSV_FILTER_COLUMNS], ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\r\n")}\r\n`;
}

function toCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
