import assert from "node:assert/strict";

import { checkAuditBulkOperationFixture, runAuditBulkOperationFixtureSelfTest } from "./dashboard-visual-audit-bulk-operations.mjs";
import { checkAuditDelayedRetryFilter } from "./dashboard-visual-audit-delayed-retry.mjs";
import { checkAuditGithubApiRateLimitTrend } from "./dashboard-visual-audit-github-rate-limit.mjs";
import { checkAuditSecuritySettingChanges } from "./dashboard-visual-audit-security-setting-changes.mjs";
import { checkDeploymentBottleneckSettingsPreview } from "./dashboard-visual-deployment-bottleneck-settings.mjs";
import { checkOptionalDeploymentBottleneckCleanupCancel, runDeploymentBottleneckCleanupSelfTest } from "./dashboard-visual-deployment-bottleneck-cleanup.mjs";
import { checkAuditFilterPersistence, checkCertificateDrawer, checkMobileSidebar, checkOptionalAdminModal } from "./dashboard-visual-interactions.mjs";
import { checkMaintenanceScheduleFixture, runMaintenanceScheduleFixtureSelfTest } from "./dashboard-visual-maintenance-schedule.mjs";
import { checkManagerDeploymentHistory } from "./dashboard-visual-manager-deployment.mjs";
import { checkManagerHttpErrorPreviewForm, checkManagerHttpErrorTrend } from "./dashboard-visual-manager-http.mjs";
import {
  checkVisualRoute,
  evaluateInVisualPage,
  runDashboardVisualPageChecksSelfTest,
  withVisualProfile,
} from "./dashboard-visual-page-checks.mjs";
import { DASHBOARD_ROUTES, VISUAL_PROFILES } from "./dashboard-visual-routes.mjs";
import { checkSecurityAlertRetryDelaySetting } from "./dashboard-visual-security-alert-settings.mjs";
import { checkManualSmokeRunResultPersistence } from "./dashboard-visual-smoke-manual-run.mjs";
import { checkAuditRetryChain, checkSettingsTestAuditLinks, checkSmokeRotationAuditDetail, checkSmokeRunTrendRange } from "./dashboard-visual-smoke-monitoring.mjs";
import { checkTraefikUpdateHistory } from "./dashboard-visual-traefik-update-history.mjs";
import { checkWatchdogFilterPersistence } from "./dashboard-visual-watchdog.mjs";

