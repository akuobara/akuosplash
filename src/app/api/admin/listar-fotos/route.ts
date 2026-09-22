import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/listar-fotos
// Lista todas las fotos:
// 1. Blobs en Vercel Blob Storage
// 2. Entregas con fotoMedidorUrl (incluye base64 fallback)
// Útil para recuperar fotos perdidas
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // 1. Listar blobs en Vercel Blob Storage
  let blobs: any[] = [];
  let blobError: string | null = null;
  try {
    const result = await list({ limit: 100 });
    blobs = result.blobs.map(b => ({
      pathname: b.pathname,
      url: b.url,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }));
  } catch (e) {
    blobError = e instanceof Error ? e.message : String(e);
  }

  // 2. Listar entregas con fotoMedidorUrl
  const entregasConFoto = await db.entrega.findMany({
    where: { duenoId, fotoMedidorUrl: { not: null } },
    select: {
      id: true,
      fecha: true,
      clienteNombre: true,
      litros: true,
      total: true,
      fotoMedidorUrl: true,
    },
    orderBy: { fecha: "desc" },
  });

  // 3. Listar entregas con fotos en detalleEstanquesJson
  const entregasConEstanqueFoto = await db.entrega.findMany({
    where: {
      duenoId,
      detalleEstanquesJson: { contains: "fotoUrl" },
    },
    select: {
      id: true,
      fecha: true,
      clienteNombre: true,
      detalleEstanquesJson: true,
    },
    orderBy: { fecha: "desc" },
  });

  // Extraer fotos de detalleEstanquesJson
  const fotosEstanques: any[] = [];
  for (const e of entregasConEstanqueFoto) {
    try {
      const estanques = JSON.parse(e.detalleEstanquesJson || "[]");
      for (const est of estanques) {
        if (est.fotoUrl) {
          fotosEstanques.push({
            entregaId: e.id,
            fecha: String(e.fecha),
            cliente: e.clienteNombre,
            estanque: est.nombre || "Sin nombre",
            fotoUrl: est.fotoUrl,
          });
        }
      }
    } catch {}
  }

  return NextResponse.json({
    resumen: {
      blobs_en_storage: blobs.length,
      entregas_con_foto_medidor: entregasConFoto.length,
      fotos_en_estanques: fotosEstanques.length,
      blob_error: blobError,
    },
    blobs,
    entregas_con_foto: entregasConFoto.map(e => ({
      id: e.id,
      fecha: String(e.fecha),
      cliente: e.clienteNombre,
      litros: e.litros,
      total: e.total,
      fotoUrl: e.fotoMedidorUrl?.substring(0, 80) + (e.fotoMedidorUrl && e.fotoMedidorUrl.length > 80 ? "..." : ""),
      is_base64: e.fotoMedidorUrl?.startsWith("data:"),
    })),
    fotos_estanques: fotosEstanques.map(f => ({
      ...f,
      fotoUrl: f.fotoUrl?.substring(0, 80) + (f.fotoUrl && f.fotoUrl.length > 80 ? "..." : ""),
      is_base64: f.fotoUrl?.startsWith("data:"),
    })),
  });
}
