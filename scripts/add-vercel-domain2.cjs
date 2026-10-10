const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // 1) Agregar akuosplash.cl (sin gitBranch — deploy directo, no Git)
  console.log('=== Agregando akuosplash.cl ===');
  const r1 = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'akuosplash.cl' }),
  });
  const d1 = await r1.json();
  console.log('Status:', r1.status);
  console.log(JSON.stringify(d1, null, 2));

  // 2) Agregar www.akuosplash.cl como redirect a akuosplash.cl
  console.log('\n=== Agregando www.akuosplash.cl ===');
  const r2 = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'www.akuosplash.cl', redirect: 'akuosplash.cl' }),
  });
  const d2 = await r2.json();
  console.log('Status:', r2.status);
  console.log(JSON.stringify(d2, null, 2));

  // 3) Listar dominios + info de verificación DNS
  console.log('\n=== Dominios del proyecto (con info DNS) ===');
  const r3 = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d3 = await r3.json();
  for (const d of (d3.domains || [])) {
    console.log(`\n  Dominio: ${d.name}`);
    console.log(`    verified: ${d.verified}`);
    if (d.verification && d.verification.length > 0) {
      for (const v of d.verification) {
        console.log(`    DNS verification record:`);
        console.log(`      Type: ${v.type}`);
        console.log(`      Name: ${v.name}`);
        console.log(`      Value: ${v.value}`);
      }
    }
    if (d.redirect) {
      console.log(`    redirect → ${d.redirect.redirectTo || d.redirect}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
