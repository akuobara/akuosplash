import { NextRequest, NextResponse } from "next/server";

// POST /api/upload — TEMPORARIO: sin @vercel/blob (causa build failure en Render)
export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Upload temporalmente no disponible" }, { status: 503 });
}
