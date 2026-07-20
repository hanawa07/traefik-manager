import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function captureVisualScreenshot({ artifactDir, cdp, name }) {
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  assert.ok(screenshot.data?.length > 1000, `${name}: 스크린샷 생성 실패`);
  if (!artifactDir) return;

  await mkdir(artifactDir, { recursive: true });
  await writeFile(join(artifactDir, `${name}.png`), Buffer.from(screenshot.data, "base64"));
}

export async function captureVisualDom({ artifactDir, cdp, name }) {
  if (!artifactDir) return;
  const response = await cdp.send("Runtime.evaluate", {
    expression: "document.documentElement.outerHTML",
    returnByValue: true,
  });
  const html = response.result?.value;
  assert.equal(typeof html, "string", `${name}: DOM 생성 실패`);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(join(artifactDir, `${name}.html`), html, "utf8");
}

function buildVisualFailureMetadata({ capturedAt, message, page }) {
  return {
    captured_at: capturedAt,
    check_name: message,
    screen_path: page?.path || null,
    page_title: page?.title || null,
  };
}

export async function writeVisualFailureMetadata({ artifactDir, cdp, message }) {
  if (!artifactDir) return;
  const page = await cdp
    .send("Runtime.evaluate", {
      expression:
        "({ path: location.pathname + location.search + location.hash, title: document.title })",
      returnByValue: true,
    })
    .then((response) => response.result?.value, () => null);
  const metadata = buildVisualFailureMetadata({
    capturedAt: new Date().toISOString(),
    message,
    page,
  });
  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    join(artifactDir, "failure-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
}
