import { NextResponse } from "next/server";
import { jobQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, jobs: jobQueue.list() });
}
