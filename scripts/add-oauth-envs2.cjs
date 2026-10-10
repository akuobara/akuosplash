const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function addEnvVar(key, value) {
  const r = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
  });
  const text = await r.text();
  console.log(`  ${key}: status=${r.status}`);
  console.log(`  Response: ${text.slice(0, 300)}`);
}

async function main() {
  // Verificar variables existentes primero
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const existing = await r.json();
  const keys = (existing.envs || []).map(e => e.key);
  console.log('Variables existentes:', keys.join(', '));

  // Si ya existen, actualizar en vez de crear
  const googleIdExists = keys.includes('AKUO_GOOGLE_CLIENT_ID');
  const googleSecretExists = keys.includes('AKUO_GOOGLE_CLIENT_SECRET');

  if (!googleIdExists) {
    console.log('\nAgregando AKUO_GOOGLE_CLIENT_ID...');
    await addEnvVar('AKUO_GOOGLE_CLIENT_ID', '109876197648-nkqitom82d4gqmu4ramisb2n5v7ejcg1.apps.googleusercontent.com');
  } else {
    console.log('AKUO_GOOGLE_CLIENT_ID ya existe — actualizando...');
    // Buscar el ID de la variable existente
    const envId = existing.envs.find(e => e.key === 'AKUO_GOOGLE_CLIENT_ID')?.id;
    if (envId) {
      const r2 = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${envId}?teamId=${TEAM_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: '109876197648-nkqitom82d4gqmu4ramisb2n5v7ejcg1.apps.googleusercontent.com', target: ['production', 'preview', 'development'] }),
      });
      console.log(`  Update: ${r2.status}`);
    }
  }

  if (!googleSecretExists) {
    console.log('\nAgregando AKUO_GOOGLE_CLIENT_SECRET...');
    await addEnvVar('AKUO_GOOGLE_CLIENT_SECRET', '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');
  } else {
    console.log('AKUO_GOOGLE_CLIENT_SECRET ya existe — actualizando...');
    const envId = existing.envs.find(e => e.key === 'AKUO_GOOGLE_CLIENT_SECRET')?.id;
    if (envId) {
      const r2 = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${envId}?teamId=${TEAM_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: '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', target: ['production', 'preview', 'development'] }),
      });
      console.log(`  Update: ${r2.status}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
