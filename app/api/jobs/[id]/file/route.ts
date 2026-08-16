import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { jobQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  }

  const job = jobQueue.get(id);
  if (!job || job.status !== "done" || !job.filename) {
    return NextResponse.json(
      { ok: false, error: { code: "not_ready", message: "The file isn't ready yet." } },
      { status: 409 },
    );
  }

  const filePath = path.join(os.tmpdir(), "veyra-jobs", id, job.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "The file has expired. Download it again." } },
      { status: 404 },
    );
  }

  const stream = fs.createReadStream(filePath);
  const ascii = job.filename.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(job.filename).replace(/'/g, "%27").replace(/\*/g, "%2A");

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(job.size ?? 0),
      "Cache-Control": "no-store",
    },
  });
}
