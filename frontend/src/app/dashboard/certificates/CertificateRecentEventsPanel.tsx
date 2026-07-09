import type { AuditCertificateSummary } from "@/features/audit/api/auditApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

const EVENT_ROW_CLASS = [
  "flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950",
  "md:flex-row md:items-center md:justify-between",
].join(" ");

interface CertificateRecentEventsPanelProps {
  certificateSummary: AuditCertificateSummary | undefined;
  timezone?: string;
}

export default function CertificateRecentEventsPanel({
  certificateSummary,
  timezone,
}: CertificateRecentEventsPanelProps) {
  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">최근 상태 전이</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            최근 {formatDurationMinutes(certificateSummary?.window_minutes ?? 43200)} 기준 인증서
            경고/복구 이력입니다.
          </p>
        </div>
        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
          복구 {certificateSummary?.recovered_count ?? 0}건
        </div>
      </div>

      {!certificateSummary?.recent_events?.length ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          최근 인증서 상태 전이가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {certificateSummary.recent_events.map((event) => (
            <div
              key={event.id}
              className={EVENT_ROW_CLASS}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {getCertificateEventLabel(event.event)}
                  <span className="ml-2 font-normal text-gray-600 dark:text-slate-300">{event.resource_name}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {event.previous_status ? `이전 상태 ${event.previous_status} · ` : ""}
                  {event.checked_at
                    ? `검사 ${formatDateTime(event.checked_at, timezone)}`
                    : `기록 ${formatDateTime(event.created_at, timezone)}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-500 dark:text-slate-400">
                {formatDateTime(event.created_at, timezone)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getCertificateEventLabel(event: string) {
  if (event === "certificate_error") return "인증서 만료";
  if (event === "certificate_recovered") return "인증서 복구";
  return "인증서 만료 임박";
}
