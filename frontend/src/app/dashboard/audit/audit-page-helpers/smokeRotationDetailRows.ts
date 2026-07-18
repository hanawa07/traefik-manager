const FAILURE_SECRET_PATTERN = /GitHub secret 갱신 실패:\s+([^\s(]+)/;
const ATTEMPT_PATTERN = /\(시도\s+(\d+\/\d+)\)/;

export function getSmokeRotationDetailRows(
  event: unknown,
  detail: Record<string, unknown> | null,
) {
  if (!detail || (event !== "smoke_rotation_succeeded" && event !== "smoke_rotation_failed")) {
    return [];
  }

  const rows: { key: string; label: string; value: unknown }[] = [
    {
      key: "result",
      label: "회전 결과",
      value: event === "smoke_rotation_succeeded" ? "성공" : "실패",
    },
  ];
  const step = typeof detail.step === "string" ? detail.step : "";
  if (event === "smoke_rotation_failed" && step) {
    rows.push(
      { key: "failed_secret", label: "실패 Secret", value: step.match(FAILURE_SECRET_PATTERN)?.[1] },
      { key: "attempts", label: "시도 횟수", value: step.match(ATTEMPT_PATTERN)?.[1] },
      { key: "step", label: "실패 단계", value: step },
    );
  }
  return rows.filter((row) => row.value !== undefined && row.value !== "");
}
