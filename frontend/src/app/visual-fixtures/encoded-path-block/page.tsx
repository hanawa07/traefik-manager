import { notFound } from "next/navigation";

import { TraefikEncodedPathBlockCard } from "@/app/dashboard/TraefikEncodedPathBlockCard";
import type { TraefikEncodedPathBlockSummary } from "@/features/traefik/api/traefikApi";

export const dynamic = "force-dynamic";

const BLOCK_COUNTS = [0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 2, 1];
const CHECKED_AT = new Date("2026-08-01T12:00:00Z");

const summary: TraefikEncodedPathBlockSummary = {
  available: true,
  collection_available: true,
  message: "최근 24시간 동안 인코딩된 예약 문자 경로 11건을 차단했습니다",
  checked_at: CHECKED_AT.toISOString(),
  window_hours: 24,
  observed_since: "2026-07-31T16:00:00Z",
  sample_coverage_percent: 83,
  tail_lines: 2000,
  observed_log_lines: 1842,
  blocked_request_count: 11,
  last_blocked_at: "2026-08-01T11:42:13Z",
  encoded_characters: [
    { encoded: "%2F", label: "슬래시 (/)", request_count: 7 },
    { encoded: "%5C", label: "백슬래시 (\\)", request_count: 3 },
    { encoded: "%00", label: "NUL", request_count: 1 },
  ],
  buckets: BLOCK_COUNTS.map((blockedRequestCount, index) => ({
    started_at: new Date(CHECKED_AT.getTime() - (24 - index) * 60 * 60 * 1000).toISOString(),
    blocked_request_count: blockedRequestCount,
  })),
};

export default function EncodedPathBlockVisualFixturePage() {
  if (process.env.VISUAL_FIXTURES_ENABLED !== "1") {
    notFound();
  }

  return (
    <main className="dark min-h-screen bg-slate-950 p-4 text-slate-100" data-visual-fixture="encoded-path-block">
      <div className="mx-auto max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
          unauthenticated visual fixture · mobile dark
        </p>
        <TraefikEncodedPathBlockCard
          isError={false}
          isLoading={false}
          summary={summary}
          timezone="Asia/Seoul"
        />
      </div>
    </main>
  );
}
