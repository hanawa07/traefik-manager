import type {
  CloudflareDriftCheckResult,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  ActionResultNotice,
  CloudflareDriftNotice,
  SettingsTestHistoryNotice,
} from "@/features/settings/components/SettingsNotices";

interface CloudflareDnsActionHistoryProps {
  isHistoryLoading: boolean;
  timezone?: string;
  testHistory?: SettingsTestHistoryItem | null;
  driftHistory?: SettingsTestHistoryItem | null;
  reconcileHistory?: SettingsTestHistoryItem | null;
  testResult: SettingsActionTestResult | null;
  driftResult: CloudflareDriftCheckResult | null;
  reconcileResult: SettingsActionTestResult | null;
}

export function CloudflareDnsActionHistory({
  isHistoryLoading,
  timezone,
  testHistory,
  driftHistory,
  reconcileHistory,
  testResult,
  driftResult,
  reconcileResult,
}: CloudflareDnsActionHistoryProps) {
  return (
    <>
      {!isHistoryLoading ? (
        <>
          <SettingsTestHistoryNotice label="마지막 연결 테스트" history={testHistory} timezone={timezone} />
          <SettingsTestHistoryNotice label="마지막 드리프트 진단" history={driftHistory} timezone={timezone} />
          <SettingsTestHistoryNotice label="마지막 DNS 재동기화" history={reconcileHistory} timezone={timezone} />
        </>
      ) : null}
      <ActionResultNotice result={testResult} />
      <CloudflareDriftNotice result={driftResult} />
      <ActionResultNotice result={reconcileResult} />
    </>
  );
}
