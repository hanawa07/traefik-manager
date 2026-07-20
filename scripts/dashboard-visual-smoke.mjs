import assert from "node:assert/strict";
import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";
import { checkAuditFilterPersistence, checkCertificateDrawer, checkMobileSidebar, checkOptionalAdminModal } from "./dashboard-visual-interactions.mjs";
import { checkDeploymentBottleneckSettingsPreview } from "./dashboard-visual-deployment-bottleneck-settings.mjs";
import { checkOptionalDeploymentBottleneckCleanupCancel, runDeploymentBottleneckCleanupSelfTest } from "./dashboard-visual-deployment-bottleneck-cleanup.mjs";
import { checkManagerHttpErrorPreviewForm, checkManagerHttpErrorTrend } from "./dashboard-visual-manager-http.mjs";
import { checkManagerDeploymentHistory } from "./dashboard-visual-manager-deployment.mjs";
import { DASHBOARD_ROUTES, VISUAL_PROFILES } from "./dashboard-visual-routes.mjs";
import { checkSecurityAlertRetryDelaySetting } from "./dashboard-visual-security-alert-settings.mjs";
import { checkAuditDelayedRetryFilter } from "./dashboard-visual-audit-delayed-retry.mjs";
import { checkAuditBulkOperationFixture, runAuditBulkOperationFixtureSelfTest } from "./dashboard-visual-audit-bulk-operations.mjs";
import { checkAuditSecuritySettingChanges } from "./dashboard-visual-audit-security-setting-changes.mjs";
import { checkAuditRetryChain, checkSettingsTestAuditLinks, checkSmokeRotationAuditDetail, checkSmokeRunTrendRange } from "./dashboard-visual-smoke-monitoring.mjs";
import { checkManualSmokeRunResultPersistence } from "./dashboard-visual-smoke-manual-run.mjs";
import { checkMaintenanceScheduleFixture, runMaintenanceScheduleFixtureSelfTest } from "./dashboard-visual-maintenance-schedule.mjs";
import { checkTraefikUpdateHistory } from "./dashboard-visual-traefik-update-history.mjs";
import { checkWatchdogFilterPersistence } from "./dashboard-visual-watchdog.mjs";
import { assertDashboardShell } from "./dashboard-visual-shell.mjs";
export async function runDashboardVisualSmoke({ artifactDir, baseUrl, capabilities, cdp, timeoutMs }) {
  const labels = [];
  for (const profile of VISUAL_PROFILES) {
    await withVisualProfile(cdp, profile, async () => {
      for (const route of DASHBOARD_ROUTES) {
        await checkRoute({ artifactDir, baseUrl, cdp, profile, route, timeoutMs });
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
          const securityChangeCount = await checkAuditSecuritySettingChanges({ cdp, timeoutMs });
          labels.push(`${profile.label} 지연 재시도 필터·건수·CSV·기간 클릭${securityChangeCount ? `·보안 변경 카드 ${securityChangeCount}종` : ""}`);
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
          const historyLinked = await checkSettingsTestAuditLinks({ cdp });
          if (historyLinked) labels.push(`${profile.label} 설정 테스트 감사 상세 링크`);
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
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  for (const profile of VISUAL_PROFILES) {
    await withVisualProfile(cdp, profile, () =>
      checkRoute({ artifactDir, baseUrl, cdp, profile, route: loginRoute, timeoutMs }),
    );
  }
  labels.push("로그인 2개 화면");
  return { adminChecked: cleanupCancelChecked, labels };
}
async function withVisualProfile(cdp, profile, callback) {
  await cdp.send("Emulation.setDeviceMetricsOverride", profile.viewport);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: profile.mobile });
  const script = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: profile.dark
      ? `localStorage.setItem("theme", "dark"); document.documentElement.classList.add("dark");`
      : `localStorage.setItem("theme", "light"); document.documentElement.classList.remove("dark");`,
  });
  try {
    await callback();
  } finally {
    if (script.identifier) {
      await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier });
    }
  }
}
async function checkRoute({ artifactDir, baseUrl, cdp, profile, route, timeoutMs }) {
  try {
    await navigateAndWait(cdp, `${baseUrl}${route.path}`, timeoutMs);
    await waitForRoute(cdp, route, timeoutMs);
    await checkRenderedRoute(cdp, route, artifactDir, profile);
  } catch (error) {
    await captureVisualScreenshot({
      artifactDir,
      cdp,
      name: `failure-${screenshotName(profile, route.path)}`,
    }).catch(() => undefined);
    throw error;
  }
}

