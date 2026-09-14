import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// POST /api/cliente/cupones/validar
// Valida un código de cupón para el pedido actual y devuelve el descuento aplicable.
// Body: { codigo: string, monto: number }
// Respuesta: { valido: true, cupon: {...}, descuento: number, montoFinal: number, mensaje: string }
//        o  { valido: false, error: string }
export async function POST(req: NextRequest) {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    if (!codigo) {
      return NextResponse.json({ valido: false, error: "Ingresá un código" }, { status: 400 });
    }

    const monto = Number(body.monto);
    if (!Number.isFinite(monto) || monto < 0) {
      return NextResponse.json({ valido: false, error: "Monto inválido" }, { status: 400 });
    }

    // Buscar el cupón
    const cupon = await db.cuponDescuento.findUnique({
      where: { codigo },
      include: { zona: { select: { id: true, nombre: true } } },
    });

    if (!cupon) {
      return NextResponse.json({ valido: false, error: `El código "${codigo}" no existe` });
    }

    if (!cupon.activo) {
      return NextResponse.json({ valido: false, error: "Este cupón ya no está activo" });
    }

    const ahora = new Date();
    if (cupon.validoDesde && ahora < cupon.validoDesde) {
      return NextResponse.json({ valido: false, error: "Este cupón aún no es válido" });
    }
    if (cupon.validoHasta && ahora > cupon.validoHasta) {
      return NextResponse.json({ valido: false, error: "Este cupón ya expiró" });
    }

    if (cupon.usosMaximos != null && cupon.usosActuales >= cupon.usosMaximos) {
      return NextResponse.json({ valido: false, error: "Este cupón alcanzó su límite de usos" });
    }

    if (cupon.montoMinimo != null && monto < cupon.montoMinimo) {
      return NextResponse.json({
        valido: false,
        error: `Necesitás un pedido mínimo de $${Math.round(cupon.montoMinimo).toLocaleString("es-CL")} para usar este cupón`,
      });
    }

    // Validar zona del cliente
    const cliente = await db.clienteApp.findUnique({
      where: { id: session.clienteId },
      select: { zonaId: true },
    });
    if (!cliente) {
      return NextResponse.json({ valido: false, error: "Cliente no encontrado" });
    }
    if (cupon.zonaId && cliente.zonaId !== cupon.zonaId) {
      const zonaNombre = cupon.zona?.nombre || "una zona específica";
      return NextResponse.json({
        valido: false,
        error: `Este cupón solo es válido para la zona "${zonaNombre}"`,
      });
    }

    // Calcular descuento
    let descuento = 0;
    if (cupon.tipo === "porcentaje") {
      descuento = Math.round(monto * (cupon.valor / 100));
    } else {
      // monto_fijo
      descuento = Math.min(Math.round(cupon.valor), Math.round(monto));
    }

    const montoFinal = Math.max(0, Math.round(monto) - descuento);

    return NextResponse.json({
      valido: true,
      cupon: {
        id: cupon.id,
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        valor: cupon.valor,
        descripcion: cupon.descripcion,
      },
      descuento,
      montoFinal,
      mensaje: `Cupón aplicado: descuento de $${descuento.toLocaleString("es-CL")}`,
    });
  } catch (e) {
    console.error("[cliente/cupones/validar]", e);
    return NextResponse.json(
      { valido: false, error: "No se pudo validar el cupón" },
      { status: 500 }
    );
  }
}
