# Work Record — Task: cupones-y-pagos

- **Task ID**: cupones-y-pagos
- **Agent**: main
- **Date**: 2026-09-14
- **Scope**: Implement 4 features for Aljibe water delivery management system.

## Summary

Implemented four features:

1. **Bug fix** — `pedido con saldo $0` in `/cliente/pedir/page.tsx`:
   - Original validation `cliente.saldo < montoTotal` returned `false` when `montoTotal === 0` (edge case where `precioPorLitro === 0` or other degenerate inputs), so the pedido slipped through to the API and the user saw no toast.
   - New validation explicitly checks `cliente.saldo <= 0` first (clearer error message: "No tenés saldo cargado"), then `cliente.saldo < total` when `total > 0`.
   - All validation runs BEFORE `setCreando(true)` so the button can never get stuck in loading state if the request never happens.
   - Added `if (creando) return;` guard at top of `handlePedir` to prevent double-submit.
   - Computed `total` locally inside `handlePedir` (no closure dependency on the outer-scope `montoTotal`).

2. **New payment method "tarjeta"** in `/cliente/pedir/page.tsx` and `/api/cliente/pedidos`:
   - Added "Tarjeta (Webpay / MercadoPago)" option in the payment method card.
   - When selected, the form submits `metodoPago: "tarjeta"`; the backend creates the `PedidoApp` with `estadoPago: "pendiente"` and then creates a MercadoPago preference via the new `crearPreferenciaPedidoPago()` helper.
   - Returns `initPoint` to the frontend, which redirects the user to MercadoPago after a short delay (so the success toast is visible).
   - Webhook `/api/webhooks/mercadopago` extended to handle `external_reference: "pedido_pago:clienteId:pedidoId"` — sets `estadoPago: "confirmado"`, `confirmadoEn`, and `mpPaymentId` on the order. Idempotent: re-confirmations are ignored.
   - If MP preference creation fails, the pedido is cancelled and the cupon-usage counter is rolled back.

3. **Cupones de Descuento (Discount Coupons)**:
   - Prisma model `CuponDescuento` (id, codigo unique, descripcion, tipo [porcentaje|monto_fijo], valor, montoMinimo, usosMaximos, usosActuales, activo, validoDesde/Hasta, creadoPorId, creadoEn, zonaId+Zona relation).
   - Added 5 new fields to `PedidoApp`: `cuponCodigo`, `descuento`, `montoOriginal`, `mpPreferenceId`, `mpPaymentId`.
   - Migration endpoint: `POST /api/admin/migrate-cupones` (creates the table + indexes + adds columns; idempotent).
   - Super-admin API: `GET/POST /api/super-admin/cupones`, `PATCH/DELETE /api/super-admin/cupones/[id]`.
   - Cliente API: `POST /api/cliente/cupones/validar` (validates code + monto + zona + fechas + usos; returns `descuento` and `montoFinal` without persisting).
   - Super-admin UI: new "🎟️ Cupones" tab with full CRUD (list, create, edit, toggle activo, delete with confirm dialog) and badges for expirado/programado/sin-usos/inactivo. Filter to show inactive coupons.
   - Cliente pedir page: coupon input field with "Aplicar" button. On success, shows the discount applied and recomputes the total. On changing litros, the coupon is invalidated (because the monto changed).

4. **Migration endpoint** as described above.

## Files Modified / Created

### Prisma
- `prisma/schema.prisma` — added `CuponDescuento` model, added Zona back-relation, added 5 fields to `PedidoApp`.

### API Routes
- `src/app/api/admin/migrate-cupones/route.ts` (NEW) — creates CuponDescuento table + indexes + PedidoApp columns.
- `src/app/api/super-admin/cupones/route.ts` (NEW) — GET (list, with optional inactivos filter) + POST (create with full validation).
- `src/app/api/super-admin/cupones/[id]/route.ts` (NEW) — PATCH (edit) + DELETE.
- `src/app/api/cliente/cupones/validar/route.ts` (NEW) — POST (validate code, monto, zona, fechas, usos).
- `src/app/api/cliente/pedidos/route.ts` (MODIFIED) — accepts `metodoPago: "tarjeta"`, `cuponCodigo`. Applies discount, creates MP preference for tarjeta, increments usosActuales of coupon.
- `src/app/api/webhooks/mercadopago/route.ts` (MODIFIED) — handles `pedido_pago:` external reference, marks pedido as confirmado.

### Library
- `src/lib/mercadopago.ts` (MODIFIED) — added `crearPreferenciaPedidoPago()`.

### Frontend
- `src/app/super-admin/page.tsx` (MODIFIED) — added "cupones" tab, button, dropdown option, `CuponesAdmin` component, `CuponDialog` component.
- `src/app/cliente/pedir/page.tsx` (MODIFIED) — fixed saldo $0 bug, added "tarjeta" payment method, added coupon input + validation + discount display.

## Verification

- `npx prisma generate` — OK (client regenerated).
- `bun run db:push` — OK (DB schema synced).
- `npx tsc --noEmit` — 0 errors in `src/` (only pre-existing errors in `examples/` and `skills/`).
- `bun run lint` — 0 new errors in modified files (77 pre-existing errors in unrelated `scripts/` and 3 unrelated API routes).
- Dev server (port 3000) verified:
  - `POST /api/admin/migrate-cupones` → 401 (auth required) — compiles OK.
  - `GET /api/super-admin/cupones` → 403 (super-admin required) — compiles OK.
  - `POST /api/cliente/cupones/validar` → 401 (cliente session required) — compiles OK.
  - `GET /cliente/pedir` → 200 — compiles OK.
  - `GET /super-admin` → 200 — compiles OK.

## Notes / Decisions

- **Coupon usage counter**: incremented at pedido creation time (not at payment confirmation). If the payment fails (MP error), the counter is rolled back. If the user later cancels the pedido manually, the counter is NOT decremented (TODO: handle this in cancelar endpoint if needed). This is a reasonable tradeoff: a coupon is "used" once a pedido is committed, even if later cancelled.
- **Monto = 0 with tarjeta**: if a coupon gives a 100% discount, no MP preference is created and the pedido is auto-confirmed with `estadoPago: "confirmado"`.
- **Backward compatibility**: existing payment methods (saldo, transferencia, efectivo) work exactly as before. The `tarjeta` option is purely additive.
- **Webhook idempotency**: `estadoPago === "confirmado"` is checked at the top to prevent double-processing.
- **Cupón validation consistency**: the same validation logic is duplicated in two places (`/api/cliente/cupones/validar` for preview, `/api/cliente/pedidos` for actual application). This is acceptable to keep each endpoint self-contained; future refactor could extract to a shared helper.
