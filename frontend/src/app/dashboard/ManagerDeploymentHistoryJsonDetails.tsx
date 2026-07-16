import { Copy } from "lucide-react";

import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

export function ManagerDeploymentHistoryJsonDetails({
  entry,
  onCopy,
}: {
  entry: ManagerDeploymentHistoryEntry;
  onCopy: (label: string, value: string) => void;
}) {
  const json = JSON.stringify(entry, null, 2);

  return (
    <div className="mt-2 flex items-start gap-2">
      <details
        className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50/80 text-[11px] dark:border-slate-700 dark:bg-slate-950/70"
        data-deployment-json-details
      >
        <summary
          className="cursor-pointer select-none px-2 py-1.5 font-semibold text-gray-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-200"
          data-deployment-json-toggle
        >
          상세 JSON 보기
        </summary>
        <pre
          className="max-h-72 overflow-auto border-t border-gray-200 px-2 py-2 font-mono leading-relaxed whitespace-pre-wrap break-all text-gray-700 dark:border-slate-700 dark:text-slate-200"
          data-deployment-json
        >
          {json}
        </pre>
      </details>
      <button
        aria-label="상세 JSON 복사"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
        data-deployment-copy="json"
        onClick={() => onCopy("상세 JSON", json)}
        type="button"
      >
        <Copy aria-hidden="true" className="h-3 w-3" />
        JSON 복사
      </button>
    </div>
  );
}
