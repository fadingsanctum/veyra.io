import { NextRequest, NextResponse } from "next/server";
import { jobQueue } from "@/lib/queue";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sanitizeBool, sanitizeContainer, sanitizeFilenameTemplate, sanitizeFormatString, sanitizeUrl } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`download:${ip}`, 40, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: { code: "rate_limited", message: `Download limit reached. Try again in ${rl.retryAfterSec}s.` } },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  }
  const b = (body ?? {}) as {
    url?: unknown;
    format?: unknown;
    mergeFormat?: unknown;
    extractAudio?: unknown;
    audioFormat?: unknown;
    filenameTemplate?: unknown;
    concurrentLimit?: unknown;
  };

  const url = sanitizeUrl(b.url);
  if (!url) {
    return NextResponse.json({ ok: false, error: { code: "invalid_url", message: "Invalid URL." } }, { status: 400 });
  }

  const format = sanitizeFormatString(b.format);
  if (!format) {
    return NextResponse.json({ ok: false, error: { code: "invalid_format", message: "Invalid format selection." } }, { status: 400 });
  }

  const extractAudio = sanitizeBool(b.extractAudio);
  const audioFormat = extractAudio ? sanitizeContainer(b.audioFormat) ?? "mp3" : undefined;
  const mergeFormat = !extractAudio ? sanitizeContainer(b.mergeFormat) ?? undefined : undefined;
  const filenameTemplate = sanitizeFilenameTemplate(b.filenameTemplate);

  const requestedConcurrency = typeof b.concurrentLimit === "number" ? Math.round(b.concurrentLimit) : NaN;
  if (Number.isFinite(requestedConcurrency) && requestedConcurrency >= 1 && requestedConcurrency <= 8) {
    jobQueue.maxConcurrent = requestedConcurrency;
  }

  const job = jobQueue.enqueue({ url, format, mergeFormat, extractAudio, audioFormat, filenameTemplate });
  return NextResponse.json({ ok: true, job });
}
