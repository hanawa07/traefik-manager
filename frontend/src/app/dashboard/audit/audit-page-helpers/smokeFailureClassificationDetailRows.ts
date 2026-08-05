const FAILURE_TYPE_LABELS: Record<string, string> = {
  login: "로그인",
  external_api: "외부 API",
  visual_regression: "화면 회귀",
};

export function getSmokeFailureClassificationDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (event !== "smoke_failure_classified" || !detail) return [];

  return [
    {
      key: "before_failure_type",
      label: "변경 전 유형",
      value: formatFailureType(detail.before_failure_type),
    },
    {
      key: "after_failure_type",
      label: "변경 후 유형",
      value: formatFailureType(detail.after_failure_type),
    },
  ];
}

function formatFailureType(value: unknown) {
  if (value === null || value === undefined || value === "unclassified") return "미분류";
  return typeof value === "string" ? (FAILURE_TYPE_LABELS[value] ?? value) : "-";
}
