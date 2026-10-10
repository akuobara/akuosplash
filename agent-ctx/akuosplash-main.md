# AkuoSplash — Build Summary

## App overview
AkuoSplash is a new water delivery management app coexisting with Aljibe (prototype) and Bolsón (transport marketplace) inside the same Next.js project.

- **Routes**: `/akuosplash` (landing), `/akuosplash/transportista`, `/akuosplash/cliente`, `/akuosplash/superadmin`
- **API**: `/api/akuosplash/*` (auth, transportista, cliente, superadmin)
- **DB**: Prisma client at `src/generated/akuosplash-client/` (SQLite local file via `AKUOSPLASH_DATABASE_URL`)
- **Schema**: `prisma/schema-akuosplash.prisma` — all tables prefixed `Akuo*` for isolation
- **Theme**: Same blue (#2563EB) as Aljibe (NOT orange/green like Bolsón)

## Files created

### Lib
- `src/lib/akuosplash-db.ts` — Prisma client (mirrors `bolson-db.ts`)
- `src/lib/akuosplash-auth.ts` — JWT sessions, bootstrap superadmin, audit log, config helpers

### API routes (`src/app/api/akuosplash/`)
- `auth/register` — POST email+password+nombre+rol → creates user; first user becomes superadmin
- `auth/login` — POST email+password
- `auth/solicitar-codigo` — POST email → 6-digit code (dev returns it)
- `auth/verificar-codigo` — POST email+código → session (creates user if not exists)
- `auth/me` — GET current user
- `auth/logout` — POST
- `auth/google` — GET (stub: HTML page "próximamente")
- `auth/facebook` — GET (stub: HTML page "próximamente")
- `transportista/perfil` — GET/PATCH personal+empresa+vehículo+cobertura
- `transportista/vehiculos` — GET/POST (freemium: rejects if `vehiculosPermitidos` exceeded)
- `transportista/vehiculos/[id]` — PATCH/DELETE
- `transportista/pedidos` — GET pendientes + historial
- `transportista/clientes` — GET/POST (catálogo)
- `transportista/clientes/[id]` — PATCH/DELETE
- `transportista/entregas` — GET/POST (registers delivery; can link pedidoId → marks pedido as entregado)
- `transportista/suscripcion` — POST { plan } → upgrades plan + vehiculosPermitidos
- `cliente/pedidos` — GET (own pedidos + available transportistas) / POST (request water)
- `superadmin/usuarios` — GET (with filters + stats)
- `superadmin/usuarios/[id]` — PATCH (approve/ban/change role/change plan)
- `superadmin/metricas` — GET KPIs (usuarios, pedidos, entregas, suscripciones, top transportistas 30d)
- `superadmin/config` — GET/PATCH (comisión, precios planes, límites vehículos)

### Frontend components (`src/components/akuosplash/`)
- `akuosplash-utils.ts` — CLP formatters, state labels/colors, `akuoGet/Post/Patch/Delete` API helpers
- `akuosplash-landing.tsx` — landing + login modal (3 modes: código/password/register) + OAuth buttons (stub)
- `akuosplash-transportista.tsx` — 5 tabs: Perfil, Pedidos, Historial, Clientes, Suscripción
- `akuosplash-cliente.tsx` — 2 tabs: Pedir agua, Mis pedidos
- `akuosplash-superadmin.tsx` — 3 tabs: Métricas, Usuarios, Configuración

### Route pages (`src/app/akuosplash/`)
- `page.tsx` → landing
- `transportista/page.tsx`
- `cliente/page.tsx`
- `superadmin/page.tsx`

## End-to-end test results (verified working)

1. ✅ Bootstrap: First user via `verificar-codigo` becomes superadmin automatically
2. ✅ Password register: cliente@test.com → rol=cliente, aprobado=true
3. ✅ Password register: transp@test.com → rol=transportista, aprobado=false (pending)
4. ✅ Superadmin approves transportista via PATCH (audit logged + notification sent)
5. ✅ Cliente creates pedido (POST /cliente/pedidos) → auto-assigned to approved transportista
6. ✅ Transportista GET /pedidos shows the new pedido in "disponibles"
7. ✅ Freemium: Transportista on Free plan adds 1st vehicle → success; 2nd vehicle → 402 `LIMITE_VEHICULOS_ALCANZADO`
8. ✅ Transportista registers entrega (POST /entregas with pedidoId) → pedido auto-marks as "entregado"
9. ✅ Cliente GET /pedidos shows pedido with estado=entregado + entrega details + transportista info
10. ✅ Superadmin /metricas shows: 3 usuarios, 1 pedido, 1 entrega, 5000 L, $15.000 ingresos

## Design notes

- Same blue palette (#2563EB) as Aljibe — gradient `from-blue-50 via-sky-50 to-cyan-50`
- White cards with `border-2 border-blue-600` for primary, `border-blue-200` for secondary
- All buttons use `bg-blue-600 text-white hover:bg-blue-700` (primary) or `border-blue-600 text-blue-700` (outline)
- Logo at `/akuosplash/logo.jfif` shown in headers (h-10/h-12 rounded with ring-2 ring-blue-200)
- Mobile-first responsive with `sm:` breakpoints
- Sticky footer via `flex min-h-screen flex-col` wrapper
- Spanish (Chilean) language throughout

## Package added

- `bcryptjs@3.0.3` (for password hashing in `/auth/register` and `/auth/login`)
