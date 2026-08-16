import { NextResponse } from "next/server";
import { extractors } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sites = await extractors();
  return NextResponse.json({ ok: true, count: sites.length, sites });
}
