import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/cupones — listar todos los cupones
export async function GET(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const incluirInactivos = searchParams.get("inactivos") === "1";

  const cupones = await db.cuponDescuento.findMany({
    where: incluirInactivos ? {} : { activo: true },
    orderBy: { creadoEn: "desc" },
    include: { zona: { select: { id: true, nombre: true } } },
  });
  return NextResponse.json({ cupones });
}

// POST /api/super-admin/cupones — crear cupón
export async function POST(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();

  // Validaciones
  const codigo = String(body.codigo || "").trim().toUpperCase();
  if (!codigo) {
    return NextResponse.json({ error: "El código es obligatorio" }, { status: 400 });
  }
  if (codigo.length < 3 || codigo.length > 40) {
    return NextResponse.json({ error: "El código debe tener entre 3 y 40 caracteres" }, { status: 400 });
  }
  // Solo letras, números, guiones y guiones bajos
  if (!/^[A-Z0-9\-_]+$/.test(codigo)) {
    return NextResponse.json({ error: "El código solo puede contener letras, números, guiones y guiones bajos" }, { status: 400 });
  }

  const tipo = body.tipo === "monto_fijo" ? "monto_fijo" : "porcentaje";
  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "El valor debe ser un número positivo" }, { status: 400 });
  }
  if (tipo === "porcentaje" && valor > 100) {
    return NextResponse.json({ error: "El porcentaje no puede ser mayor a 100" }, { status: 400 });
  }

  const montoMinimo = body.montoMinimo != null && body.montoMinimo !== "" ? Number(body.montoMinimo) : null;
  if (montoMinimo != null && (Number.isNaN(montoMinimo) || montoMinimo < 0)) {
    return NextResponse.json({ error: "Monto mínimo inválido" }, { status: 400 });
  }

  const usosMaximos = body.usosMaximos != null && body.usosMaximos !== "" ? Number(body.usosMaximos) : null;
  if (usosMaximos != null && (!Number.isInteger(usosMaximos) || usosMaximos < 0)) {
    return NextResponse.json({ error: "Usos máximos debe ser un entero positivo" }, { status: 400 });
  }

  // Validar fechas
  let validoDesde: Date | null = null;
  let validoHasta: Date | null = null;
  if (body.validoDesde) {
    validoDesde = new Date(body.validoDesde);
    if (isNaN(validoDesde.getTime())) {
      return NextResponse.json({ error: "validoDesde inválida" }, { status: 400 });
    }
  }
  if (body.validoHasta) {
    validoHasta = new Date(body.validoHasta);
    if (isNaN(validoHasta.getTime())) {
      return NextResponse.json({ error: "validoHasta inválida" }, { status: 400 });
    }
  }
  if (validoDesde && validoHasta && validoDesde > validoHasta) {
    return NextResponse.json({ error: "validoDesde no puede ser posterior a validoHasta" }, { status: 400 });
  }

  // Verificar que el código no exista
  const existente = await db.cuponDescuento.findUnique({ where: { codigo } });
  if (existente) {
    return NextResponse.json({ error: `Ya existe un cupón con código "${codigo}"` }, { status: 400 });
  }

  const cupon = await db.cuponDescuento.create({
    data: {
      codigo,
      descripcion: body.descripcion?.trim() || null,
      tipo,
      valor,
      montoMinimo,
      usosMaximos,
      usosActuales: 0,
      activo: body.activo !== false,
      validoDesde,
      validoHasta,
      creadoPorId: session.userId,
      zonaId: body.zonaId || null,
    },
  });

  return NextResponse.json({ cupon }, { status: 201 });
}
