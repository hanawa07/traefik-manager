import { NextRequest, NextResponse } from "next/server";

const backendUpstream =
  process.env.BACKEND_UPSTREAM_URL || "http://traefik-manager-backend:8000";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request, path);
  const method = request.method.toUpperCase();
  const headers = buildUpstreamHeaders(request);

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(method)) {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  const upstreamResponse = await fetch(upstreamUrl, init);
  return buildProxyResponse(upstreamResponse);
}

function buildUpstreamUrl(request: NextRequest, path: string[]): URL {
  const upstreamBase = new URL(backendUpstream);
  const upstreamPath = `/api/v1/${path.join("/")}`;
  const upstreamUrl = new URL(upstreamPath, upstreamBase);
  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl;
}

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "host" || HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      return;
    }
    headers.set(key, value);
  });

  headers.set("x-forwarded-host", request.headers.get("host") || "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  return headers;
}

async function buildProxyResponse(upstreamResponse: Response): Promise<NextResponse> {
  const responseHeaders = new Headers();

  upstreamResponse.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "set-cookie" || HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      return;
    }
    responseHeaders.append(key, value);
  });

  const setCookies = upstreamResponse.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  // API 프록시 응답은 브라우저/중간 프록시가 캐시하지 않도록 강제한다.
  responseHeaders.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  responseHeaders.set("pragma", "no-cache");
  responseHeaders.set("expires", "0");

  const body =
    upstreamResponse.status === 204 || upstreamResponse.status === 304
      ? null
      : await upstreamResponse.arrayBuffer();

  return new NextResponse(body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
