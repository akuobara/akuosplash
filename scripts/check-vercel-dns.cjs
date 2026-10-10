const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // 1) Ver detalles del dominio akuosplash.cl
  console.log('=== Detalles del dominio akuosplash.cl ===');
  const r1 = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/akuosplash.cl?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d1 = await r1.json();
  console.log(JSON.stringify(d1, null, 2));

  // 2) Listar DNS records existentes
  console.log('\n=== DNS records actuales ===');
  const r2 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl/records?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d2 = await r2.json();
  console.log(JSON.stringify(d2, null, 2));

  // 3) Verificar nameservers del dominio
  console.log('\n=== Nameservers ===');
  const r3 = await fetch(`https://api.vercel.com/v6/domains/akuosplash.cl?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d3 = await r3.json();
  console.log(JSON.stringify(d3, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
