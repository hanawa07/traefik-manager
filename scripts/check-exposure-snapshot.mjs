#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DOCUMENT = path.join(REPO_ROOT, "docs", "EXPOSURE_AUDIT.md");
const ACTIVE_SECTIONS = new Set([
  "Tailnet 전용",
  "Tailnet UI와 공개 예외",
  "공개망과 Authentik",
  "공개망과 앱 또는 엣지 보안",
]);
const INTERNAL_HOSTS = new Set(["traefik-traefik"]);
const HOST_RULE = /Host\(`([^`]+)`\)/g;

export function extractDocumentedHosts(markdown) {
  const hosts = new Set();
  let section = "";
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^## (.+)$/);
    if (heading) section = heading[1];
    if (!ACTIVE_SECTIONS.has(section)) continue;
    const item = line.match(/^- `([^`]+)`/);
    if (item) hosts.add(item[1]);
  }
  return [...hosts].sort();
}

export function extractRuntimeHosts(routers) {
  const hosts = new Set();
  for (const router of routers) {
    if (router.status && router.status !== "enabled") continue;
    if (!router.entryPoints?.includes("websecure")) continue;
    for (const match of String(router.rule || "").matchAll(HOST_RULE)) {
      if (!INTERNAL_HOSTS.has(match[1])) hosts.add(match[1]);
    }
  }
  return [...hosts].sort();
}

export function compareHosts(documented, runtime) {
  const documentedSet = new Set(documented);
  const runtimeSet = new Set(runtime);
  return {
    missing: documented.filter((host) => !runtimeSet.has(host)),
    unexpected: runtime.filter((host) => !documentedSet.has(host)),
  };
}

function loadRuntimeRouters(routersFile) {
  if (routersFile) return JSON.parse(readFileSync(routersFile, "utf8"));
  const output = execFileSync(
    "docker",
    [
      "exec",
      "traefik",
      "wget",
      "-qO-",
      "http://127.0.0.1:8080/api/http/routers?per_page=1000",
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

function runSelfTest() {
  const markdown = [
    "## Tailnet 전용",
    "- `private.example.com`",
    "## 공개망과 Authentik",
    "- `auth.example.com`",
    "## 라우터 없는 보존 도메인",
    "- `stale.example.com`",
  ].join("\n");
  const routers = [
    { entryPoints: ["websecure"], rule: "Host(`auth.example.com`)", status: "enabled" },
    { entryPoints: ["websecure"], rule: "Host(`private.example.com`) && PathPrefix(`/`)", status: "enabled" },
    { entryPoints: ["web"], rule: "Host(`http-only.example.com`)", status: "enabled" },
    { entryPoints: ["websecure"], rule: "Host(`disabled.example.com`)", status: "disabled" },
    { entryPoints: ["websecure"], rule: "Host(`traefik-traefik`)", status: "enabled" },
  ];
  const documented = extractDocumentedHosts(markdown);
  const runtime = extractRuntimeHosts(routers);
  assert.deepEqual(documented, ["auth.example.com", "private.example.com"]);
  assert.deepEqual(runtime, documented);
  assert.deepEqual(compareHosts(documented, runtime), { missing: [], unexpected: [] });
  assert.deepEqual(compareHosts(documented, ["new.example.com"]), {
    missing: documented,
    unexpected: ["new.example.com"],
  });
  console.log("외부 노출 스냅샷 비교 self-test 통과");
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const documentPath = readOption("--document") || DEFAULT_DOCUMENT;
  const documented = extractDocumentedHosts(readFileSync(documentPath, "utf8"));
  const runtime = extractRuntimeHosts(loadRuntimeRouters(readOption("--routers-file")));
  const { missing, unexpected } = compareHosts(documented, runtime);
  if (missing.length || unexpected.length) {
    if (missing.length) console.error(`문서에만 있음: ${missing.join(", ")}`);
    if (unexpected.length) console.error(`런타임에만 있음: ${unexpected.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`외부 노출 스냅샷 일치: HTTPS Host ${runtime.length}개`);
  }
}
