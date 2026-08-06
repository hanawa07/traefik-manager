function formatCount(value: unknown): string {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? `${value}건`
    : "-";
}

export function getSmokeFailureMetadataCleanupDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (event !== "smoke_failure_metadata_cleanup" || !detail) return [];

  const requestedRunIds = Array.isArray(detail.requested_run_ids)
    ? detail.requested_run_ids
        .filter((value): value is number => Number.isInteger(value) && Number(value) > 0)
    : [];

  return [
    {
      key: "requested_run_ids",
      label: "요청 실행 번호",
      links: requestedRunIds.map((runId) => ({
        href: getSmokeFailureRunHistoryUrl(runId),
        label: `#${runId}`,
        testId: "smoke-failure-run-history-link",
      })),
      value: requestedRunIds.map((runId) => `#${runId}`),
    },
    {
      key: "deleted_count",
      label: "삭제한 실패 정보",
      value: formatCount(detail.deleted_count),
    },
    {
      key: "retained_count",
      label: "남은 실패 정보",
      value: formatCount(detail.retained_count),
    },
    {
      key: "client_ip",
      label: "요청 IP",
      value: detail.client_ip,
    },
  ];
}

export function getSmokeFailureRunHistoryUrl(runId: number): string {
  const query = new URLSearchParams({
    smoke_search: String(runId),
    smoke_status: "failure",
  });
  return `/dashboard/settings?${query.toString()}#smoke-recent-run-history`;
}
