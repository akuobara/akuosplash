const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function main() {
  // Verificar si ya existen
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await r.json();
  const existing = (data.envs || []).filter(e => e.key.includes('FACEBOOK'));
  
  if (existing.length > 0) {
    // Actualizar existentes
    for (const e of existing) {
      let value = e.key === 'AKUO_FACEBOOK_APP_ID' ? '2095394961067992' : '5c3e50ecf3087d4f498a8bee1e853055';
      const r2 = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${e.id}?teamId=${TEAM_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, target: ['production', 'preview', 'development'] }),
      });
      console.log(`  ${e.key}: ${r2.status === 200 ? '✓ actualizado' : '✗ error'}`);
    }
  } else {
    // Crear nuevas
    for (const [key, value] of [['AKUO_FACEBOOK_APP_ID', '2095394961067992'], ['AKUO_FACEBOOK_APP_SECRET', '5c3e50ecf3087d4f498a8bee1e853055']]) {
      const r2 = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
      });
      console.log(`  ${key}: ${r2.status === 200 ? '✓ creada' : '✗ error'}`);
    }
  }
  console.log('\n✓ Listo. Deploy para activar.');
}
main().catch(e => { console.error(e); process.exit(1); });