export async function runDashboardVisualSmoke({ artifactDir, baseUrl, capabilities, cdp, timeoutMs }) {
  const labels = [];
  for (const profile of VISUAL_PROFILES) {
    await withVisualProfile(cdp, profile, async () => {
      for (const route of DASHBOARD_ROUTES) {
        await checkVisualRoute({ artifactDir, baseUrl, cdp, profile, route, timeoutMs });
        if (route.path === "/dashboard") {
          await checkSmokeRunTrendRange({ cdp, timeoutMs });
          labels.push(`${profile.label} 운영 점검 7일·30일 추이`);
          await checkManagerHttpErrorTrend({ cdp, timeoutMs });
          labels.push(`${profile.label} Manager file-provider 라우터`);
          const deploymentHistory = await checkManagerDeploymentHistory({ cdp, timeoutMs });
          if (deploymentHistory) labels.push(`${profile.label} 배포 이력 결과 건수·필터 알림·사용자 지정 파일명`);
          if (!profile.mobile && await checkTraefikUpdateHistory({ cdp, timeoutMs })) labels.push(`${profile.label} Traefik 업데이트 요청자·재시도 필터 복원·감사 링크·JSON·CSV`);
          const opened = await checkMobileSidebar({ artifactDir, cdp, profile, timeoutMs });
          if (opened) labels.push(`${profile.label} 사이드바`);
          await checkWatchdogFilterPersistence({ cdp, timeoutMs });
          labels.push(`${profile.label} watchdog 필터·수동 갱신`);
        }
        if (route.path === "/dashboard/certificates") {
          const opened = await checkCertificateDrawer({ artifactDir, cdp, profile, timeoutMs });
          if (opened) labels.push(`${profile.label} 인증서 drawer`);
        }
        if (route.path === "/dashboard/audit") {
          await checkAuditDelayedRetryFilter({ cdp, timeoutMs });
          await checkAuditGithubApiRateLimitTrend({ cdp, timeoutMs });
          const securityChangeCount = await checkAuditSecuritySettingChanges({ cdp, timeoutMs });
          labels.push(`${profile.label} 지연 재시도·GitHub API 제한 추이·필터·CSV${securityChangeCount ? `·보안 변경 카드 ${securityChangeCount}종` : ""}`);
          const retryChainChecked = await checkAuditRetryChain({ cdp, timeoutMs });
          if (retryChainChecked) labels.push(`${profile.label} 알림 재시도 전체 체인·단계 경과·지연 강조`);
          await checkSmokeRotationAuditDetail({ cdp, timeoutMs });
          labels.push(`${profile.label} Secret 회전 실패 상세`);
          await checkAuditFilterPersistence({ cdp, profile, timeoutMs });
          labels.push(`${profile.label} 감사 필터 조합·Traefik 자동 펼침·역링크·레이아웃`);
        }
        if (route.path === "/dashboard/settings") {
          await checkManualSmokeRunResultPersistence({ cdp, timeoutMs });
          labels.push(`${profile.label} 마지막 수동 점검 결과 새로고침 유지·삭제`);
          const historyLinked = await checkSettingsTestAuditLinks({ cdp, timeoutMs });
          if (historyLinked) labels.push(`${profile.label} 설정 테스트 감사 상세·최근 실패 화면 링크`);
          const previewed = await checkManagerHttpErrorPreviewForm({
            artifactDir,
            canManageSettings: capabilities.canManage,
            cdp,
            profile,
            timeoutMs,
          });
          if (previewed) labels.push(`${profile.label} API 오류 권장값 계산`);
          const retryDelayEditable = await checkSecurityAlertRetryDelaySetting({
            canManageSettings: capabilities.canManage,
            cdp,
            timeoutMs,
          });
          labels.push(`${profile.label} 자동 재시도 지연 설정${retryDelayEditable ? "·편집 범위" : ""}`);
          const bottleneckPreviewed = await checkDeploymentBottleneckSettingsPreview({
            canManageSettings: capabilities.canManage,
            cdp,
            timeoutMs,
          });
          if (bottleneckPreviewed) labels.push(`${profile.label} 배포 병목 호스트 적용값 비교`);
          const opened = await checkOptionalAdminModal({
            artifactDir,
            canManageUsers: capabilities.canManage,
            cdp,
            profile,
            timeoutMs,
          });
          if (opened) labels.push(`${profile.label} 사용자 추가 모달`);
        }
      }
    });
    labels.push(`${profile.label} ${DASHBOARD_ROUTES.length}개 화면`);
  }
  labels.push("Docker 정상 표시", "Artifact 필터 건수·정렬·URL 공유·복사 성공 초기화·실패 fallback·새로고침 유지");
  const cleanupCancelChecked = await checkOptionalDeploymentBottleneckCleanupCancel({
    baseUrl,
    cdp,
    timeoutMs,
  });
  if (cleanupCancelChecked) labels.push("관리자 병목 이벤트 정리 확인·취소");
  const maintenanceChecked = await checkMaintenanceScheduleFixture({
    canManage: cleanupCancelChecked, cdp, timeoutMs,
  });
  const bulkOperationChecked = await checkAuditBulkOperationFixture({
    canManage: cleanupCancelChecked, cdp, timeoutMs,
  });
  if (maintenanceChecked && bulkOperationChecked) labels.push("관리자 점검 일정·일괄 작업 비파괴 fixture");
  await cdp.send("Network.clearBrowserCookies");
  await evaluateInVisualPage(cdp, `localStorage.removeItem("auth")`);
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  for (const profile of VISUAL_PROFILES) {
    await withVisualProfile(cdp, profile, () =>
      checkVisualRoute({ artifactDir, baseUrl, cdp, profile, route: loginRoute, timeoutMs }),
    );
  }
  labels.push("로그인 2개 화면");
  return { adminChecked: cleanupCancelChecked, labels };
}

export function runDashboardVisualSmokeSelfTest() {
  runDeploymentBottleneckCleanupSelfTest();
  runMaintenanceScheduleFixtureSelfTest();
  runAuditBulkOperationFixtureSelfTest();
  const serviceRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/services");
  const dashboardRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard");
  const auditRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/audit");
  const settingsRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/settings");
  assert.ok(serviceRoute);
  assert.ok(dashboardRoute);
  assert.ok(auditRoute?.requiredMarkers.includes("현재 조건 CSV"));
  assert.ok(auditRoute.requiredMarkers.includes("병목 이벤트 정리"));
  assert.ok(dashboardRoute.requiredMarkers.includes("Manager API 404·5xx 추이"));
  assert.ok(dashboardRoute.requiredMarkers.includes("Manager file-provider 라우터"));
  assert.ok(dashboardRoute.requiredMarkers.includes("경로 필터"));
  assert.ok(dashboardRoute.requiredMarkers.includes("연속 실패"));
  assert.equal(settingsRoute?.marker, "운영 로그인·화면 점검");
  assert.ok(settingsRoute.requiredMarkers.includes("감사 로그 보존"));
  assert.ok(settingsRoute.requiredMarkers.includes("Manager API 오류 감지"));
  assert.ok(settingsRoute.requiredMarkers.includes("배포 병목 운영 알림"));
  assert.ok(settingsRoute.requiredMarkers.includes("이벤트 보관 기간"));
  assert.ok(settingsRoute.requiredMarkers.includes("현재 보관"));
  assert.ok(settingsRoute.requiredMarkers.includes("호스트 현재 적용"));
  assert.ok(settingsRoute.requiredMarkers.includes("적용 출처"));
  runDashboardVisualPageChecksSelfTest();
}
