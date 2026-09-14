import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// PATCH /api/super-admin/cupones/[id] — editar cupón
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Verificar que existe
  const existente = await db.cuponDescuento.findUnique({ where: { id } });
  if (!existente) {
    return NextResponse.json({ error: "Cupón no encontrado" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.codigo !== undefined) {
    const codigo = String(body.codigo).trim().toUpperCase();
    if (codigo.length < 3 || codigo.length > 40) {
      return NextResponse.json({ error: "El código debe tener entre 3 y 40 caracteres" }, { status: 400 });
    }
    if (!/^[A-Z0-9\-_]+$/.test(codigo)) {
      return NextResponse.json({ error: "El código solo puede contener letras, números, guiones y guiones bajos" }, { status: 400 });
    }
    // Verificar duplicado (excluyendo el propio)
    const dup = await db.cuponDescuento.findUnique({ where: { codigo } });
    if (dup && dup.id !== id) {
      return NextResponse.json({ error: `Ya existe otro cupón con código "${codigo}"` }, { status: 400 });
    }
    data.codigo = codigo;
  }

  if (body.descripcion !== undefined) {
    data.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  }
  if (body.tipo !== undefined) {
    const tipo = body.tipo === "monto_fijo" ? "monto_fijo" : "porcentaje";
    data.tipo = tipo;
  }
  if (body.valor !== undefined) {
    const valor = Number(body.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "El valor debe ser un número positivo" }, { status: 400 });
    }
    if (data.tipo === "porcentaje" && valor > 100) {
      return NextResponse.json({ error: "El porcentaje no puede ser mayor a 100" }, { status: 400 });
    }
    if (existente.tipo === "porcentaje" && valor > 100) {
      return NextResponse.json({ error: "El porcentaje no puede ser mayor a 100" }, { status: 400 });
    }
    data.valor = valor;
  }
  if (body.montoMinimo !== undefined) {
    data.montoMinimo = body.montoMinimo === null || body.montoMinimo === ""
      ? null
      : Number(body.montoMinimo);
  }
  if (body.usosMaximos !== undefined) {
    data.usosMaximos = body.usosMaximos === null || body.usosMaximos === ""
      ? null
      : Number(body.usosMaximos);
  }
  if (body.activo !== undefined) {
    data.activo = !!body.activo;
  }
  if (body.validoDesde !== undefined) {
    data.validoDesde = body.validoDesde ? new Date(body.validoDesde) : null;
  }
  if (body.validoHasta !== undefined) {
    data.validoHasta = body.validoHasta ? new Date(body.validoHasta) : null;
  }
  if (body.zonaId !== undefined) {
    data.zonaId = body.zonaId || null;
  }

  const cupon = await db.cuponDescuento.update({ where: { id }, data });
  return NextResponse.json({ cupon });
}

// DELETE /api/super-admin/cupones/[id] — eliminar cupón
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const existente = await db.cuponDescuento.findUnique({ where: { id } });
  if (!existente) {
    return NextResponse.json({ error: "Cupón no encontrado" }, { status: 404 });
  }

  await db.cuponDescuento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
