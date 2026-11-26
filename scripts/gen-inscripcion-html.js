// Genera un HTML auto-submit con el TBK_TOKEN de la inscripción pendiente de transtest3,
// para que el usuario lo abra en su navegador (IP casera) y pase el WAF de Transbank.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const URL_WEBPAY = "https://webpay3gint.transbank.cl/webpayserver/bp_multicode_inscription.cgi";
const OUT = "/home/z/my-project/download/oneclick-inscripcion.html";

(async () => {
  const r = await db.execute({
    sql: "SELECT tbkInscriptionToken, tbkUsername, tbkInscriptionStatus FROM AkuoUsuario WHERE email=?",
    args: ["transtest3@akuosplash.test"],
  });
  const row = r.rows[0];
  if (!row || !row.tbkInscriptionToken) { console.log("✗ no hay token pendiente"); return; }
  const token = row.tbkInscriptionToken;
  console.log("token:", token.slice(0, 16) + "...", "| status:", row.tbkInscriptionStatus, "| user:", row.tbkUsername);

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inscripción Oneclick — Transbank</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#222}
.box{background:#f6f7f9;border:1px solid #e2e5ea;border-radius:8px;padding:16px;margin:16px 0}
code{background:#eef;padding:2px 6px;border-radius:3px;font-size:13px;word-break:break-all}
.btn{display:inline-block;background:#2962ff;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600}</style>
</head><body>
<h2>Inscripción Oneclick — ambiente de integración</h2>
<p>Este archivo auto-envía el formulario a Transbank. Si no te redirigió automáticamente, tocá el botón:</p>
<form id="f" method="POST" action="${URL_WEBPAY}">
  <input type="hidden" name="TBK_TOKEN" value="${token}">
  <button class="btn" type="submit">Ir a inscribir tarjeta →</button>
</form>
<div class="box">
<p><strong>Datos de prueba</strong> (tarjeta Oneclick integración):</p>
<p>Tarjeta: <code>VISA 4051 8856 0044 6623</code><br>
CVV: <code>123</code> &nbsp; Venc: <code>12/28</code> (cualquier fecha futura)<br>
RUT: <code>11.111.111-1</code> &nbsp; Clave: <code>123</code></p>
</div>
<p style="color:#666;font-size:13px">Tras inscribir, Transbank te redirige a akuosplash.cl. Después avisale al asistente para correr el authorize + refund.</p>
<script>document.getElementById('f').submit();</script>
</body></html>`;
  fs.writeFileSync(OUT, html);
  console.log("\n✓ HTML generado:", OUT);
  console.log("  Abrí ese archivo en tu navegador (doble clic). Se auto-envía a Transbank desde tu IP.");
})().catch(e => console.error("ERR", e.message));
