// POST /api/bolson/auth/logout — cierra sesión Bolsón
import { NextResponse } from "next/server";
import { bolsonClearSessionCookie } from "@/lib/bolson-auth";

export async function POST() {
  await bolsonClearSessionCookie();
  return NextResponse.json({ ok: true });
}
