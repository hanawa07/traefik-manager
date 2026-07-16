import type { ManagerDeploymentHistoryEntry } from "@/features/deployment/api/deploymentApi";

export function ManagerDeploymentHistoryJsonDetails({
  entry,
}: {
  entry: ManagerDeploymentHistoryEntry;
}) {
  return (
    <details
      className="mt-2 rounded-md border border-gray-200 bg-gray-50/80 text-[11px] dark:border-slate-700 dark:bg-slate-950/70"
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
        {JSON.stringify(entry, null, 2)}
      </pre>
    </details>
  );
}
