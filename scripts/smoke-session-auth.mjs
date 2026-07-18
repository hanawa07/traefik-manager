export async function resolveSessionCookies(baseUrl) {
  if (process.env.TM_SMOKE_COOKIE) {
    return parseCookieHeader(process.env.TM_SMOKE_COOKIE);
  }

  const username = process.env.TM_SMOKE_USERNAME;
  const password = process.env.TM_SMOKE_PASSWORD;
  if (!username || !password) {
    throw new Error("TM_SMOKE_COOKIE 또는 TM_SMOKE_USERNAME/TM_SMOKE_PASSWORD가 필요합니다");
  }

  return loginSessionCookies(baseUrl, username, password);
}

export async function loginSessionCookies(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    redirect: "manual",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`로그인 API ${response.status}: ${body.slice(0, 200)}`);
  }

  const cookies = parseSetCookieHeaders(getSetCookieHeaders(response.headers));
  if (cookies.length === 0) {
    throw new Error("로그인 응답에서 세션 쿠키를 받지 못했습니다");
  }
  return cookies;
}

export function formatCookieHeader(cookies) {
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

export function parseCookieHeader(value) {
  return value
    .split(";")
    .map((item) => parseCookiePair(item.trim()))
    .filter(Boolean);
}

export function parseSetCookieHeaders(headers) {
  return headers.flatMap((header) => {
    const [pair] = header.split(";");
    return parseCookiePair(pair.trim()) ?? [];
  });
}

export function splitCombinedSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=)/).map((item) => item.trim());
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  return splitCombinedSetCookie(headers.get("set-cookie") || "");
}

function parseCookiePair(pair) {
  const index = pair.indexOf("=");
  if (index <= 0) return null;
  return {
    name: pair.slice(0, index).trim(),
    value: pair.slice(index + 1).trim(),
  };
}
