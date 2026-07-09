import { AlertTriangle, X } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import StatusBadge from "@/shared/components/StatusBadge";

const REPEATED_FAILURE_BADGE_CLASS =
  "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
const CLOSE_BUTTON_CLASS =
  "rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600 dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-500 dark:hover:text-slate-200";

interface CertificateDetailDrawerHeaderProps {
  certificate: Certificate;
  onClose: () => void;
}

export default function CertificateDetailDrawerHeader({
  certificate,
  onClose,
}: CertificateDetailDrawerHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-slate-800">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-500">
          Certificate Detail
        </p>
        <h2 className="mt-2 truncate text-xl font-semibold text-gray-900 dark:text-slate-100">
          {certificate.domain}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={certificate.status} />
          <span className="text-sm text-gray-500 dark:text-slate-400">{certificate.status_message}</span>
          {certificate.preflight_repeated_failure_active ? (
            <span className={REPEATED_FAILURE_BADGE_CLASS}>
              <AlertTriangle className="h-3.5 w-3.5" />
              반복 실패 x{certificate.preflight_failure_streak}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={CLOSE_BUTTON_CLASS}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
