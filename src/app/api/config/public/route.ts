import { NextResponse } from "next/server";

// GET /api/config/public — configuración pública (sin auth)
// Expone si Google Sign-In está disponible para que el frontend muestre/oculte el botón.
export async function GET() {
  return NextResponse.json({
    googleLoginEnabled: !!process.env.GOOGLE_CLIENT_ID,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
}
