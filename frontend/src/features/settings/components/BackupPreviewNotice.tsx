import type { BackupPreviewGroup, BackupPreviewResult } from "@/features/settings/api/settingsApi";
import { formatBackupPreviewResult } from "@/features/settings/hooks/backupImportActionHelpers";

function BackupPreviewGroupList({
  title,
  colorClass,
  items,
}: {
  title: string;
  colorClass: string;
  items: BackupPreviewGroup["creates"];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-700 dark:text-slate-300">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colorClass}`}>{items.length}개</span>
      </div>
      {items.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          <ul className="space-y-1 text-xs text-gray-700 dark:text-slate-300">
            {items.map((item) => (
              <li key={`${title}-${item.domain}`} className="flex flex-col">
                <span className="font-medium">{item.name ?? item.domain}</span>
                {item.name ? (
                  <span className="font-mono text-[11px] text-gray-500 dark:text-slate-500">{item.domain}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-slate-500">없음</p>
      )}
    </div>
  );
}

export default function BackupPreviewNotice({ result }: { result: BackupPreviewResult | null }) {
  if (!result) return null;

  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
      <div>
        <p className="font-medium">복원 미리보기: {formatBackupPreviewResult(result)}</p>
        <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
          {result.mode === "overwrite"
            ? "덮어쓰기 모드라 기존 항목 삭제 후 백업 내용을 새로 생성합니다."
            : "병합 모드라 기존 항목은 유지하고 같은 도메인만 수정합니다."}
        </p>
      </div>

      {result.warning_count ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-xs font-medium">사전 경고 {result.warning_count}개</p>
          <ul className="mt-2 space-y-1 text-xs">
            {result.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-100/40 p-3 dark:border-slate-700 dark:bg-slate-950/70">
          <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">서비스 변경</p>
          <BackupPreviewGroupList
            title="생성"
            colorClass="bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200"
            items={result.services.creates}
          />
          <BackupPreviewGroupList
            title="수정"
            colorClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100"
            items={result.services.updates}
          />
          <BackupPreviewGroupList
            title="삭제"
            colorClass="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
            items={result.services.deletes}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-100/40 p-3 dark:border-slate-700 dark:bg-slate-950/70">
          <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">리다이렉트 변경</p>
          <BackupPreviewGroupList
            title="생성"
            colorClass="bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200"
            items={result.redirect_hosts.creates}
          />
          <BackupPreviewGroupList
            title="수정"
            colorClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100"
            items={result.redirect_hosts.updates}
          />
          <BackupPreviewGroupList
            title="삭제"
            colorClass="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
            items={result.redirect_hosts.deletes}
          />
        </div>
      </div>
    </div>
  );
}
