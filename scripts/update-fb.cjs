const fs = require('fs');
const TOKEN = fs.readFileSync('/home/z/my-project/.vercel-token', 'utf8').trim();
const PROJECT_ID = 'prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5';
const TEAM_ID = 'team_BcC6nLGDaPF8NFDXQ6q97JsX';

async function update(id, key, value) {
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${id}?teamId=${TEAM_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, target: ['production', 'preview', 'development'] }),
  });
  console.log(`  ${key}: ${r.status === 200 ? '✓' : '✗'} (${r.status})`);
}

async function main() {
  await update('Wj55FXaFPspeGS8r', 'AKUO_FACEBOOK_APP_ID', '2095394961067992');
  await update('biDMSiQLR4euBxJZ', 'AKUO_FACEBOOK_APP_SECRET', '5c3e50ecf3087d4f498a8bee1e853055');
  console.log('\n✓ Credenciales de Facebook actualizadas');
}
main().catch(e => { console.error(e); process.exit(1); });
