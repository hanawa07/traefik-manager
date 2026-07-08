"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import type { ServiceGatewayDiagnosis } from "../api/serviceApi";

interface ServiceCardDiagnosisHistoryProps {
  history?: ServiceGatewayDiagnosis[];
  displayTimeZone?: string | null;
}

export default function ServiceCardDiagnosisHistory({
  displayTimeZone,
  history = [],
}: ServiceCardDiagnosisHistoryProps) {
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  if (history.length === 0) return null;

  const issueCount = history.filter(isIssueDiagnosis).length;
  const visibleHistory = showIssuesOnly ? history.filter(isIssueDiagnosis) : history;

  return (
    <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
      <summary className="cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-200">
        최근 진단 이력 {history.length}회{issueCount > 0 ? ` · 문제 ${issueCount}회` : ""}
      </summary>
      {issueCount > 0 ? (
        <button
          className="mt-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          type="button"
          onClick={() => setShowIssuesOnly((current) => !current)}
        >
          {showIssuesOnly ? "전체 보기" : "문제만 보기"}
        </button>
      ) : null}
      <div className="mt-2 space-y-2">
        {visibleHistory.map((diagnosis) => (
          <div
            className="rounded-lg border border-white/80 bg-white/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/80"
            key={`${diagnosis.checked_at}-${diagnosis.status}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={getStatusClassName(diagnosis.status)}>{getStatusLabel(diagnosis.status)}</span>
              <span className="shrink-0 text-[11px] text-slate-400">
                {formatDateTime(diagnosis.checked_at, displayTimeZone)}
              </span>
            </div>
            <p className="mt-1 break-words text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {diagnosis.summary}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function isIssueDiagnosis(diagnosis: ServiceGatewayDiagnosis) {
  return diagnosis.status !== "ok";
}

function getStatusLabel(status: ServiceGatewayDiagnosis["status"]) {
  if (status === "ok") return "정상";
  if (status === "warning") return "확인 필요";
  return "문제 있음";
}

function getStatusClassName(status: ServiceGatewayDiagnosis["status"]) {
  const base = "rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (status === "ok") return `${base} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300`;
  if (status === "warning") return `${base} bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300`;
  return `${base} bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300`;
}
