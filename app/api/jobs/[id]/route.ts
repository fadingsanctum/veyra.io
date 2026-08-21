import { NextRequest, NextResponse } from "next/server";
import { jobQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  const job = jobQueue.get(id);
  if (!job) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  return NextResponse.json(
    { ok: true, job },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const removed = jobQueue.remove(id);
  if (!removed) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true });
}
