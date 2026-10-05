import { NextResponse } from "next/server";
import { akuoClearSessionCookie } from "@/lib/akuosplash-auth";
export async function POST() { await akuoClearSessionCookie(); return NextResponse.json({ ok: true }); }
