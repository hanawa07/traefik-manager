import type { Certificate } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import type { UpstreamHealth } from "../api/serviceApi";
import { getAcmeErrorKindLabel, getHealthErrorKindLabel } from "./serviceCardLabels";

interface ServiceCardHealthDetailsProps {
  upstreamHealth?: UpstreamHealth;
  certificate?: Certificate;
  displayTimeZone?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
}

export default function ServiceCardHealthDetails({
  upstreamHealth,
  certificate,
  displayTimeZone,
  lastSuccessAt,
  lastFailureAt,
}: ServiceCardHealthDetailsProps) {
  if (upstreamHealth?.status === "down" && upstreamHealth.error) {
    return (
      <div className="mt-2 space-y-1 break-words text-[11px] leading-4">
        {certificate ? <p className="text-slate-500 dark:text-slate-400">인증서 상태: {certificate.status_message}</p> : null}
        {getHealthErrorKindLabel(upstreamHealth.error_kind) ? (
          <p className="text-rose-700 dark:text-rose-300">유형: {getHealthErrorKindLabel(upstreamHealth.error_kind)}</p>
        ) : null}
        <p className="text-rose-700 dark:text-rose-300">원인: {upstreamHealth.error}</p>
        <p className="text-slate-500 dark:text-slate-400">확인 시각: {formatDateTime(upstreamHealth.checked_at, displayTimeZone)}</p>
        {lastSuccessAt ? <p className="text-slate-500 dark:text-slate-400">최근 성공: {formatDateTime(lastSuccessAt, displayTimeZone)}</p> : null}
        <p className="truncate text-slate-400 dark:text-slate-500" title={upstreamHealth.checked_url}>
          체크 URL: {upstreamHealth.checked_url}
        </p>
      </div>
    );
  }

  if (upstreamHealth?.status === "unknown") {
    return (
      <div className="mt-2 space-y-1 break-words text-[11px] leading-4">
        {certificate ? <p className="text-slate-500 dark:text-slate-400">인증서 상태: {certificate.status_message}</p> : null}
        <p className="text-slate-500 dark:text-slate-400">
          상태: {upstreamHealth.error === "Health check disabled" ? "헬스 체크 비활성화" : upstreamHealth.error}
        </p>
        <p className="text-slate-500 dark:text-slate-400">확인 시각: {formatDateTime(upstreamHealth.checked_at, displayTimeZone)}</p>
      </div>
    );
  }

  if (upstreamHealth?.status === "up") {
    return (
      <div className="mt-2 space-y-1 break-words text-[11px] leading-4">
        {certificate ? (
          <>
            <p className="text-slate-500 dark:text-slate-400">인증서 상태: {certificate.status_message}</p>
            {certificate.last_acme_error_message ? (
              <p className="text-amber-700 dark:text-amber-200">
                최근 ACME 실패
                {getAcmeErrorKindLabel(certificate.last_acme_error_kind)
                  ? ` (${getAcmeErrorKindLabel(certificate.last_acme_error_kind)})`
                  : ""}
                : {certificate.last_acme_error_message}
              </p>
            ) : null}
          </>
        ) : null}
        <p className="text-slate-500 dark:text-slate-400">확인 시각: {formatDateTime(upstreamHealth.checked_at, displayTimeZone)}</p>
        {lastFailureAt ? <p className="text-slate-500 dark:text-slate-400">최근 실패: {formatDateTime(lastFailureAt, displayTimeZone)}</p> : null}
        <p className="truncate text-slate-400 dark:text-slate-500" title={upstreamHealth.checked_url}>
          체크 URL: {upstreamHealth.checked_url}
        </p>
      </div>
    );
  }

  return null;
}
