const FAILURE_SECRET_PATTERN = /GitHub secret 갱신 실패:\s+([^\s(]+)/;
const ATTEMPT_PATTERN = /\(시도\s+(\d+\/\d+)\)/;
const FAILURE_KIND_LABELS: Record<string, string> = {
  account_update: "계정 비밀번호 변경",
  smoke_validation: "로그인·API·화면 검증",
  execution: "운영 점검 실행",
};

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
      label: "점검 결과",
      value: event === "smoke_rotation_succeeded" ? "성공" : "실패",
    },
  ];
  const step = typeof detail.step === "string" ? detail.step : "";
  if (event === "smoke_rotation_failed" && step) {
    const failureKind = typeof detail.failure_kind === "string" ? detail.failure_kind : "";
    rows.push(
      { key: "failure_kind", label: "실패 유형", value: FAILURE_KIND_LABELS[failureKind] },
      { key: "failed_secret", label: "실패 Secret", value: step.match(FAILURE_SECRET_PATTERN)?.[1] },
      { key: "attempts", label: "시도 횟수", value: step.match(ATTEMPT_PATTERN)?.[1] },
      { key: "step", label: "실패 단계", value: step },
    );
  }
  return rows.filter((row) => row.value !== undefined && row.value !== "");
}
