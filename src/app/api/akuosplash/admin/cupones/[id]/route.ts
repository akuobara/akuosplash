import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// PATCH /api/akuosplash/admin/cupones/[id]
// Actualiza un cupón existente.
// Body: { codigo?, descuentoValor?, minMonto?, maxUsos?, fechaFin?, activo?, nota?, descripcionPublica? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const { id } = await params;
  const body = await req.json();

  // Construir SET clause dinámicamente
  const fields: string[] = [];
  const values: any[] = [];
  if (body.codigo !== undefined) {
    const codigo = (body.codigo || "").trim().toUpperCase();
    if (!codigo) return NextResponse.json({ error: "Código no puede ser vacío" }, { status: 400 });
    fields.push("codigo = ?"); values.push(codigo);
  }
  if (body.descuentoValor !== undefined) {
    if (typeof body.descuentoValor !== "number" || body.descuentoValor < 0) {
      return NextResponse.json({ error: "descuentoValor inválido" }, { status: 400 });
    }
    fields.push("descuentoValor = ?"); values.push(body.descuentoValor);
  }
  if (body.minMonto !== undefined) { fields.push("minMonto = ?"); values.push(body.minMonto); }
  if (body.maxUsos !== undefined) { fields.push("maxUsos = ?"); values.push(body.maxUsos); }
  if (body.fechaFin !== undefined) {
    fields.push("fechaFin = ?");
    values.push(body.fechaFin ? new Date(body.fechaFin).toISOString() : null);
  }
  if (body.activo !== undefined) { fields.push("activo = ?"); values.push(body.activo ? 1 : 0); }
  if (body.nota !== undefined) { fields.push("nota = ?"); values.push(body.nota); }
  if (body.descripcionPublica !== undefined) { fields.push("descripcionPublica = ?"); values.push(body.descripcionPublica); }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar" }, { status: 400 });
  }

  // actualizadoEn
  fields.push("actualizadoEn = ?");
  values.push(new Date().toISOString());
  values.push(id);

  try {
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoCupon SET ${fields.join(", ")} WHERE id = ?`,
      ...values
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo actualizar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}

// DELETE /api/akuosplash/admin/cupones/[id]
// Elimina un cupón (soft delete — lo marca como inactivo, o hard delete si ?hard=true)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const { id } = await params;
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  try {
    if (hard) {
      // Hard delete — borra el cupón y todos sus usos (via ON DELETE CASCADE)
      await akuosplashDb.$executeRawUnsafe(`DELETE FROM AkuoCupon WHERE id = ?`, id);
    } else {
      // Soft delete — marca como inactivo
      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoCupon SET activo = 0, actualizadoEn = ? WHERE id = ?`,
        new Date().toISOString(), id
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo eliminar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, hard });
}
