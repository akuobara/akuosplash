import { NextResponse } from "next/server";

// Health check para Aljibe App
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "Aljibe App",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
