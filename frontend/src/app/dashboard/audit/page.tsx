"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { AuditFeedbackBanner } from "./AuditFeedbackBanner";
import { AuditLogFilters } from "./AuditLogFilters";
import { AuditLogPageHeader } from "./AuditLogPageHeader";
import { AuditLogTable } from "./AuditLogTable";
import { useAuditLogPageModel } from "./useAuditLogPageModel";

export default function AuditLogPage() {
  const { deliveryFeedback, errorMessage, filters, isError, isLoading, rollbackFeedback, table } =
    useAuditLogPageModel();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p>감사 로그를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center text-red-400">
        <AlertCircle className="mb-4 h-12 w-12 opacity-20" />
        <h3 className="mb-2 text-lg font-semibold">로그 로딩 오류</h3>
        <p className="max-w-md text-sm text-red-400/70">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <AuditLogPageHeader />

      <AuditLogFilters {...filters} />

      <AuditFeedbackBanner feedback={rollbackFeedback} />
      <AuditFeedbackBanner feedback={deliveryFeedback} />

      <AuditLogTable {...table} />
    </div>
  );
}
