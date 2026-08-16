import { NextRequest, NextResponse } from "next/server";
import { probeUrl, EngineError } from "@/lib/engine";
import { sanitizeUrl } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`resolve:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: { code: "rate_limited", message: `Too many requests. Try again in ${rl.retryAfterSec}s.` } },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  }

  const url = sanitizeUrl((body as { url?: unknown })?.url);
  if (!url) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_url", message: "That doesn't look like a valid link. Paste a full URL starting with http(s)://" } },
      { status: 400 },
    );
  }

  try {
    const result = await probeUrl(url);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof EngineError) {
      return NextResponse.json({ ok: false, error: { code: e.code, message: e.message } }, { status: 422 });
    }
    return NextResponse.json(
      { ok: false, error: { code: "unknown", message: "Unexpected error while probing the link. Try again." } },
      { status: 500 },
    );
  }
}
