import type { SmokeFailureMetadata } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SmokeFailureMetadataPreviewProps {
  metadata: SmokeFailureMetadata;
  testId?: string;
  timezone?: string;
}

export function SmokeFailureMetadataPreview({
  metadata,
  testId = "smoke-failure-metadata-preview",
  timezone,
}: SmokeFailureMetadataPreviewProps) {
  return (
    <details
      className="mt-2 rounded-md border border-rose-100 bg-rose-50/70 px-2.5 py-2 dark:border-rose-950 dark:bg-rose-950/30"
      data-testid={testId}
    >
      <summary className="cursor-pointer font-medium text-rose-700 dark:text-rose-300">
        실패 정보 미리보기
      </summary>
      <dl className="mt-2 grid gap-1.5 text-[11px] text-gray-600 dark:text-slate-300">
        <div>
          <dt className="inline font-semibold">검사: </dt>
          <dd className="inline" data-testid="smoke-failure-check-name">{metadata.check_name}</dd>
        </div>
        {metadata.screen_path ? (
          <div>
            <dt className="inline font-semibold">화면: </dt>
            <dd className="inline"><code>{metadata.screen_path}</code></dd>
          </div>
        ) : null}
        {metadata.page_title ? (
          <div>
            <dt className="inline font-semibold">제목: </dt>
            <dd className="inline">{metadata.page_title}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-semibold">기록: </dt>
          <dd className="inline">{formatDateTime(metadata.captured_at, timezone)}</dd>
        </div>
      </dl>
    </details>
  );
}
