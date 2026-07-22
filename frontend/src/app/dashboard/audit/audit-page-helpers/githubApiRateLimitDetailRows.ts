export function getGithubApiRateLimitDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (
    !detail ||
    (event !== "github_api_primary_rate_limit" &&
      event !== "github_api_secondary_rate_limit")
  ) {
    return [];
  }
  const count = detail.occurrence_count;
  return [
    {
      key: "limit_type",
      label: "제한 유형",
      value: event === "github_api_primary_rate_limit" ? "기본 요청 한도" : "보조 요청 제한",
    },
    { key: "occurred_at", label: "최근 발생 시각", value: detail.occurred_at },
    {
      key: "occurrence_count",
      label: "현재 프로세스 누적 발생",
      value: typeof count === "number" ? `${count}회` : count,
    },
    {
      key: "alert_rule",
      label: "운영 알림 판정",
      value:
        typeof detail.alert_threshold === "number" &&
        typeof detail.alert_window_hours === "number"
          ? `${detail.alert_window_hours}시간 내 ${detail.alert_threshold}회${detail.alert_triggered === true ? " · 경고 기준 도달" : ""}`
          : null,
    },
    {
      key: "window_occurrence_count",
      label: "판정 기간 내 발생",
      value:
        typeof detail.window_occurrence_count === "number"
          ? `${detail.window_occurrence_count}회`
          : detail.window_occurrence_count,
    },
    { key: "retry_at", label: "재시도 가능 시각", value: detail.retry_at },
  ].filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
}