async function checkRenderedRoute(cdp, route, artifactDir, profile) {
  const snapshot = await evaluate(cdp, `(() => {
    const surface = document.querySelector('.card, [data-visual-surface], [data-testid="login-form-card"]');
    const surfaceStyle = surface ? getComputedStyle(surface) : null;
    const surfaceText = surface?.querySelector('h1, h2, h3, p, label, span, button, a') || surface;
    const surfaceTextStyle = surfaceText ? getComputedStyle(surfaceText) : null;
    const visualBackground = document.querySelector('[data-visual-background], .min-h-screen');
    const main = document.querySelector('main');
    const sortControls = document.querySelector('[data-testid="services-sort-controls"]');
    const sidebar = document.querySelector('#dashboard-sidebar');
    const mobileBar = document.querySelector('#dashboard-mobile-bar');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const mobileBarRect = mobileBar?.getBoundingClientRect();
    const overviewStats =
      document.querySelector('[data-testid="service-overview-stats"]') ||
      Array.from(document.querySelectorAll('.grid')).find((element) =>
        element.classList.contains('lg:grid-cols-5')
      );
    const tableScrolls = Array.from(document.querySelectorAll('[data-table-scroll]')).map((element) => ({
      id: element.getAttribute('data-table-scroll'),
      overflow: getComputedStyle(element).overflowX,
      scrollWidth: element.scrollWidth,
      width: element.clientWidth,
    }));
    return {
      visualBackground: getComputedStyle(visualBackground || document.body).backgroundColor,
      dark: document.documentElement.classList.contains('dark'),
      documentWidth: document.documentElement.scrollWidth,
      mainScrollWidth: main?.scrollWidth ?? null,
      mainWidth: main?.clientWidth ?? null,
      path: location.pathname,
      overviewColumns: overviewStats ? getComputedStyle(overviewStats).gridTemplateColumns.split(' ').length : null,
      sidebarRect: sidebarRect ? {
        height: sidebarRect.height,
        right: sidebarRect.right,
        width: sidebarRect.width,
        x: sidebarRect.x,
      } : null,
      mobileBarRect: mobileBarRect ? {
        display: getComputedStyle(mobileBar).display,
        height: mobileBarRect.height,
        width: mobileBarRect.width,
      } : null,
      sortDisplay: sortControls ? getComputedStyle(sortControls).display : null,
      surfaceBackground: surfaceStyle?.backgroundColor ?? null,
      surfaceColor: surfaceTextStyle?.color ?? null,
      tableScrolls,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    };
  })()`);
  await captureVisualScreenshot({ artifactDir, cdp, name: screenshotName(profile, route.path) });
  assertVisualSnapshot(snapshot, route, profile);
}

