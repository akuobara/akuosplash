import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { commitTransaction, getStatus } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/commit
// Re-confirma una transacción manualmente (debug o si la redirect falló).
// Body: { tokenWs }
// Solo superadmin (debug).
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const body = await req.json();
  const tokenWs = body.tokenWs;
  if (!tokenWs) return NextResponse.json({ error: "Falta tokenWs" }, { status: 400 });

  try {
    const commit = await commitTransaction(tokenWs);
    return NextResponse.json({ commit });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/akuosplash/subscription/transbank/commit?tokenWs=...
// Consulta el estado sin confirmar (debug).
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const url = new URL(req.url);
  const tokenWs = url.searchParams.get("tokenWs");
  if (!tokenWs) return NextResponse.json({ error: "Falta tokenWs" }, { status: 400 });

  try {
    const status = await getStatus(tokenWs);
    return NextResponse.json({ status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
