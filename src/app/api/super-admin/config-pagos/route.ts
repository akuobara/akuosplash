import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/super-admin/config-pagos
// Guarda los datos de transferencia globales en TODAS las configuraciones de admins.
// Los datos de transferencia se guardan en Configuracion.transfBanco, etc.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Guardar en todas las configuraciones existentes
    const configs = await db.configuracion.findMany();
    for (const cfg of configs) {
      await db.configuracion.update({
        where: { id: cfg.id },
        data: {
          transfBanco: body.transfBanco || null,
          transfTipoCuenta: body.transfTipoCuenta || null,
          transfNumeroCuenta: body.transfNumeroCuenta || null,
          transfTitular: body.transfTitular || null,
          transfRutTitular: body.transfRutTitular || null,
          transfEmail: body.transfEmail || null,
          transfTelefono: body.transfTelefono || null,
        },
      });
    }

    return NextResponse.json({ ok: true, configsActualizadas: configs.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
