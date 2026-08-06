import type { SmokeFailureType } from "@/features/settings/api/settingsApi";

export const SMOKE_FAILURE_TYPE_LABELS: Record<SmokeFailureType, string> = {
  external_api: "외부 API",
  login: "로그인",
  visual_regression: "화면 회귀",
};
