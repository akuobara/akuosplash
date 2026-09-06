// Helper para bloquear escritura en cuentas demo.
// Uso en cualquier endpoint de escritura (POST/PATCH/DELETE):
//
//   import { checkDemoBlock } from "@/lib/demo-guard";
//   export async function POST(req: NextRequest) {
//     const blocked = await checkDemoBlock();
//     if (blocked) return blocked;
//     ... resto del endpoint
//   }
import { NextResponse } from "next/server";
import { isDemoUser } from "@/lib/auth";

// Verifica si el usuario actual es demo. Si lo es, devuelve una respuesta 403
// que bloquea la operación. Si no, devuelve null (continuar normalmente).
export async function checkDemoBlock(): Promise<NextResponse | null> {
  const isDemo = await isDemoUser();
  if (isDemo) {
    return NextResponse.json(
      {
        error: "Cuenta de demostración",
        message: "Esta es una cuenta de demostración. No se pueden crear, editar ni eliminar datos.",
        isDemo: true,
      },
      { status: 403 }
    );
  }
  return null;
}
