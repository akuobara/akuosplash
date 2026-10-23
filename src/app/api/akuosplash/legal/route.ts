import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/legal
// Devuelve el contenido de las páginas legales (público, sin auth).
// Response: { terminos, privacidad, empresa }
export async function GET() {
  await ensureAkuoConfigColumns();
  let content: any = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT legalPagesJson FROM AkuoConfig WHERE activo = 1 LIMIT 1`
    );
    if (Array.isArray(r) && r.length > 0 && r[0]?.legalPagesJson) {
      content = JSON.parse(r[0].legalPagesJson);
    }
  } catch {}

  // Defaults si no hay contenido guardado
  return NextResponse.json({
    terminos: content?.terminos || {
      version: "1.0",
      lastUpdated: null,
      content: "",
    },
    privacidad: content?.privacidad || {
      version: "1.0",
      lastUpdated: null,
      content: "",
    },
    empresa: content?.empresa || {
      razonSocial: "Akuologistic SpA",
      rut: "",
      direccion: "",
      comuna: "",
      ciudad: "Santiago",
      email: "contacto@akuosplash.cl",
      telefono: "",
      giro: "Servicios de tecnología y logística",
    },
  });
}
