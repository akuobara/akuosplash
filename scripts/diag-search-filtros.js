// Diagnóstico: qué filtros de /preapproval/search encuentran la preapproval recién creada al instante.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const PLAN_ID = "b8ef259dab03454a81903ed0f8f626e0";
const PRE_ID = "e8b74fd5b21b499ba3666d2c2de96e5d";

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");
  const api = "https://api.mercadopago.com";

  // 1) GET directo a la preapproval (debe funcionar al instante)
  const g = await fetch(`${api}/preapproval/${PRE_ID}`, { headers: { Authorization: `Bearer ${TOK}` } });
  const d = await g.json();
  console.log("GET directo:", g.status, "status:", d.status, "preapproval_plan_id:", d.preapproval_plan_id, "ext_ref:", d.external_reference);

  // 2) Probar varios filtros de search
  const filtros = [
    `preapproval_plan_id=${PLAN_ID}`,
    `q=${PLAN_ID}`,
    `external_reference=akuo_sub:test_tran3_1794268715326:premium:mensual`,
    `payer_id=&preapproval_plan_id=${PLAN_ID}`,
  ];
  for (const f of filtros) {
    const r = await fetch(`${api}/preapproval/search?${f}`, { headers: { Authorization: `Bearer ${TOK}` } });
    const body = await r.json();
    const res = body.results || body.elements || [];
    const found = res.find(p => p.id === PRE_ID);
    console.log(`search ?${f.slice(0,40)}: HTTP ${r.status}, ${res.length} resultados, encontró e8b74fd5: ${found ? "SÍ" : "no"}`);
  }

  // 3) Esperar 10s y re-probar el search por preapproval_plan_id
  console.log("\nEsperando 10s para ver si el índice de search se actualiza...");
  await new Promise(r => setTimeout(r, 10000));
  const r2 = await fetch(`${api}/preapproval/search?preapproval_plan_id=${PLAN_ID}`, { headers: { Authorization: `Bearer ${TOK}` } });
  const b2 = await r2.json();
  const res2 = b2.results || b2.elements || [];
  const found2 = res2.find(p => p.id === PRE_ID);
  console.log(`search por preapproval_plan_id (+10s): ${res2.length} resultados, encontró e8b74fd5: ${found2 ? "SÍ ✓" : "no"}`);
})().catch(e => console.error("ERR", e.message));
