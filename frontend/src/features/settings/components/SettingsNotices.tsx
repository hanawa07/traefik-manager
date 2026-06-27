import type {
  BackupPreviewGroup,
  BackupPreviewResult,
  CloudflareDriftCheckResult,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

export function ActionResultNotice({ result }: { result: SettingsActionTestResult | null }) {
  if (!result) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        result.success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <p className="font-medium">{result.message}</p>
      {result.detail ? <p className="mt-1 text-xs opacity-90">{result.detail}</p> : null}
    </div>
  );
}

export function CloudflareDriftNotice({ result }: { result: CloudflareDriftCheckResult | null }) {
  if (!result) return null;

  const groups = [
    {
      title: "누락",
      color: "border-amber-200 bg-amber-50 text-amber-900",
      items: result.missing_records,
    },
    {
      title: "불일치",
      color: "border-red-200 bg-red-50 text-red-900",
      items: result.mismatched_records,
    },
    {
      title: "고아",
      color: "border-violet-200 bg-violet-50 text-violet-900",
      items: result.orphan_records,
    },
  ];

  return (
    <div
      className={`space-y-3 rounded-lg border p-3 text-sm ${
        result.success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div>
        <p className="font-medium">{result.message}</p>
        {result.detail ? <p className="mt-1 text-xs opacity-90">{result.detail}</p> : null}
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">대상 서비스</p>
          <p className="mt-1 font-medium text-gray-900">
            {result.eligible_services}개
            {result.skipped_services ? ` / 건너뜀 ${result.skipped_services}개` : ""}
          </p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">정상</p>
          <p className="mt-1 font-medium text-gray-900">{result.healthy_services}개</p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">드리프트</p>
          <p className="mt-1 font-medium text-gray-900">
            {result.missing_records.length + result.mismatched_records.length + result.orphan_records.length}개
          </p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/70 p-2">
          <p className="text-gray-500">영역</p>
          <p className="mt-1 font-medium text-gray-900">{result.zone_count}개</p>
        </div>
      </div>
      {result.zones.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {result.zones.map((zone) => (
            <div
              key={zone.zone_name}
              className="rounded-lg border border-white/60 bg-white/70 p-3 text-xs text-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-gray-900">{zone.zone_name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  대상 {zone.eligible_services}개
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">정상</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.healthy_services}개</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">누락</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.missing_records.length}개</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">불일치</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.mismatched_records.length}개</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="text-gray-500">고아</p>
                  <p className="mt-1 font-medium text-gray-900">{zone.orphan_records.length}개</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {result.excluded_services.length ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-900">비Cloudflare 도메인 제외</p>
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-700">
              {result.excluded_services.length}개
            </span>
          </div>
          <ul className="space-y-2">
            {result.excluded_services.slice(0, 5).map((item) => (
              <li key={item.domain} className="rounded-md border border-slate-200 bg-white p-2">
                <p className="font-mono text-[11px] font-medium text-slate-900">{item.domain}</p>
                <p className="mt-1 text-[11px] text-slate-600">{item.reason}</p>
              </li>
            ))}
            {result.excluded_services.length > 5 ? (
              <li className="text-[11px] text-slate-500">외 {result.excluded_services.length - 5}개 더 있음</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {!result.success ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title} className={`rounded-lg border p-3 text-xs ${group.color}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{group.title}</p>
                <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">{group.items.length}개</span>
              </div>
              {group.items.length ? (
                <ul className="mt-2 space-y-2">
                  {group.items.slice(0, 5).map((item) => (
                    <li
                      key={`${group.title}-${item.domain}`}
                      className="rounded-md border border-white/60 bg-white/60 p-2"
                    >
                      <p className="font-mono text-[11px] font-medium">{item.domain}</p>
                      <p className="mt-1 break-all text-[11px] opacity-90">{item.detail}</p>
                    </li>
                  ))}
                  {group.items.length > 5 ? (
                    <li className="text-[11px] opacity-80">외 {group.items.length - 5}개 더 있음</li>
                  ) : null}
                </ul>
              ) : (
                <p className="mt-2 opacity-80">없음</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsTestHistoryNotice({
  label,
  history,
  timezone,
  onRetry,
  isRetrying = false,
}: {
  label: string;
  history: SettingsTestHistoryItem | null | undefined;
  timezone?: string;
  onRetry?: (() => void) | null;
  isRetrying?: boolean;
}) {
  if (!history?.last_event) {
    return <p className="text-xs text-gray-500">{label}: 아직 기록이 없습니다.</p>;
  }

  return (
    <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p>
            {label}:{" "}
            <span className={history.last_success ? "font-medium text-green-700" : "font-medium text-red-700"}>
              {history.last_success ? "성공" : "실패"}
            </span>
          </p>
          <p>시각: {history.last_created_at ? formatDateTime(history.last_created_at, timezone) : "-"}</p>
          <p>메시지: {history.last_message || "-"}</p>
        </div>
        {onRetry && history.last_failure_audit_id ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className={[
              "rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800",
              "transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60",
            ].join(" ")}
          >
            {isRetrying ? "재시도 중..." : "마지막 실패 재시도"}
          </button>
        ) : null}
      </div>
      {history.last_provider ? <p>채널: {history.last_provider}</p> : null}
      {history.last_success_at ? <p>최근 성공: {formatDateTime(history.last_success_at, timezone)}</p> : null}
      {history.last_failure_at ? <p>최근 실패: {formatDateTime(history.last_failure_at, timezone)}</p> : null}
      {history.recent_failure_count > 0 ? <p>최근 24시간 실패: {history.recent_failure_count}회</p> : null}
      {history.last_failure_provider ? <p>최근 실패 채널: {history.last_failure_provider}</p> : null}
      {history.last_failure_message ? <p>최근 실패 메시지: {history.last_failure_message}</p> : null}
      {history.last_failure_detail ? <p className="text-gray-500">실패 상세: {history.last_failure_detail}</p> : null}
      {history.last_detail ? <p className="text-gray-500">{history.last_detail}</p> : null}
    </div>
  );
}

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
        <p className="text-xs font-medium text-gray-700">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colorClass}`}>{items.length}개</span>
      </div>
      {items.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-2">
          <ul className="space-y-1 text-xs text-gray-700">
            {items.map((item) => (
              <li key={`${title}-${item.domain}`} className="flex flex-col">
                <span className="font-medium">{item.name ?? item.domain}</span>
                {item.name ? <span className="font-mono text-[11px] text-gray-500">{item.domain}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-400">없음</p>
      )}
    </div>
  );
}

export function BackupPreviewNotice({ result }: { result: BackupPreviewResult | null }) {
  if (!result) return null;

  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <div>
        <p className="font-medium">
          복원 미리보기: 서비스 {result.service_count}개, 리다이렉트 {result.redirect_count}개
        </p>
        <p className="mt-1 text-xs text-blue-800">
          {result.mode === "overwrite"
            ? "덮어쓰기 모드라 기존 항목 삭제 후 백업 내용을 새로 생성합니다."
            : "병합 모드라 기존 항목은 유지하고 같은 도메인만 수정합니다."}
        </p>
      </div>

      {result.warning_count ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <p className="text-xs font-medium">사전 경고 {result.warning_count}개</p>
          <ul className="mt-2 space-y-1 text-xs">
            {result.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-100/40 p-3">
          <p className="text-xs font-semibold text-blue-900">서비스 변경</p>
          <BackupPreviewGroupList title="생성" colorClass="bg-green-100 text-green-700" items={result.services.creates} />
          <BackupPreviewGroupList title="수정" colorClass="bg-amber-100 text-amber-700" items={result.services.updates} />
          <BackupPreviewGroupList title="삭제" colorClass="bg-red-100 text-red-700" items={result.services.deletes} />
        </div>

        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-100/40 p-3">
          <p className="text-xs font-semibold text-blue-900">리다이렉트 변경</p>
          <BackupPreviewGroupList
            title="생성"
            colorClass="bg-green-100 text-green-700"
            items={result.redirect_hosts.creates}
          />
          <BackupPreviewGroupList
            title="수정"
            colorClass="bg-amber-100 text-amber-700"
            items={result.redirect_hosts.updates}
          />
          <BackupPreviewGroupList
            title="삭제"
            colorClass="bg-red-100 text-red-700"
            items={result.redirect_hosts.deletes}
          />
        </div>
      </div>
    </div>
  );
}
