import assert from "node:assert/strict";

import { fetchJsonReadWithRetry } from "./dashboard-visual-runtime.mjs";

const CHECKS = [
  {
    label: "애플리케이션 헬스",
    path: "/api/health",
    validate: (data) => data?.status === "정상",
  },
  {
    label: "현재 세션",
    path: "/api/v1/auth/me",
    validate: (data) => typeof data?.username === "string" && typeof data?.role === "string",
  },
  {
    label: "서비스 목록",
    path: "/api/v1/services",
    validate: Array.isArray,
  },
  {
    label: "라우터 상태",
    path: "/api/v1/traefik/routers",
    validate: (data) => typeof data?.connected === "boolean" && typeof data?.domains === "object",
  },
  {
    label: "서비스 헬스",
    path: "/api/v1/services/health/all",
    validate: (data) => data && typeof data === "object" && !Array.isArray(data),
  },
  {
    label: "인증서 목록",
    path: "/api/v1/certificates",
    validate: Array.isArray,
  },
  {
    label: "시간 표시 설정",
    path: "/api/v1/settings/time-display",
    validate: (data) => typeof data?.display_timezone === "string",
  },
  {
    label: "스모크 회전 상태",
    path: "/api/v1/settings/smoke-rotation?summary=true",
    validate: (data) =>
      ["never", "running", "success", "failure"].includes(data?.status) &&
      typeof data?.is_stale === "boolean" &&
      data?.stale_after_days === 35 &&
      typeof data?.monitoring_enabled === "boolean" &&
      ["daily", "weekly"].includes(data?.monitoring_frequency) &&
      typeof data?.monitoring_admin_is_stale === "boolean" &&
      data?.monitoring_admin_stale_after_days ===
        (data?.monitoring_frequency === "weekly" ? 8 : 2),
    failureMessage: (data) =>
      data?.is_stale
        ? `스모크 계정 자동 회전이 ${data.stale_after_days}일 이상 성공하지 않았습니다`
        : null,
  },
  {
    label: "병목 이벤트 정리 미리보기",
    path: "/api/v1/settings/deployment-bottleneck-alert/cleanup",
    validate: (data) =>
      Number.isInteger(data?.retention_days) &&
      Number.isInteger(data?.deleted_count) &&
      Number.isInteger(data?.retained_event_count),
  },
  {
    label: "서비스 진단 감사 로그",
    path: "/api/v1/audit?event=service_gateway_diagnosis&limit=100&resource_type=service",
    validate: Array.isArray,
  },
];

export async function runSmokeServicesApiChecks(cdp) {
  const results = [];
  for (const check of CHECKS) {
    const result = await fetchJsonReadWithRetry(cdp, check.path);
    if (!result.ok) {
      throw new Error(`${check.label} API GET ${check.path} HTTP ${result.status}: ${result.text}`);
    }
    if (!check.validate(result.data)) {
      throw new Error(`${check.label} API 응답 형식이 예상과 다릅니다`);
    }
    const failureMessage = check.failureMessage?.(result.data);
    if (failureMessage) {
      throw new Error(failureMessage);
    }
    results.push({ ...check, data: result.data });
  }
  return results;
}

export function runSmokeServicesApiChecksSelfTest() {
  const rotationCheck = CHECKS.find((check) => check.label === "스모크 회전 상태");
  assert.match(rotationCheck.failureMessage({ is_stale: true, stale_after_days: 35 }), /35일/);
  assert.equal(rotationCheck.failureMessage({ is_stale: false, stale_after_days: 35 }), null);
}
