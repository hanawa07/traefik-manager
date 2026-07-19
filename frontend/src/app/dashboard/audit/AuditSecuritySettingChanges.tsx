import { ArrowRight, ShieldCheck } from "lucide-react";

import { getAuditSecuritySettingChanges } from "@/features/audit/lib/auditSecuritySettingChanges";

import type { getAuditDiffRows } from "./auditPageHelpers";

interface AuditSecuritySettingChangesProps {
  event: unknown;
  diffRows: ReturnType<typeof getAuditDiffRows>;
}

export function AuditSecuritySettingChanges({ event, diffRows }: AuditSecuritySettingChangesProps) {
  const changes = getAuditSecuritySettingChanges(event, diffRows);
  if (changes.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-500/25 dark:bg-teal-500/10"
      data-testid="audit-security-setting-changes"
    >
      <div className="mb-3 flex items-center gap-2 text-teal-800 dark:text-teal-200">
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
        <h3 className="text-xs font-bold">보안 설정 변경 요약</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {changes.map((change) => (
          <article
            key={change.key}
            className="rounded-lg border border-white bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/50"
            data-after={change.afterLabel}
            data-before={change.beforeLabel}
            data-change-direction={change.direction ?? undefined}
            data-setting-key={change.key}
          >
            <p className="text-xs font-semibold text-teal-800 dark:text-teal-200">{change.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <strong className="text-slate-900 dark:text-slate-100">{change.beforeLabel}</strong>
              <ArrowRight aria-hidden="true" className="h-4 w-4 text-teal-600 dark:text-teal-300" />
              <strong className="text-slate-900 dark:text-slate-100">{change.afterLabel}</strong>
              {change.deltaLabel ? (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800 dark:bg-teal-500/15 dark:text-teal-200">
                  {change.deltaLabel}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
