import json

with open('/home/z/my-project-akuosplash-cf/package.json') as f:
    pkg = json.load(f)

# Sacar deps no necesarias
for dep in ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@mdxeditor/editor', '@reactuses/core', 'jspdf', 'jspdf-autotable', 'xlsx', '@vercel/blob']:
    if dep in pkg.get('dependencies', {}):
        del pkg['dependencies'][dep]
        print(f'removed: {dep}')

# Agregar deps para Cloudflare Pages + R2
pkg['dependencies']['@cloudflare/next-on-pages'] = '^1.13.7'
pkg['dependencies']['@aws-sdk/client-s3'] = '^3.700.0'
pkg['dependencies']['wrangler'] = '^4.0.0'

# Cambiar build script para Cloudflare
pkg['scripts']['build:cf'] = 'npx @cloudflare/next-on-pages'
pkg['scripts']['deploy:cf'] = 'npx wrangler pages deploy .vercel/output/static --project-name=akuosplash'

with open('/home/z/my-project-akuosplash-cf/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)

print(f'\ntotal deps: {len(pkg.get("dependencies", {}))}')
print(f'scripts: {list(pkg.get("scripts", {}).keys())}')
