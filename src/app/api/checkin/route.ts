import { NextResponse } from "next/server";

import type { CheckinResult } from "@/lib/checkin/types";
import { createClient } from "@/lib/supabase/server";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  let token = "";

  try {
    const body = await request.json() as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_checkin", { p_token: token });
  const result = data?.[0] as CheckinResult | undefined;

  if (error || !result) {
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }

  return NextResponse.json(result, {
    status: result.result_code === "rate_limited" ? 429 : 200,
    headers: { "Cache-Control": "private, no-store", ...(result.result_code === "rate_limited" ? { "Retry-After": "60" } : {}) },
  });
}
