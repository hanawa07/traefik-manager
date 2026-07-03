import type {
  CloudflareDriftCheckResult,
  CloudflareSettingsStatus,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { CloudflareDnsActionHistory } from "@/features/settings/components/CloudflareDnsActionHistory";
import { CloudflareDnsActionButtons } from "@/features/settings/components/CloudflareDnsActionButtons";
import { CloudflareDnsStatusSummary } from "@/features/settings/components/CloudflareDnsStatusSummary";
import { SettingsSummary } from "@/features/settings/components/SettingsCardPrimitives";

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
      <CloudflareDnsStatusSummary status={status} />
      {canManage ? (
        <CloudflareDnsActionButtons
          isTesting={isTesting}
          isDiagnosing={isDiagnosing}
          isReconciling={isReconciling}
          onTest={onTest}
          onDiagnose={onDiagnose}
          onReconcile={onReconcile}
        />
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
