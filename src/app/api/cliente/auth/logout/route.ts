import { NextResponse } from "next/server";
import { clearSessionCookieCliente } from "@/lib/auth-cliente";

// POST /api/cliente/auth/logout
export async function POST() {
  await clearSessionCookieCliente();
  return NextResponse.json({ ok: true });
}
