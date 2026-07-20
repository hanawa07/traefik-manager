import { Download } from "lucide-react";

import { getSmokeArtifactExpiryState } from "@/shared/lib/smokeArtifactExpiry";

interface SmokeArtifactLinkProps {
  artifactUrl: string;
  expiresAt: string | null;
  label: string;
  expiredLabel: string;
  referenceTime: number;
  testId?: string;
  expiredTestId: string;
}

export function SmokeArtifactLink({
  artifactUrl,
  expiresAt,
  label,
  expiredLabel,
  referenceTime,
  testId,
  expiredTestId,
}: SmokeArtifactLinkProps) {
  if (getSmokeArtifactExpiryState(expiresAt, referenceTime) === "expired") {
    return (
      <span
        aria-disabled="true"
        className="cursor-not-allowed font-medium text-slate-500 line-through dark:text-slate-400"
        data-testid={expiredTestId}
        title="보관 기간이 끝나 실패 화면을 다운로드할 수 없습니다"
      >
        {expiredLabel}
      </span>
    );
  }

  return (
    <a
      className="inline-flex items-center gap-1 font-medium text-rose-700 underline-offset-2 hover:underline dark:text-rose-300"
      data-testid={testId}
      href={artifactUrl}
      target="_blank"
      rel="noreferrer"
      title="GitHub 로그인 후 실패 화면 ZIP 다운로드"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
