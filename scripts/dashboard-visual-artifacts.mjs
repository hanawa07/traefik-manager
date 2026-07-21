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
    check_name: String(message).slice(0, 500),
    screen_path: page?.path ? String(page.path).slice(0, 500) : null,
    page_title: page?.title ? String(page.title).slice(0, 300) : null,
  };
}

export async function writeVisualFailureMetadata({ artifactDir, cdp, message, page }) {
  const currentPage = page ?? (await readVisualPage(cdp));
  const metadata = buildVisualFailureMetadata({
    capturedAt: new Date().toISOString(),
    message,
    page: currentPage,
  });
  if (artifactDir) {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      join(artifactDir, "failure-metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
  }
  return metadata;
}

async function readVisualPage(cdp) {
  if (!cdp) return null;
  return cdp
    .send("Runtime.evaluate", {
      expression:
        "({ path: location.pathname, title: document.title })",
      returnByValue: true,
    })
    .then((response) => response.result?.value, () => null);
}