function screenshotName(profile, path) {
  const slug = path.replace(/^\//, "").replaceAll("/", "-") || "root";
  return `${profile.id}-${slug}`;
}

function assertVisualSnapshot(snapshot, route, profile) {
  assert.equal(snapshot.path, route.path, `${route.label}: 예상 경로와 다릅니다`);
  if (route.path.startsWith("/dashboard")) {
    assert.equal(
      snapshot.dark,
      profile.dark,
      `${profile.label} ${route.label}: 테마가 예상과 다릅니다`,
    );
    assertDashboardShell(snapshot, route, profile);
  }
  assert.ok(
    snapshot.documentWidth <= snapshot.viewportWidth + 1,
    `${profile.label} ${route.label}: 페이지가 뷰포트를 ${snapshot.documentWidth - snapshot.viewportWidth}px 넘습니다`,
  );
  if (snapshot.mainWidth !== null) {
    assert.ok(
      snapshot.mainScrollWidth <= snapshot.mainWidth + 1,
      `${profile.label} ${route.label}: 콘텐츠가 화면 영역을 ${snapshot.mainScrollWidth - snapshot.mainWidth}px 넘습니다`,
    );
  }
  if (route.path === "/login") {
    assert.ok(
      isDarkColor(snapshot.visualBackground),
      `${profile.label} ${route.label}: 화면 배경이 어둡지 않습니다 (${snapshot.visualBackground})`,
    );
    assert.ok(
      isLightColor(snapshot.surfaceBackground),
      `${profile.label} ${route.label}: 로그인 카드가 밝지 않습니다 (${snapshot.surfaceBackground})`,
    );
    assert.ok(
      hasReadableContrast(snapshot.surfaceBackground, snapshot.surfaceColor),
      `${profile.label} ${route.label}: 로그인 카드 글자 대비가 부족합니다 (${snapshot.surfaceColor})`,
    );
  } else {
    assert.ok(
      profile.dark
        ? isDarkColor(snapshot.visualBackground) && isDarkColor(snapshot.surfaceBackground)
        : isLightColor(snapshot.visualBackground) && isLightColor(snapshot.surfaceBackground),
      `${profile.label} ${route.label}: 배경과 주요 표면이 테마와 다릅니다`,
    );
    assert.ok(
      hasReadableContrast(snapshot.surfaceBackground, snapshot.surfaceColor),
      `${profile.label} ${route.label}: 주요 표면 글자 대비가 부족합니다 (${snapshot.surfaceColor})`,
    );
  }

  if (route.path === "/dashboard/services") {
    assert.equal(
      snapshot.sortDisplay,
      profile.mobile ? "grid" : "flex",
      `${profile.label} 서비스: 정렬 컨트롤 배치가 예상과 다릅니다`,
    );
  }
  if (route.path === "/dashboard") {
    assert.equal(
      snapshot.overviewColumns,
      profile.mobile ? 2 : 5,
      `${profile.label} 대시보드: 서비스 통계 열 수가 예상과 다릅니다`,
    );
  }
  for (const table of snapshot.tableScrolls) {
    assert.equal(table.overflow, "auto", `${route.label}: ${table.id} 표 내부 스크롤이 비활성입니다`);
    assert.ok(table.scrollWidth >= table.width, `${route.label}: ${table.id} 표 스크롤 폭 계산이 잘못됐습니다`);
  }
}

async function waitForRoute(cdp, route, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;

  while (Date.now() < deadline) {
    lastSnapshot = await evaluate(cdp, `({
      hasSurface: Boolean(document.querySelector('.card, [data-visual-surface], [data-testid="login-form-card"]')),
      isLoading: Boolean(document.querySelector('.animate-pulse')),
      path: location.pathname,
      text: document.body.innerText.slice(0, 20000),
    })`);
    if (
      lastSnapshot.path === route.path &&
      lastSnapshot.hasSurface &&
      !lastSnapshot.isLoading &&
      !route.pendingMarkers?.some((marker) => lastSnapshot.text.includes(marker)) &&
      !route.requiredMarkers?.some((marker) => !lastSnapshot.text.includes(marker)) &&
      lastSnapshot.text.includes(route.marker)
    ) {
      return;
    }
    if (route.path.startsWith("/dashboard") && lastSnapshot.path === "/login") {
      throw new Error(`${route.label}: 인증 세션이 없어 로그인 화면으로 이동했습니다`);
    }
    await sleep(250);
  }

  const missingMarkers = route.requiredMarkers?.filter(
    (marker) => !lastSnapshot?.text.includes(marker),
  );
  const pendingMarkers = route.pendingMarkers?.filter((marker) =>
    lastSnapshot?.text.includes(marker),
  );
  throw new Error(
    `${route.label}: 렌더링 대기 시간 초과 (${lastSnapshot?.path ?? "경로 없음"})` +
      ` · 로딩=${lastSnapshot?.isLoading ? "예" : "아니오"}` +
      ` · 누락=${missingMarkers?.join(", ") || "없음"}` +
      ` · 대기=${pendingMarkers?.join(", ") || "없음"}`,
  );
}

async function navigateAndWait(cdp, url, timeoutMs) {
  const loaded = cdp.waitFor("Page.loadEventFired", timeoutMs);
  await cdp.send("Page.navigate", { url });
  await loaded;
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "브라우저 시각 검사 실패");
  }
  return response.result.value;
}

function isDarkColor(value) {
  const rgb = parseRgb(value);
  return rgb !== null && Math.max(...rgb) < 96;
}

function isLightColor(value) {
  const rgb = parseRgb(value);
  return rgb !== null && Math.min(...rgb) > 160;
}

function hasReadableContrast(background, foreground) {
  const backgroundRgb = parseRgb(background);
  const foregroundRgb = parseRgb(foreground);
  if (!backgroundRgb || !foregroundRgb) return false;
  const lighter = Math.max(relativeLuminance(backgroundRgb), relativeLuminance(foregroundRgb));
  const darker = Math.min(relativeLuminance(backgroundRgb), relativeLuminance(foregroundRgb));
  return (lighter + 0.05) / (darker + 0.05) >= 4.5;
}

