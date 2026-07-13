# Guía de Publicación y Comercialización — App Aljibe

## 1. Publicar la aplicación web en internet

### Opción A: Vercel (recomendado — gratis para empezar)
1. Crear cuenta en vercel.com (con email o Google)
2. Subir el código a GitHub (repositorio privado)
3. Importar en Vercel — detecta Next.js automáticamente
4. Variables de entorno: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID
5. Dominio: gratis (.vercel.app) o comprar uno propio

### Base de datos en la nube (migrar de SQLite a PostgreSQL)
- Supabase (gratis hasta 500MB) — supabase.com
- Neon (gratis hasta 3GB) — neon.tech
- Cambiar schema.prisma de sqlite a postgresql

### Opción B: Railway (~$5/mes, PostgreSQL incluida)
### Opción C: VPS DigitalOcean (~$6/mes, más control)

### Costos:
| Plataforma | Costo mensual | Base datos | Dominio |
|-----------|--------------|------------|---------|
| Vercel + Supabase | $0 (gratis) | 500MB | .vercel.app gratis |
| Railway | ~$5 | Incluida | .railway.app gratis |
| VPS | ~$6 | Separada | Dominio ~$15.000/año |

---

## 2. Proteger derechos de propiedad intelectual

### a) Repositorio privado en GitHub (gratis, obligatorio)
### b) Registro de software en DDI (~$15.000 CLP)
- derechointelectual.gob.cl
- Protege autoría del código fuente
### c) Marca comercial en INAPI (~$115.000 CLP)
- inapi.cl
- Protege el nombre por 10 años
### d) NDA con colaboradores
- Acuerdo de confidencialidad antes de mostrar código
### e) Licencia propietaria cerrada
- Archivo LICENSE en el repo

### Qué proteger (valor alto):
- Esquema de base de datos
- Lógica de liquidación (cálculos, comisiones, impuestos)
- Reglas de vueltas (97.5%, completadas, excluidas)
- Sistema de chofer preferido y reemplazo
- Algoritmo de redondeo y descuentos
- Integraciones (auth, pagos, mapas)

### Qué NO vale la pena proteger (valor bajo):
- Diseño visual (CSS)
- Componentes UI (shadcn/ui son open source)
- Nombres de variables

---

## 3. Iniciar actividad comercial en Chile

### Paso 1: SII — Iniciar actividades (gratis)
- Empresa Individual o EIRL o SpA
### Paso 2: Patente municipal (~$30.000/año)
### Paso 3: Boletas/facturas electrónicas
### Paso 4: Modelo de cobro
| Modelo | Cómo funciona |
|--------|--------------|
| Suscripción mensual | $5.000-$15.000/mes por dueño |
| Porcentaje | 1-2% de ventas registradas |
| Freemium | Gratis hasta X entregas, luego $5.000/mes |
| Por flota | $3.000/camión/mes |
| Licencia anual | $50.000-$100.000/año |

### Paso 5: Medios de pago
- Flow (1.5-2.5% comisión)
- Mercado Pago (3.5%)
- Webpay/Transbank (~3.5%)

---

## 4. Cronograma sugerido
| Semana | Acción | Costo |
|--------|--------|-------|
| 1 | GitHub repo privado + Vercel + Supabase | $0 |
| 2 | Probar en producción, corregir bugs | $0 |
| 2 | Comprar dominio | ~$15.000/año |
| 3 | SII + patente municipal | ~$50.000 |
| 3 | INAPI marca | ~$115.000 |
| 4 | Términos de servicio + privacidad | $0 o ~$200.000 abogado |
| 4 | Integrar medio de pago | $0 integración |
| 5 | Invitar primeros usuarios | $0 |
| 6+ | Cobrar suscripciones | Ingresos |

---

## 5. App nativa para App Store / Google Play

### Opción 1: PWA (Progressive Web App) — RECOMENDADO
Tu app Next.js se puede convertir en PWA. Los usuarios la "instalan" desde el navegador:
- Aparece en la pantalla de inicio del celular
- Funciona offline (parcialmente)
- No necesita App Store ni Google Play
- No paga comisiones a Apple/Google
- Se actualiza automáticamente

**Para implementar:**
- Añadir `manifest.json` y service worker
- Next.js tiene plugin `next-pwa`

### Opción 2: Capacitor (app híbrida)
Envuelve tu web en una app nativa:
- Se publica en App Store y Google Play
- Usa el mismo código web
- Tiempo: 1-2 semanas de configuración
- Costo: Apple Developer $99/año, Google Play $25 una vez

### Opción 3: React Native (app nativa real)
Reescribir la app en React Native:
- Mejor performance
- Acceso a APIs nativas (GPS, cámara, notificaciones)
- Tiempo: 2-3 meses de desarrollo
- Costo: mismo que Apple/Google Developer

### Recomendación:
Empezar con PWA (gratis, inmediato). Cuando tengas 50+ usuarios pagando, evaluar Capacitor para App Store.

### Costos de publicar en stores:
| Store | Costo | Comisión sobre ventas |
|-------|-------|----------------------|
| Apple App Store | $99 USD/año | 15-30% de suscripciones |
| Google Play | $25 USD (una vez) | 15-30% de suscripciones |
| PWA | $0 | 0% |

---

## 6. Pendientes antes de publicar

### Básicos de la app (prioridad):
- [ ] Migrar SQLite a PostgreSQL
- [ ] Probar en producción (Vercel)
- [ ] Configurar HTTPS y dominio
- [ ] Términos de servicio
- [ ] Política de privacidad
- [ ] PWA (manifest + service worker)

### Mejoras futuras:
- [ ] Notificaciones push
- [ ] App offline (service worker)
- [ ] Integrar medio de pago
- [ ] Dashboard de admin
- [ ] Exportar reportes PDF/Excel
- [ ] Multi-idioma
