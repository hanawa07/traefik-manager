import assert from "node:assert/strict";

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
};

const DASHBOARD_ROUTES = [
  { label: "대시보드", path: "/dashboard", marker: "Traefik 서비스 현황" },
  { label: "리다이렉트", path: "/dashboard/redirects", marker: "도메인 리다이렉트 호스트 관리" },
  { label: "서비스", path: "/dashboard/services", marker: "Traefik 라우팅 서비스 관리" },
  { label: "설정", path: "/dashboard/settings", marker: "설정" },
];

export async function runDashboardVisualSmoke({ baseUrl, cdp, timeoutMs }) {
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
    await navigateAndWait(cdp, `${baseUrl}${route.path}`, timeoutMs);
    await waitForRoute(cdp, route, timeoutMs);
    await checkRenderedRoute(cdp, route);
    labels.push(route.label);
  }

  await cdp.send("Network.clearBrowserCookies");
  await evaluate(cdp, `localStorage.removeItem("auth")`);
  const loginRoute = { label: "로그인", path: "/login", marker: "로그인" };
  await navigateAndWait(cdp, `${baseUrl}${loginRoute.path}`, timeoutMs);
  await waitForRoute(cdp, loginRoute, timeoutMs);
  await checkRenderedRoute(cdp, loginRoute);
  labels.push(loginRoute.label);

  return labels;
}

async function checkRenderedRoute(cdp, route) {
  const snapshot = await evaluate(cdp, `(() => {
    const surface = document.querySelector('.card, [data-testid="login-form-card"]');
    const surfaceStyle = surface ? getComputedStyle(surface) : null;
    const redirectScroll = document.querySelector('[data-testid="redirects-table-scroll"]');
    const sortControls = document.querySelector('[data-testid="services-sort-controls"]');
    return {
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      dark: document.documentElement.classList.contains('dark'),
      documentWidth: document.documentElement.scrollWidth,
      path: location.pathname,
      redirectOverflow: redirectScroll ? getComputedStyle(redirectScroll).overflowX : null,
      redirectScrollWidth: redirectScroll?.scrollWidth ?? null,
      redirectWidth: redirectScroll?.clientWidth ?? null,
      sortDisplay: sortControls ? getComputedStyle(sortControls).display : null,
      surfaceBackground: surfaceStyle?.backgroundColor ?? null,
      surfaceColor: surfaceStyle?.color ?? null,
      viewportWidth: document.documentElement.clientWidth,
    };
  })()`);

  assertVisualSnapshot(snapshot, route);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  assert.ok(screenshot.data?.length > 1000, `${route.label}: 스크린샷 생성 실패`);
}

function assertVisualSnapshot(snapshot, route) {
  assert.equal(snapshot.path, route.path, `${route.label}: 예상 경로와 다릅니다`);
  assert.equal(snapshot.dark, true, `${route.label}: 다크모드가 적용되지 않았습니다`);
  assert.ok(
    snapshot.documentWidth <= snapshot.viewportWidth + 1,
    `${route.label}: 페이지가 모바일 뷰포트를 ${snapshot.documentWidth - snapshot.viewportWidth}px 넘습니다`,
  );
  assert.ok(isDarkColor(snapshot.bodyBackground), `${route.label}: 본문 배경이 어둡지 않습니다`);
  assert.ok(isDarkColor(snapshot.surfaceBackground), `${route.label}: 주요 표면이 어둡지 않습니다`);
  assert.ok(isLightColor(snapshot.surfaceColor), `${route.label}: 주요 표면 글자 대비가 부족합니다`);

  if (route.path === "/dashboard/services") {
    assert.equal(snapshot.sortDisplay, "grid", "서비스: 모바일 정렬 컨트롤이 그리드가 아닙니다");
  }
  if (snapshot.redirectOverflow !== null) {
    assert.equal(snapshot.redirectOverflow, "auto", "리다이렉트: 테이블 내부 스크롤이 비활성입니다");
    assert.ok(snapshot.redirectScrollWidth >= snapshot.redirectWidth, "리다이렉트: 스크롤 폭 계산이 잘못됐습니다");
  }
}

async function waitForRoute(cdp, route, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;

  while (Date.now() < deadline) {
    lastSnapshot = await evaluate(cdp, `({
      hasSurface: Boolean(document.querySelector('.card, [data-testid="login-form-card"]')),
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
  const valid = {
    bodyBackground: "rgb(2, 6, 23)",
    dark: true,
    documentWidth: 390,
    path: "/dashboard/services",
    redirectOverflow: null,
    redirectScrollWidth: null,
    redirectWidth: null,
    sortDisplay: "grid",
    surfaceBackground: "rgba(15, 23, 42, 0.95)",
    surfaceColor: "rgb(241, 245, 249)",
    viewportWidth: 390,
  };

  assert.doesNotThrow(() => assertVisualSnapshot(valid, DASHBOARD_ROUTES[2]));
  assert.throws(
    () => assertVisualSnapshot({ ...valid, documentWidth: 430 }, DASHBOARD_ROUTES[2]),
    /모바일 뷰포트/,
  );
  assert.throws(
    () => assertVisualSnapshot({ ...valid, surfaceBackground: "rgb(255, 255, 255)" }, DASHBOARD_ROUTES[2]),
    /주요 표면/,
  );
}
