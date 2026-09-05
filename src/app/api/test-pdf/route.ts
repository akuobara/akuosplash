import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";

// Test minimal de generación de PDF
export async function GET() {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFontSize(18);
    doc.text("Test PDF - Aljibe", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toISOString()}`, 14, 25);

    const pdfBuffer = doc.output("arraybuffer");
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="test.pdf"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return NextResponse.json(
      { error: msg, stack: stack?.split("\n").slice(0, 10) },
      { status: 500 }
    );
  }
}
