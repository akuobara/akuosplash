const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // Obtener el último deployment de producción
  const r = await fetch(`https://api.vercel.com/v6/deployments?teamId=${TEAM_ID}&projectId=${PROJECT_ID}&limit=1&target=production`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await r.json();
  if (!data.deployments || data.deployments.length === 0) {
    console.log('No production deployments found');
    return;
  }
  const depId = data.deployments[0].uid;
  console.log('Latest production deployment:', depId);

  // Asignar akuosplash.cl
  console.log('\nAsignando akuosplash.cl...');
  const r1 = await fetch(`https://api.vercel.com/v13/deployments/${depId}/domains?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'akuosplash.cl' }),
  });
  console.log('Status:', r1.status, await r1.text());

  // Asignar www.akuosplash.cl
  console.log('\nAsignando www.akuosplash.cl...');
  const r2 = await fetch(`https://api.vercel.com/v13/deployments/${depId}/domains?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'www.akuosplash.cl' }),
  });
  console.log('Status:', r2.status, await r2.text());
}
main().catch(e => { console.error(e); process.exit(1); });
