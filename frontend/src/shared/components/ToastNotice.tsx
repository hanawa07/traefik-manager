import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

export interface ToastNoticeValue {
  detail?: string | null;
  message: string;
  tone: "success" | "warning" | "error";
}

interface ToastNoticeProps {
  notice: ToastNoticeValue | null;
  onClose: () => void;
  timeoutMs?: number;
}

export default function ToastNotice({ notice, onClose, timeoutMs = 5000 }: ToastNoticeProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onClose, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [notice, onClose, timeoutMs]);

  if (!notice) return null;

  return (
    <div className="fixed right-4 top-20 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border bg-white p-4 shadow-2xl dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <ToastIcon tone={notice.tone} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{notice.message}</p>
          {notice.detail ? <p className="mt-1 break-words text-xs text-gray-500 dark:text-slate-300">{notice.detail}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="알림 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ToastIcon({ tone }: { tone: ToastNoticeValue["tone"] }) {
  const className = "mt-0.5 h-4 w-4 shrink-0";
  if (tone === "success") return <CheckCircle2 className={`${className} text-emerald-600`} />;
  if (tone === "warning") return <AlertTriangle className={`${className} text-amber-600`} />;
  return <AlertTriangle className={`${className} text-rose-600`} />;
}
