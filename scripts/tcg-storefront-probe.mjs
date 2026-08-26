#!/usr/bin/env node

import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "https://tcg.lizstudio.co.kr";
const DEFAULT_TIMEOUT_MS = 10_000;
const OAUTH_CONFIGURATION_ERROR =
  /\bKOE\d{3}\b|앱 관리자 설정 오류|redirect_uri_mismatch|invalid_(request|client)/i;

const OAUTH_CHECKS = [
  {
    name: "kakaoLogin",
    path: "/api/auth/kakao",
    hostname: "kauth.kakao.com",
    pathname: "/oauth/authorize",
    providerHostname: "accounts.kakao.com",
    callbackPath: "/api/auth/kakao/callback",
    stateCookie: "kakao_oauth_state=",
  },
  {
    name: "naverLogin",
    path: "/api/auth/naver",
    hostname: "nid.naver.com",
    pathname: "/oauth2.0/authorize",
    providerHostname: "nid.naver.com",
    callbackPath: "/api/auth/naver/callback",
    stateCookie: "naver_oauth_state=",
  },
  {
    name: "googleLogin",
    path: "/api/auth/google",
    hostname: "accounts.google.com",
    pathname: "/o/oauth2/v2/auth",
    providerHostname: "accounts.google.com",
    callbackPath: "/api/auth/google/callback",
    stateCookie: "google_oauth_state=",
  },
];

class ProbeError extends Error {
  constructor(message, { providerFailure = false } = {}) {
    super(message);
    this.providerFailure = providerFailure;
  }
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("base URL protocol invalid");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function normalizeError(error) {
  if (error instanceof ProbeError) return error.message;
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) return "timeout";
  return "network-error";
}

