import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
};

const DASHBOARD_ROUTES = [
  { label: "대시보드", path: "/dashboard", marker: "Traefik 서비스 현황" },
  { label: "인증서", path: "/dashboard/certificates", marker: "Traefik API 기반 TLS 인증서 상태" },
  { label: "감사 로그", path: "/dashboard/audit", marker: "시스템의 모든 변경 사항을 추적합니다" },
  { label: "미들웨어", path: "/dashboard/middlewares", marker: "공용 템플릿" },
  { label: "리다이렉트", path: "/dashboard/redirects", marker: "도메인 리다이렉트 호스트 관리" },
  { label: "서비스", path: "/dashboard/services", marker: "Traefik 라우팅 서비스 관리" },
  { label: "설정", path: "/dashboard/settings", marker: "설정" },
];

export async function runDashboardVisualSmoke({ artifactDir, baseUrl, cdp, timeoutMs }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", MOBILE_VIEWPORT);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
    `,
  });

  const labels = [];
  for (const route of DASHBOARD_ROUTES) {
    await checkRoute({ artifactDir, baseUrl, cdp, route, timeoutMs });
    labels.push(route.label);
  }

  await cdp.send("Network.clearBrowserCookies");
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  await checkRoute({ artifactDir, baseUrl, cdp, route: loginRoute, timeoutMs });
  labels.push(loginRoute.label);

  return labels;
}

async function checkRoute({ artifactDir, baseUrl, cdp, route, timeoutMs }) {
  try {
    await navigateAndWait(cdp, `${baseUrl}${route.path}`, timeoutMs);
    await waitForRoute(cdp, route, timeoutMs);
    await checkRenderedRoute(cdp, route, artifactDir);
  } catch (error) {
    await captureScreenshot(cdp, route, artifactDir, "failure-").catch(() => undefined);
    throw error;
  }
}

async function checkRenderedRoute(cdp, route, artifactDir) {
  const snapshot = await evaluate(cdp, `(() => {
    const surface = document.querySelector('.card, [data-visual-surface], [data-testid="login-form-card"]');
    const surfaceStyle = surface ? getComputedStyle(surface) : null;
    const visualBackground = document.querySelector('[data-visual-background], .min-h-screen');
    const sortControls = document.querySelector('[data-testid="services-sort-controls"]');
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
      path: location.pathname,
      overviewColumns: overviewStats ? getComputedStyle(overviewStats).gridTemplateColumns.split(' ').length : null,
      sortDisplay: sortControls ? getComputedStyle(sortControls).display : null,
      surfaceBackground: surfaceStyle?.backgroundColor ?? null,
      surfaceColor: surfaceStyle?.color ?? null,
      tableScrolls,
      viewportWidth: document.documentElement.clientWidth,
    };
  })()`);

  await captureScreenshot(cdp, route, artifactDir);
  assertVisualSnapshot(snapshot, route);
}

async function captureScreenshot(cdp, route, artifactDir, prefix = "") {
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  assert.ok(screenshot.data?.length > 1000, `${route.label}: 스크린샷 생성 실패`);
  if (!artifactDir) return;

  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    join(artifactDir, `${prefix}${buildScreenshotName(route.path)}`),
    Buffer.from(screenshot.data, "base64"),
  );
}

function buildScreenshotName(path) {
  const slug = path.replace(/^\//, "").replaceAll("/", "-") || "root";
  return `${slug}.png`;
}

function assertVisualSnapshot(snapshot, route) {
  assert.equal(snapshot.path, route.path, `${route.label}: 예상 경로와 다릅니다`);
  if (route.path.startsWith("/dashboard")) {
    assert.equal(snapshot.dark, true, `${route.label}: 다크모드가 적용되지 않았습니다`);
  }
  assert.ok(
    snapshot.documentWidth <= snapshot.viewportWidth + 1,
    `${route.label}: 페이지가 모바일 뷰포트를 ${snapshot.documentWidth - snapshot.viewportWidth}px 넘습니다`,
  );
  assert.ok(
    isDarkColor(snapshot.visualBackground),
    `${route.label}: 화면 배경이 어둡지 않습니다 (${snapshot.visualBackground})`,
  );
  if (route.path === "/login") {
    assert.ok(
      isLightColor(snapshot.surfaceBackground),
      `${route.label}: 로그인 카드가 밝지 않습니다 (${snapshot.surfaceBackground})`,
    );
    assert.ok(
      isDarkColor(snapshot.surfaceColor),
      `${route.label}: 로그인 카드 글자 대비가 부족합니다 (${snapshot.surfaceColor})`,
    );
  } else {
    assert.ok(
      isDarkColor(snapshot.surfaceBackground),
      `${route.label}: 주요 표면이 어둡지 않습니다 (${snapshot.surfaceBackground})`,
    );
    assert.ok(
      isLightColor(snapshot.surfaceColor),
      `${route.label}: 주요 표면 글자 대비가 부족합니다 (${snapshot.surfaceColor})`,
    );
  }

  if (route.path === "/dashboard/services") {
    assert.equal(snapshot.sortDisplay, "grid", "서비스: 모바일 정렬 컨트롤이 그리드가 아닙니다");
  }
  if (route.path === "/dashboard") {
    assert.equal(snapshot.overviewColumns, 2, "대시보드: 모바일 서비스 통계가 2열이 아닙니다");
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
      path: location.pathname,
      text: document.body.innerText.slice(0, 5000),
    })`);
    if (lastSnapshot.path === route.path && lastSnapshot.hasSurface && lastSnapshot.text.includes(route.marker)) {
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

function parseRgb(value) {
  const match = String(value || "").match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function runDashboardVisualSmokeSelfTest() {
  const serviceRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard/services");
  const dashboardRoute = DASHBOARD_ROUTES.find((route) => route.path === "/dashboard");
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  assert.ok(serviceRoute);
  assert.ok(dashboardRoute);
  assert.equal(buildScreenshotName("/dashboard/services"), "dashboard-services.png");
  assert.equal(buildScreenshotName("/login"), "login.png");
  const valid = {
    visualBackground: "rgb(2, 6, 23)",
    dark: true,
    documentWidth: 390,
    path: "/dashboard/services",
    overviewColumns: null,
    sortDisplay: "grid",
    surfaceBackground: "rgba(15, 23, 42, 0.95)",
    surfaceColor: "rgb(241, 245, 249)",
    tableScrolls: [],
    viewportWidth: 390,
  };

  assert.doesNotThrow(() => assertVisualSnapshot(valid, serviceRoute));
  assert.doesNotThrow(() =>
    assertVisualSnapshot(
      { ...valid, path: "/dashboard", overviewColumns: 2, sortDisplay: null },
      dashboardRoute,
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
    ),
  );
  assert.throws(
    () => assertVisualSnapshot({ ...valid, documentWidth: 430 }, serviceRoute),
    /모바일 뷰포트/,
  );
  assert.throws(
    () => assertVisualSnapshot({ ...valid, surfaceBackground: "rgb(255, 255, 255)" }, serviceRoute),
    /주요 표면/,
  );
  assert.throws(
    () =>
      assertVisualSnapshot(
        {
          ...valid,
          tableScrolls: [{ id: "sample", overflow: "visible", scrollWidth: 800, width: 390 }],
        },
        serviceRoute,
      ),
    /내부 스크롤/,
  );
}
