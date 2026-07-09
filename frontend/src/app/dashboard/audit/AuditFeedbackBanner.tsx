import { clsx } from "clsx";

interface AuditFeedbackBannerProps {
  feedback: { type: "success" | "error"; text: string } | null;
}

export function AuditFeedbackBanner({ feedback }: AuditFeedbackBannerProps) {
  if (!feedback) return null;

  return (
    <div
      className={clsx(
        "mb-4 rounded-xl border px-4 py-3 text-sm",
        feedback.type === "success"
          ? "border-green-200 bg-green-50 text-green-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
      )}
    >
      {feedback.text}
    </div>
  );
}
