import { Cloud } from "lucide-react";

import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";

interface CloudflareDnsActionButtonsProps {
  isTesting: boolean;
  isDiagnosing: boolean;
  isReconciling: boolean;
  onTest: () => void;
  onDiagnose: () => void;
  onReconcile: () => void;
}

export function CloudflareDnsActionButtons({
  isTesting,
  isDiagnosing,
  isReconciling,
  onTest,
  onDiagnose,
  onReconcile,
}: CloudflareDnsActionButtonsProps) {
  return (
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
