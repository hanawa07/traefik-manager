import { evaluate } from "./dashboard-visual-runtime.mjs";

export async function withVisualProfile(cdp, profile, callback) {
  await cdp.send("Emulation.setDeviceMetricsOverride", profile.viewport);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: profile.mobile });
  const themeSource = profile.dark
    ? `localStorage.setItem("theme", "dark"); document.documentElement.classList.add("dark");`
    : `localStorage.setItem("theme", "light"); document.documentElement.classList.remove("dark");`;
  await evaluate(cdp, themeSource);
  const script = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: themeSource,
  });
  try {
    await callback();
  } finally {
    if (script.identifier) {
      await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier });
    }
  }
}

export async function waitForRoute(cdp, route, timeoutMs) {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
