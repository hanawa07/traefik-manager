import assert from "node:assert/strict";

import { captureVisualScreenshot } from "./dashboard-visual-artifacts.mjs";
import {
  assertVisualSnapshot,
  runVisualSnapshotAssertionsSelfTest,
} from "./dashboard-visual-page-assertions.mjs";
import { waitForRoute } from "./dashboard-visual-page-runtime.mjs";
import { VISUAL_PROFILES } from "./dashboard-visual-routes.mjs";
import { evaluate, navigateWithLinkFallback } from "./dashboard-visual-runtime.mjs";

export async function checkVisualRoute({ artifactDir, baseUrl, cdp, profile, route, timeoutMs }) {
  try {
    await navigateWithLinkFallback(cdp, `${baseUrl}${route.path}`, timeoutMs);
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
    const mainRect = main?.getBoundingClientRect();
    const overflowElements = mainRect && main.scrollWidth > main.clientWidth + 1
      ? Array.from(main.querySelectorAll('*'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              className: String(element.className || '').trim().slice(0, 120),
              insideHorizontalScroll: Boolean(element.closest('[data-horizontal-scroll]')),
              overflowX: getComputedStyle(element).overflowX,
              right: Math.round(rect.right),
              tag: element.tagName.toLowerCase(),
              testId: element.getAttribute('data-testid'),
              width: Math.round(rect.width),
            };
          })
          .filter((element) =>
            element.right > mainRect.right + 1 && !element.insideHorizontalScroll
          )
          .sort((left, right) => right.right - left.right)
          .slice(0, 5)
      : [];
    const horizontalScrolls = mainRect
      ? Array.from(main.querySelectorAll('[data-horizontal-scroll]')).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            contained: rect.left >= mainRect.left - 1 && rect.right <= mainRect.right + 1,
            id: element.getAttribute('data-testid') || element.getAttribute('data-table-scroll') || element.tagName.toLowerCase(),
            overflow: getComputedStyle(element).overflowX,
            scrollWidth: element.scrollWidth,
            width: element.clientWidth,
          };
        })
      : [];
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
      horizontalScrolls,
      mainOverflowX: main ? getComputedStyle(main).overflowX : null,
      mainScrollWidth: main?.scrollWidth ?? null,
      mainWidth: main?.clientWidth ?? null,
      path: location.pathname,
      overviewColumns: overviewStats ? getComputedStyle(overviewStats).gridTemplateColumns.split(' ').length : null,
      overflowElements,
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

export function runDashboardVisualPageChecksSelfTest() {
  const mobileProfile = VISUAL_PROFILES[0];
  const desktopProfile = VISUAL_PROFILES[1];
  assert.equal(screenshotName(mobileProfile, "/dashboard/services"), "mobile-dark-dashboard-services");
  assert.equal(screenshotName(desktopProfile, "/login"), "desktop-light-login");
  runVisualSnapshotAssertionsSelfTest();
}
