"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import type { SmokeFailureMetadataEntry } from "@/features/settings/api/settingsApi";
import {
  DEFAULT_SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME,
  downloadSmokeFailureMetadata,
  normalizeSmokeFailureMetadataExportBaseName,
  SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME_LIMIT,
  type SmokeFailureMetadataExportFilters,
  type SmokeFailureMetadataExportFormat,
  type SmokeFailureMetadataExportScope,
} from "@/features/settings/lib/smokeFailureMetadataExport";

interface SmokeFailureMetadataExportControlsProps {
  filteredEntries: SmokeFailureMetadataEntry[];
  filters: SmokeFailureMetadataExportFilters;
  selectedEntries: SmokeFailureMetadataEntry[];
  timezone?: string;
}

export function SmokeFailureMetadataExportControls({
  filteredEntries,
  filters,
  selectedEntries,
  timezone,
}: SmokeFailureMetadataExportControlsProps) {
  const [filenameBase, setFilenameBase] = useState(
    DEFAULT_SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME,
  );
  const normalizedFilenameBase = normalizeSmokeFailureMetadataExportBaseName(filenameBase);

  const download = (
    entries: SmokeFailureMetadataEntry[],
    format: SmokeFailureMetadataExportFormat,
    scope: SmokeFailureMetadataExportScope,
  ) => {
    downloadSmokeFailureMetadata(entries, {
      filenameBase,
      ...(scope === "filtered" ? { filters } : {}),
      format,
      scope,
      timezone,
    });
  };

  return (
    <section
      className="mt-3 rounded-md border border-gray-200 p-2.5 dark:border-slate-700"
      data-testid="smoke-failure-metadata-export-controls"
    >
      <div className="grid gap-1 sm:max-w-xl">
        <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
          내보내기 파일 이름
          <input
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            data-testid="smoke-failure-metadata-export-filename"
            maxLength={SMOKE_FAILURE_METADATA_EXPORT_BASE_NAME_LIMIT}
            onChange={(event) => setFilenameBase(event.target.value)}
            value={filenameBase}
          />
        </label>
        <p
          className="break-all text-[11px] text-gray-500 dark:text-slate-400"
          data-testid="smoke-failure-metadata-export-filename-preview"
        >
          생성 예: {normalizedFilenameBase}-filtered-YYYY-MM-DD.csv
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ExportButton
          count={filteredEntries.length}
          label="현재 JSON"
          onClick={() => download(filteredEntries, "json", "filtered")}
          testId="smoke-failure-metadata-export"
        />
        <ExportButton
          count={filteredEntries.length}
          label="현재 CSV"
          onClick={() => download(filteredEntries, "csv", "filtered")}
          testId="smoke-failure-metadata-filtered-csv"
        />
        <ExportButton
          count={selectedEntries.length}
          label="선택 JSON"
          onClick={() => download(selectedEntries, "json", "selected")}
          testId="smoke-failure-metadata-selected-export"
        />
        <ExportButton
          count={selectedEntries.length}
          label="선택 CSV"
          onClick={() => download(selectedEntries, "csv", "selected")}
          testId="smoke-failure-metadata-selected-csv"
        />
      </div>
    </section>
  );
}

interface ExportButtonProps {
  count: number;
  label: string;
  onClick: () => void;
  testId: string;
}

function ExportButton({ count, label, onClick, testId }: ExportButtonProps) {
  return (
    <button
      aria-label={`${label} ${count}건 내보내기`}
      className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
      data-testid={testId}
      disabled={!count}
      onClick={onClick}
      type="button"
    >
      <Download className="h-3.5 w-3.5" /> {label} ({count})
    </button>
  );
}