function request(fetchImpl, url, timeoutMs, redirect = "manual") {
  return fetchImpl(url, {
    redirect,
    headers: {
      accept: "text/html,application/json",
      "user-agent": "Lizstudio-External-Storefront-Watchdog/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function assertHtml(fetchImpl, baseUrl, path, markers, timeoutMs) {
  const response = await request(fetchImpl, new URL(path, baseUrl), timeoutMs);
  if (response.status !== 200) throw new ProbeError(`HTTP-${response.status}`);
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    throw new ProbeError("non-html-response");
  }
  const html = await response.text();
  if (!markers.some((marker) => html.includes(marker))) throw new ProbeError("page-marker-missing");
}

async function checkCatalog(fetchImpl, baseUrl, timeoutMs) {
  const response = await request(
    fetchImpl,
    new URL("/api/products?limit=20&page=1", baseUrl),
    timeoutMs
  );
  if (response.status !== 200) throw new ProbeError(`catalog-HTTP-${response.status}`);
  const body = await response.json();
  const products = Array.isArray(body?.products) ? body.products : [];
  if (products.length === 0) throw new ProbeError("public-catalog-empty");

  for (const product of products) {
    const variants = Array.isArray(product?.variants)
      ? product.variants.filter((variant) => variant?.isActive !== false)
      : [];
    if (typeof product?.slug !== "string" || variants.length === 0) {
      throw new ProbeError("catalog-shape-invalid");
    }
    if (variants.some((variant) => !Number.isFinite(variant.price) || variant.price <= 0)) {
      throw new ProbeError("public-price-invalid");
    }
  }

  await assertHtml(fetchImpl, baseUrl, "/products", ["상품 목록"], timeoutMs);
  await assertHtml(
    fetchImpl,
    baseUrl,
    `/p/${encodeURIComponent(products[0].slug)}`,
    ["배송/교환/환불 안내"],
    timeoutMs
  );
  return `catalog-${products.length}`;
}

async function checkPaymentMethods(fetchImpl, baseUrl, timeoutMs) {
  const response = await request(fetchImpl, new URL("/api/payment-methods", baseUrl), timeoutMs);
  if (response.status !== 200) throw new ProbeError(`payment-methods-HTTP-${response.status}`);
  const body = await response.json();
  const methods = Array.isArray(body?.paymentMethods) ? body.paymentMethods : [];
  if (!methods.some((method) => method?.isActive === true && method?.provider === "PORTONE")) {
    throw new ProbeError("online-payment-method-unavailable");
  }
  return "payment-methods-ready";
}

async function checkOAuth(fetchImpl, baseUrl, definition, timeoutMs, verifyProvider) {
  const response = await request(fetchImpl, new URL(definition.path, baseUrl), timeoutMs);
  if (![302, 303, 307, 308].includes(response.status)) {
    throw new ProbeError(`oauth-HTTP-${response.status}`);
  }

  let target;
  try {
    target = new URL(response.headers.get("location") || "");
  } catch {
    throw new ProbeError("oauth-redirect-invalid");
  }
  let callback;
  try {
    callback = new URL(target.searchParams.get("redirect_uri") || "");
  } catch {
    throw new ProbeError("oauth-callback-invalid");
  }
  if (
    target.protocol !== "https:" ||
    target.hostname !== definition.hostname ||
    target.pathname !== definition.pathname ||
    !target.searchParams.get("client_id") ||
    !target.searchParams.get("state") ||
    callback.protocol !== baseUrl.protocol ||
    callback.host !== baseUrl.host ||
    callback.pathname !== definition.callbackPath
  ) {
    throw new ProbeError("oauth-redirect-invalid");
  }
  if (!(response.headers.get("set-cookie") || "").includes(definition.stateCookie)) {
    throw new ProbeError("oauth-state-cookie-missing");
  }
  if (!verifyProvider) return "oauth-redirect-ready";

  try {
    const providerResponse = await request(fetchImpl, target, timeoutMs, "follow");
    const html = await providerResponse.text();
    if (OAUTH_CONFIGURATION_ERROR.test(html)) {
      throw new ProbeError("oauth-provider-configuration-error", { providerFailure: true });
    }
    const finalUrl = new URL(providerResponse.url);
    return providerResponse.status === 200 && finalUrl.hostname === definition.providerHostname
      ? "oauth-provider-verified"
      : "oauth-provider-inconclusive";
  } catch (error) {
    if (error instanceof ProbeError) throw error;
    return "oauth-provider-inconclusive";
  }
}

async function runCheck(name, callback) {
  try {
    return { name, ok: true, detail: await callback(), providerFailure: false };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: normalizeError(error),
      providerFailure: error instanceof ProbeError && error.providerFailure,
    };
  }
}

async function runProbe({ baseUrl, timeoutMs, verifyOAuthProviders, fetchImpl = fetch }) {
  const startedAt = Date.now();
  const checks = await Promise.all([
    runCheck("catalog", () => checkCatalog(fetchImpl, baseUrl, timeoutMs)),
    runCheck("loginPage", async () => {
      await assertHtml(fetchImpl, baseUrl, "/login", ["로그인"], timeoutMs);
      return "login-page-ready";
    }),
    runCheck("checkoutPage", async () => {
      await assertHtml(
        fetchImpl,
        baseUrl,
        "/checkout",
        ["로딩 중", "결제하기", "장바구니가 비어"],
        timeoutMs
      );
      return "checkout-page-ready";
    }),
    runCheck("paymentMethods", () => checkPaymentMethods(fetchImpl, baseUrl, timeoutMs)),
    ...OAUTH_CHECKS.map((definition) =>
      runCheck(definition.name, () =>
        checkOAuth(fetchImpl, baseUrl, definition, timeoutMs, verifyOAuthProviders)
      )
    ),
  ]);
  return {
    ok: checks.every((check) => check.ok),
    providerFailure: checks.some((check) => check.providerFailure),
    durationMs: Date.now() - startedAt,
    checks,
  };
}

function formatResult(result, verifyOAuthProviders) {
  if (result.ok) {
    return `healthy providerFailure=0 checks=${result.checks.length} providerCheck=${
      verifyOAuthProviders ? "attempted" : "skipped"
    } durationMs=${result.durationMs}`;
  }
  const failures = result.checks
    .filter((check) => !check.ok)
    .map((check) => `${check.name}:${check.detail}`)
    .join(",");
  return `unhealthy providerFailure=${result.providerFailure ? 1 : 0} failures=${failures}`;
}

function fakeFetchFactory(
  { invalidPrice = false, invalidCallback = false, providerConfigurationError = false } = {}
) {
  const calls = [];
  const htmlResponse = (body, url = "") => ({
    status: 200,
    url,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    text: async () => body,
  });
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (url.hostname !== "storefront.test") {
      const body = providerConfigurationError && url.hostname === "kauth.kakao.com" ? "KOE006" : "login";
      const finalHostname = url.hostname === "kauth.kakao.com" ? "accounts.kakao.com" : url.hostname;
      return htmlResponse(body, `https://${finalHostname}/login`);
    }
    if (url.pathname === "/api/products") {
      return new Response(
        JSON.stringify({
          products: [
            {
              slug: "sample-card",
              variants: [{ isActive: true, price: invalidPrice ? 0 : 1_000 }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url.pathname === "/api/payment-methods") {
      return new Response(
        JSON.stringify({ paymentMethods: [{ isActive: true, provider: "PORTONE" }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    const oauth = OAUTH_CHECKS.find((definition) => definition.path === url.pathname);
    if (oauth) {
      const target = new URL(`https://${oauth.hostname}${oauth.pathname}`);
      target.searchParams.set("client_id", "test-client");
      target.searchParams.set(
        "redirect_uri",
        invalidCallback
          ? `https://wrong.test${oauth.callbackPath}`
          : `https://storefront.test${oauth.callbackPath}`
      );
      target.searchParams.set("state", "test-state");
      return new Response(null, {
        status: 307,
        headers: { location: target, "set-cookie": `${oauth.stateCookie}test; HttpOnly` },
      });
    }
    const markers =
      url.pathname === "/products"
        ? "상품 목록"
        : url.pathname === "/checkout"
          ? "결제하기"
          : url.pathname === "/login"
            ? "로그인"
            : url.pathname === "/p/sample-card"
              ? "배송/교환/환불 안내"
              : "";
    return markers ? htmlResponse(markers) : new Response("not found", { status: 404 });
  };
  return { fetchImpl, calls };
}

async function runSelfTest() {
  const baseUrl = new URL("https://storefront.test");
  const healthyFake = fakeFetchFactory();
  const healthy = await runProbe({
    baseUrl,
    timeoutMs: 1_000,
    verifyOAuthProviders: true,
    fetchImpl: healthyFake.fetchImpl,
  });
  assert.equal(healthy.ok, true);
  assert.equal(healthy.providerFailure, false);
  assert.ok(healthyFake.calls.every(({ options }) => !options.method || options.method === "GET"));

  const badPrice = await runProbe({
    baseUrl,
    timeoutMs: 1_000,
    verifyOAuthProviders: false,
    fetchImpl: fakeFetchFactory({ invalidPrice: true }).fetchImpl,
  });
  assert.equal(badPrice.ok, false);
  assert.equal(badPrice.checks.find(({ name }) => name === "catalog")?.detail, "public-price-invalid");

  const badCallback = await runProbe({
    baseUrl,
    timeoutMs: 1_000,
    verifyOAuthProviders: false,
    fetchImpl: fakeFetchFactory({ invalidCallback: true }).fetchImpl,
  });
  assert.equal(badCallback.ok, false);
  assert.equal(badCallback.checks.find(({ name }) => name === "kakaoLogin")?.detail, "oauth-redirect-invalid");

  const providerError = await runProbe({
    baseUrl,
    timeoutMs: 1_000,
    verifyOAuthProviders: true,
    fetchImpl: fakeFetchFactory({ providerConfigurationError: true }).fetchImpl,
  });
  assert.equal(providerError.ok, false);
  assert.equal(providerError.providerFailure, true);
  console.log("TCG storefront 외부 probe self-test 통과");
}

const args = new Set(process.argv.slice(2));
if (args.has("--self-test")) {
  await runSelfTest();
  process.exit(0);
}
const knownArgs = new Set(["--verify-oauth-providers"]);
for (const arg of args) {
  if (!knownArgs.has(arg)) throw new Error(`unknown argument: ${arg}`);
}
const timeoutMs = Number(process.env.TM_TCG_STOREFRONT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("timeout must be a positive integer");
const verifyOAuthProviders = args.has("--verify-oauth-providers");
const result = await runProbe({
  baseUrl: normalizeBaseUrl(process.env.TM_TCG_STOREFRONT_BASE_URL || DEFAULT_BASE_URL),
  timeoutMs,
  verifyOAuthProviders,
});
console.log(formatResult(result, verifyOAuthProviders));
process.exit(result.ok ? 0 : 1);
