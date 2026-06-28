import { Cloud } from "lucide-react";

import type {
  CloudflareDriftCheckResult,
  CloudflareSettingsStatus,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { CloudflareDnsActionHistory } from "@/features/settings/components/CloudflareDnsActionHistory";
import { CloudflareZoneList } from "@/features/settings/components/CloudflareZoneList";
import {
  SettingsActionRow,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";

interface CloudflareDnsSummaryProps {
  canManage: boolean;
  status?: CloudflareSettingsStatus;
  isTesting: boolean;
  isDiagnosing: boolean;
  isReconciling: boolean;
  isHistoryLoading: boolean;
  timezone?: string;
  testHistory?: SettingsTestHistoryItem | null;
  driftHistory?: SettingsTestHistoryItem | null;
  reconcileHistory?: SettingsTestHistoryItem | null;
  testResult: SettingsActionTestResult | null;
  driftResult: CloudflareDriftCheckResult | null;
  reconcileResult: SettingsActionTestResult | null;
  onTest: () => void;
  onDiagnose: () => void;
  onReconcile: () => void;
}

export function CloudflareDnsSummary({
  canManage,
  status,
  isTesting,
  isDiagnosing,
  isReconciling,
  isHistoryLoading,
  timezone,
  testHistory,
  driftHistory,
  reconcileHistory,
  testResult,
  driftResult,
  reconcileResult,
  onTest,
  onDiagnose,
  onReconcile,
}: CloudflareDnsSummaryProps) {
  return (
    <SettingsSummary>
      <p className={`text-sm font-medium ${status?.enabled ? "text-green-700" : "text-gray-600"}`}>
        {status?.enabled ? "활성화됨" : "비활성화됨"}
      </p>
      <p className="text-xs text-gray-500 mt-1">{status?.message}</p>
      <div className="pt-1">
        <SettingsSummaryRow label="설정된 영역 수" value={`${status?.zone_count ?? 0}개`} />
        <SettingsSummaryRow label="적용 범위" value="Cloudflare zone과 일치하는 도메인만 자동 연동" />
        <SettingsSummaryRow label="비Cloudflare 도메인" value="자동 제외 후 진단 결과에 표시" />
      </div>
      {status?.zones?.length ? <CloudflareZoneList status={status} /> : null}
      {canManage ? (
        <SettingsActionRow>
          <CloudflareActionButton label="연결 테스트" busyLabel="테스트 중..." isBusy={isTesting} onClick={onTest} />
          <CloudflareActionButton
            label="드리프트 진단"
            busyLabel="진단 중..."
            isBusy={isDiagnosing}
            onClick={onDiagnose}
          />
          <CloudflareActionButton
            label="DNS 재동기화"
            busyLabel="재동기화 중..."
            isBusy={isReconciling}
            onClick={onReconcile}
          />
        </SettingsActionRow>
      ) : null}
      <p className="text-xs text-gray-500">
        테스트, 드리프트 진단, 재동기화는 현재 저장된 Cloudflare zone 목록 기준으로 수행됩니다.
      </p>
      <CloudflareDnsActionHistory
        isHistoryLoading={isHistoryLoading}
        timezone={timezone}
        testHistory={testHistory}
        driftHistory={driftHistory}
        reconcileHistory={reconcileHistory}
        testResult={testResult}
        driftResult={driftResult}
        reconcileResult={reconcileResult}
      />
    </SettingsSummary>
  );
}

function CloudflareActionButton({
  label,
  busyLabel,
  isBusy,
  onClick,
}: {
  label: string;
  busyLabel: string;
  isBusy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
      onClick={onClick}
      disabled={isBusy}
    >
      <Cloud className="h-3.5 w-3.5" />
      {isBusy ? busyLabel : label}
    </button>
  );
}