function relativeLuminance(rgb) {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function parseRgb(value) {
  const match = String(value || "").match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function runDashboardVisualSmokeSelfTest() {
  runDeploymentBottleneckCleanupSelfTest();
  runMaintenanceScheduleFixtureSelfTest();
  runAuditBulkOperationFixtureSelfTest();
  const mobileProfile = VISUAL_PROFILES[0];
  const desktopProfile = VISUAL_PROFILES[1];
  const serviceRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/services");
  const dashboardRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard");
  const auditRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/audit");
  const settingsRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/settings");
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
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
  assert.equal(screenshotName(mobileProfile, "/dashboard/services"), "mobile-dark-dashboard-services");
  assert.equal(screenshotName(desktopProfile, "/login"), "desktop-light-login");
  const valid = {
    visualBackground: "rgb(2, 6, 23)",
    dark: true,
    documentWidth: 390,
    mainScrollWidth: 390,
    mainWidth: 390,
    path: "/dashboard/services",
    overviewColumns: null,
    sidebarRect: { height: 844, right: 0, width: 256, x: -256 },
    mobileBarRect: { display: "flex", height: 64, width: 390 },
    sortDisplay: "grid",
    surfaceBackground: "rgba(15, 23, 42, 0.95)",
    surfaceColor: "rgb(241, 245, 249)",
    tableScrolls: [],
    viewportHeight: 844,
    viewportWidth: 390,
  };

  assert.doesNotThrow(() => assertVisualSnapshot(valid, serviceRoute, mobileProfile));
  assert.doesNotThrow(() =>
    assertVisualSnapshot(
      { ...valid, path: "/dashboard", overviewColumns: 2, sortDisplay: null },
      dashboardRoute,
      mobileProfile,
    ),
  );
  const desktopValid = {
    ...valid,
    visualBackground: "rgb(248, 250, 252)",
    dark: false,
    documentWidth: 1440,
    mainScrollWidth: 1184,
    mainWidth: 1184,
    sidebarRect: { height: 900, right: 256, width: 256, x: 0 },
    mobileBarRect: { display: "none", height: 0, width: 0 },
    sortDisplay: "flex",
    surfaceBackground: "rgb(255, 255, 255)",
    surfaceColor: "rgb(15, 23, 42)",
    viewportHeight: 900,
    viewportWidth: 1440,
  };
  assert.doesNotThrow(() => assertVisualSnapshot(desktopValid, serviceRoute, desktopProfile));
  assert.doesNotThrow(() =>
    assertVisualSnapshot(
      { ...desktopValid, path: "/dashboard", overviewColumns: 5, sortDisplay: null },
      dashboardRoute,
      desktopProfile,
    ),
  );
  assert.doesNotThrow(() =>
    assertVisualSnapshot(
      {
        ...valid,
        dark: false,
        path: "/login",
        sortDisplay: null,
        surfaceBackground: "rgba(255, 255, 255, 0.95)",
        surfaceColor: "rgb(15, 23, 42)",
      },
      loginRoute,
      mobileProfile,
    ),
  );
  assert.throws(
    () => assertVisualSnapshot({ ...valid, documentWidth: 430 }, serviceRoute, mobileProfile),
    /페이지가 뷰포트/,
  );
  assert.throws(
    () => assertVisualSnapshot({ ...valid, mainScrollWidth: 430 }, serviceRoute, mobileProfile),
    /콘텐츠가 화면 영역/,
  );
  assert.throws(
    () =>
      assertVisualSnapshot(
        { ...valid, surfaceBackground: "rgb(255, 255, 255)" },
        serviceRoute,
        mobileProfile,
      ),
    /배경과 주요 표면/,
  );
  assert.throws(
    () =>
      assertVisualSnapshot(
        { ...valid, surfaceColor: "rgb(15, 23, 42)" },
        serviceRoute,
        mobileProfile,
      ),
    /글자 대비/,
  );
  assert.throws(
    () =>
      assertVisualSnapshot(
        {
          ...valid,
          tableScrolls: [{ id: "sample", overflow: "visible", scrollWidth: 800, width: 390 }],
        },
        serviceRoute,
        mobileProfile,
      ),
    /내부 스크롤/,
  );
}
