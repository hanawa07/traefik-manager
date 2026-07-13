import assert from "node:assert/strict";

import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";
import { checkAuditFilterPersistence, checkCertificateDrawer, checkMobileSidebar, checkOptionalAdminModal } from "./dashboard-visual-interactions.mjs";
import { assertDashboardShell } from "./dashboard-visual-shell.mjs";

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
};

const VISUAL_PROFILES = [
  {
    dark: true,
    id: "mobile-dark",
    label: "모바일 다크모드",
    mobile: true,
    viewport: MOBILE_VIEWPORT,
  },
  {
    dark: false,
    id: "desktop-light",
    label: "데스크톱 라이트모드",
    mobile: false,
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    },
  },
];

const DASHBOARD_ROUTES = [
  {
    label: "대시보드",
    path: "/dashboard",
    marker: "Traefik 서비스 현황",
    pendingMarkers: ["Traefik 상태: 확인 중", "배포 정보를 확인하는 중입니다"],
    requiredMarkers: [
      "Backend",
      "Frontend",
      "Docker 정상",
      "Manager 상태 전이 이력",
      "외부 watchdog",
      "연속 실패 0회",
      "최근 watchdog 알림 요청",
      "최근 watchdog 알림 실행",
      "알림 워크플로 결과",
      "마지막 상태 갱신",
      "상태 새로고침",
    ],
  },
  { label: "인증서", path: "/dashboard/certificates", marker: "Traefik API 기반 TLS 인증서 상태" },
  {
    label: "감사 로그",
    path: "/dashboard/audit",
    marker: "시스템의 모든 변경 사항을 추적합니다",
    requiredMarkers: ["Manager 전체", "Manager 소스", "Manager 상태", "Manager 집계 기간"],
  },
  { label: "미들웨어", path: "/dashboard/middlewares", marker: "공용 템플릿" },
  { label: "리다이렉트", path: "/dashboard/redirects", marker: "도메인 리다이렉트 호스트 관리" },
  { label: "서비스", path: "/dashboard/services", marker: "Traefik 라우팅 서비스 관리" },
  {
    label: "설정",
    path: "/dashboard/settings",
    marker: "운영 로그인·화면 점검",
    requiredMarkers: ["Artifact 만료", "Manager Docker 감지", "외부 watchdog 지연 판정"],
  },
];

export async function runDashboardVisualSmoke({ artifactDir, baseUrl, cdp, timeoutMs }) {
  const labels = [];
  for (const profile of VISUAL_PROFILES) {
    await withVisualProfile(cdp, profile, async () => {
      for (const route of DASHBOARD_ROUTES) {
        await checkRoute({ artifactDir, baseUrl, cdp, profile, route, timeoutMs });
        if (route.path === "/dashboard") {
          const opened = await checkMobileSidebar({ artifactDir, cdp, profile, timeoutMs });
          if (opened) labels.push(`${profile.label} 사이드바`);
        }
        if (route.path === "/dashboard/certificates") {
          const opened = await checkCertificateDrawer({ artifactDir, cdp, profile, timeoutMs });
          if (opened) labels.push(`${profile.label} 인증서 drawer`);
        }
        if (route.path === "/dashboard/audit") {
          await checkAuditFilterPersistence({ cdp, timeoutMs });
          labels.push(`${profile.label} 감사 필터 URL 유지`);
        }
        if (route.path === "/dashboard/settings") {
          const opened = await checkOptionalAdminModal({ artifactDir, cdp, profile, timeoutMs });
          if (opened) labels.push(`${profile.label} 사용자 추가 모달`);
        }
      }
    });
    labels.push(`${profile.label} ${DASHBOARD_ROUTES.length}개 화면`);
  }
  labels.push("Docker 정상 표시", "Artifact 만료 표시");

  await cdp.send("Network.clearBrowserCookies");
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  for (const profile of VISUAL_PROFILES) {
    await withVisualProfile(cdp, profile, () =>
      checkRoute({ artifactDir, baseUrl, cdp, profile, route: loginRoute, timeoutMs }),
    );
  }
  labels.push("로그인 2개 화면");

  return labels;
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

  throw new Error(
    `${route.label}: 렌더링 대기 시간 초과 (${lastSnapshot?.path ?? "경로 없음"})`,
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
  const mobileProfile = VISUAL_PROFILES[0];
  const desktopProfile = VISUAL_PROFILES[1];
  const serviceRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/services");
  const dashboardRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard");
  const auditRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/audit");
  const settingsRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/settings");
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  assert.ok(serviceRoute);
  assert.ok(dashboardRoute);
  assert.deepEqual(auditRoute?.requiredMarkers, ["Manager 전체", "Manager 소스", "Manager 상태", "Manager 집계 기간"]);
  assert.deepEqual(dashboardRoute.requiredMarkers, [
    "Backend",
    "Frontend",
    "Docker 정상",
    "Manager 상태 전이 이력",
    "외부 watchdog",
    "연속 실패 0회",
    "최근 watchdog 알림 요청",
    "최근 watchdog 알림 실행",
    "알림 워크플로 결과",
    "마지막 상태 갱신",
    "상태 새로고침",
  ]);
  assert.equal(settingsRoute?.marker, "운영 로그인·화면 점검");
  assert.deepEqual(settingsRoute.requiredMarkers, [
    "Artifact 만료",
    "Manager Docker 감지",
    "외부 watchdog 지연 판정",
  ]);
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
