// Polling: cada 20s golpea /sync deployado hasta que devuelva 200 (deploy live) o 5 min.
const BASE = "https://akuosplash.cl";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "transtest3@akuosplash.test", password: "Test1234!" }),
  });
  const sc = res.headers.get("set-cookie") || "";
  const m = sc.match(/akuosplash_session=([^;]+)/);
  return m ? m[1] : null;
}

(async () => {
  const session = await login();
  if (!session) { console.log("✗ login falló"); return; }
  const start = Date.now();
  for (let i = 0; i < 15; i++) {
    const r = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/sync`, {
      headers: { Cookie: `akuosplash_session=${session}` },
    });
    const elapsed = Math.round((Date.now() - start) / 1000);
    let body = "";
    try { body = JSON.stringify(await r.json()); } catch { body = "(HTML " + r.status + ")"; }
    console.log(`[${elapsed}s] HTTP ${r.status} ${r.status === 200 ? body.slice(0, 120) : ""}`);
    if (r.status === 200) {
      // verificar plan activado
      const info = await (await fetch(`${BASE}/api/akuosplash/subscription/info?_t=${Date.now()}`, {
        headers: { Cookie: `akuosplash_session=${session}` },
      })).json();
      console.log("plan después:", info.subscripcion?.plan, "status:", info.subscripcion?.mpSubStatus);
      if (info.subscripcion?.plan === "premium") {
        console.log("\n✓✓✓ DEPLOY LIVE + /sync NUEVO FUNCIONA: plan activado a premium sin webhook.");
      }
      return;
    }
    await sleep(20000);
  }
  console.log("\n⏳ 5 min y sigue sin 200. El deploy no disparó (Render auto-deploy caput no está, o está tardando).");
})().catch(e => console.error("ERR", e.message));
