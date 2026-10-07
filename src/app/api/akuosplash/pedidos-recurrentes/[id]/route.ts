import { NextRequest, NextResponse } from "next/server";

// PATCH /api/akuosplash/pedidos-recurrentes/[id]
export async function PATCH() {
  return NextResponse.json({ ok: true });
}

// DELETE /api/akuosplash/pedidos-recurrentes/[id]
export async function DELETE() {
  return NextResponse.json({ ok: true });
}
