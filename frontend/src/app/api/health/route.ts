import { NextRequest, NextResponse } from "next/server";

import { proxyUpstreamPath } from "../v1/[...path]/apiProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await proxyUpstreamPath(request, "/api/health", AbortSignal.timeout(5_000));
  } catch {
    return NextResponse.json(
      { status: "오류" },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
