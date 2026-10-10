const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function addEnvVar(key, value, targets = ['production', 'preview', 'development']) {
  const r = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type: 'encrypted', target: targets }),
  });
  const data = await r.json();
  console.log(`  ${key}: ${r.status === 200 ? '✓ OK' : '✗ Error'} ${data.error?.message || ''}`);
  return r.status;
}

async function main() {
  console.log('=== Agregando variables de entorno OAuth a Vercel ===\n');

  // Google OAuth
  console.log('Google OAuth:');
  await addEnvVar('AKUO_GOOGLE_CLIENT_ID', '109876197648-nkqitom82d4gqmu4ramisb2n5v7ejcg1.apps.googleusercontent.com');
  await addEnvVar('AKUO_GOOGLE_CLIENT_SECRET', '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');

  console.log('\n✓ Listo. Las variables están configuradas en Vercel.');
  console.log('El próximo deploy va a activar Google OAuth automáticamente.');
}
main().catch(e => { console.error(e); process.exit(1); });
