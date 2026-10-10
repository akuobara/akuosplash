const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // Habilitar DNS zone management para akuosplash.cl
  console.log('=== Habilitando DNS zone para akuosplash.cl ===');
  const r1 = await fetch(`https://api.vercel.com/v4/domains/akuosplash.cl?teamId=${TEAM_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone: true }),
  });
  const d1 = await r1.json();
  console.log('Status:', r1.status);
  console.log(JSON.stringify(d1, null, 2));

  // Verificar nameservers asignados
  console.log('\n=== Verificando nameservers después de habilitar ===');
  const r2 = await fetch(`https://api.vercel.com/v6/domains/akuosplash.cl?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d2 = await r2.json();
  console.log('nameservers:', d2.domain?.nameservers);
  console.log('intendedNameservers:', d2.domain?.intendedNameservers);
  console.log('zone:', d2.domain?.zone);
}
main().catch(e => { console.error(e); process.exit(1); });
