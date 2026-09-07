// POST /api/demo/setup
// Crea (o regenera) la cuenta de demostración con datos ficticios realistas.
// Idempotente: si ya existe, regenera los datos.
//
// Credenciales: demo@aljibe.app / demo1234
//
// Datos que crea:
// - 1 admin demo (role=dueno, isDemo=true)
// - 2 choferes demo
// - 1 camión
// - 8 clientes con precios y zonas realistas
// - 30 días de entregas, vueltas, gastos y pagos
// - Configuración con datos de transferencia ficticios
//
// Todo se aísla con un duenoId demo dedicado, separado de los datos reales.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getSession } from "@/lib/auth";

const DEMO_EMAIL = "demo@aljibe.app";
const DEMO_PASSWORD = "demo1234";
const DEMO_NOMBRE_ADMIN = "Aguas del Sur SPA";
const DEMO_NOMBRE_CHOFER_1 = "Pedro González";
const DEMO_NOMBRE_CHOFER_2 = "María Soto";

export async function POST(req: NextRequest) {
  // Solo super-admin o el admin principal pueden ejecutar esto
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // Permitir: super_admin, o el admin principal (Transporte vm spa)
  const ADMIN_PRINCIPAL_ID = "cmthcb85x0001ld046apm4yuu";
  if (session.role !== "super_admin" && session.userId !== ADMIN_PRINCIPAL_ID) {
    return NextResponse.json({ error: "Solo el super-admin o el admin principal pueden generar la cuenta demo" }, { status: 403 });
  }

  try {
    const resultado = await generarDatosDemo();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error("[demo/setup] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar datos demo" },
      { status: 500 }
    );
  }
}

async function generarDatosDemo() {
  // 1. Buscar o crear el admin demo
  let adminDemo = await db.usuario.findUnique({ where: { email: DEMO_EMAIL } });

  if (adminDemo) {
    // Ya existe — eliminar todos sus datos para regenerar limpio
    await limpiarDatosDemo(adminDemo.id);
  } else {
    // Crear el admin demo
    adminDemo = await db.usuario.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: hashPassword(DEMO_PASSWORD),
        nombre: DEMO_NOMBRE_ADMIN,
        role: "dueno",
        activo: true,
        isDemo: true,
        telefono: "+56912345678",
      },
    });
  }

  const duenoId = adminDemo.id;

  // 2. Crear 2 choferes demo
  const chofer1 = await db.usuario.create({
    data: {
      email: "pedro.gonzalez@demo.aljibe.app",
      passwordHash: hashPassword("demo1234"),
      nombre: DEMO_NOMBRE_CHOFER_1,
      role: "chofer",
      duenoId,
      activo: true,
      isDemo: true,
      telefono: "+56987654321",
      licenciaClase: "A4",
      licenciaNumero: "12345678",
    },
  });

  const chofer2 = await db.usuario.create({
    data: {
      email: "maria.soto@demo.aljibe.app",
      passwordHash: hashPassword("demo1234"),
      nombre: DEMO_NOMBRE_CHOFER_2,
      role: "chofer",
      duenoId,
      activo: true,
      isDemo: true,
      telefono: "+56923456789",
      licenciaClase: "A4",
      licenciaNumero: "87654321",
    },
  });

  // 3. Crear 1 camión
  const camion = await db.camion.create({
    data: {
      nombre: "Ford Cargo 1722",
      patente: "ABCD12",
      capacidad: 17000,
      activo: true,
      duenoId,
      marca: "Ford",
      modelo: "Cargo 1722",
      anio: 2018,
      color: "Blanco",
    },
  });

  // Asignar ambos choferes al camión
  await db.camionChofer.create({ data: { camionId: camion.id, choferId: chofer1.id } });
  await db.camionChofer.create({ data: { camionId: camion.id, choferId: chofer2.id } });

  // 4. Crear configuración
  await db.configuracion.create({
    data: {
      duenoId,
      precioEfectivoPorLitro: 8,
      precioTransferenciaPorLitro: 8,
      precioCamionCompleto: 136000,
      nombreChofer: "Pedro González",
      nombreDueno: DEMO_NOMBRE_ADMIN,
      empresaRazonSocial: DEMO_NOMBRE_ADMIN,
      modoLiquidacion: "vuelta",
      montoPorVueltaUnicoCliente: 20000,
      montoPorVueltaMultiple: 25000,
      capacidadCamion: 17000,
      porcentajeComisionChofer: 50,
      porcentajeComisionDueno: 50,
      choferesPuedenEditarClientes: true,
      choferesPuedenCrearPedidos: true,
      umbralCompletacionVuelta: 0.95,
      tipoTributo: "iva",
      porcentajeImpuesto: 19,
      aplicaImpuestoSobre: "pago_chofer",
      periodoLiquidacion: "semanal",
      diaCierreSemana: 6,
      // Datos de transferencia ficticios
      transfBanco: "Banco de Chile",
      transfTipoCuenta: "Cuenta Corriente",
      transfNumeroCuenta: "000-12345678-90",
      transfTitular: DEMO_NOMBRE_ADMIN,
      transfRutTitular: "76.543.210-1",
      transfEmail: "pagos@aguasdelsur.cl",
      transfTelefono: "+56912345678",
    },
  });

  // 5. Crear 8 clientes ficticios con datos realistas
  const clientesData = [
    { nombre: "María Vergara", zona: "Las Condes", direccion: "Av. Las Condes 8430", telefono: "+56988811001", precioEfectivo: 8, precioTransferencia: 8, deudaInicial: 0 },
    { nombre: "Restaurant El Roble", zona: "Lo Barnechea", direccion: "Av. El Rodeo 12050", telefono: "+56988811002", precioEfectivo: 9, precioTransferencia: 9, deudaInicial: 45000 },
    { nombre: "Jardín Infantil Girasoles", zona: "La Reina", direccion: "Av. Larraín 5860", telefono: "+56988811003", precioEfectivo: 8, precioTransferencia: 8, deudaInicial: 0 },
    { nombre: "Carlos Muñoz", zona: "Ñuñoa", direccion: "Av. Grecia 4012", telefono: "+56988811004", precioEfectivo: 8, precioTransferencia: 8, deudaInicial: 32000 },
    { nombre: "Vivero Plantas y Flores", zona: "Macul", direccion: "Av. Macul 4520", telefono: "+56988811005", precioEfectivo: 9, precioTransferencia: 9, deudaInicial: 0 },
    { nombre: "Condominio Los Almendros", zona: "Peñalolén", direccion: "Av. Las Parcelas 1800", telefono: "+56988811006", precioEfectivo: 8, precioTransferencia: 8, deudaInicial: 78000 },
    { nombre: "Patricia Fuentes", zona: "La Florida", direccion: "Av. Vicuña Mackenna 8200", telefono: "+56988811007", precioEfectivo: 8, precioTransferencia: 8, deudaInicial: 0 },
    { nombre: "Constructora Andes Ltda.", zona: "Puente Alto", direccion: "Av. Concha y Toro 1340", telefono: "+56988811008", precioEfectivo: 7, precioTransferencia: 7, deudaInicial: 0 },
  ];

  const clientes: any[] = [];
  for (const c of clientesData) {
    const cliente = await db.cliente.create({
      data: {
        nombre: c.nombre,
        zona: c.zona,
        direccion: c.direccion,
        telefono: c.telefono,
        duenoId,
        precioEfectivoPorLitro: c.precioEfectivo,
        precioTransferenciaPorLitro: c.precioTransferencia,
        deudaInicial: c.deudaInicial,
        requiereIngresoPropiedad: Math.random() > 0.5,
        entregaDesdeAfuera: Math.random() > 0.7,
        conexionExterna: Math.random() > 0.8,
        requiereClientePresente: Math.random() > 0.5,
      },
    });
    clientes.push(cliente);
  }

  // 6. Generar 30 días de entregas, vueltas y gastos
  const ahora = new Date();
  let numeroVuelta = 1;
  let totalEntregas = 0;
  let totalVueltas = 0;
  let totalGastos = 0;
  let totalPagos = 0;

  // Generar datos para los últimos 30 días
  for (let diasAtras = 29; diasAtras >= 0; diasAtras--) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() - diasAtras);
    fecha.setHours(8, 0, 0, 0); // empezar a las 8 AM

    // Saltar algunos días (fin de semana a veces, días sin actividad)
    const diaSemana = fecha.getDay();
    if (diasAtras > 0 && Math.random() < 0.15) continue; // 15% de días sin actividad

    // 1-3 vueltas por día
    const vueltasHoy = 1 + Math.floor(Math.random() * 3);
    const choferDelDia = Math.random() > 0.5 ? chofer1 : chofer2;

    for (let v = 0; v < vueltasHoy; v++) {
      const vueltaInicio = new Date(fecha);
      vueltaInicio.setHours(8 + v * 3, Math.floor(Math.random() * 30), 0, 0);

      // 2-6 entregas por vuelta
      const numEntregas = 2 + Math.floor(Math.random() * 5);
      const litrosTotal = 12000 + Math.floor(Math.random() * 5000); // 12k-17k L
      const litrosPorEntrega = Math.floor(litrosTotal / numEntregas);

      const vuelta = await db.vuelta.create({
        data: {
          numero: numeroVuelta++,
          iniciadaEn: vueltaInicio,
          cerradaEn: new Date(vueltaInicio.getTime() + 2 * 60 * 60 * 1000), // 2h después
          activa: false,
          camionId: camion.id,
          choferId: choferDelDia.id,
          duenoId,
        },
      });
      totalVueltas++;

      // Crear entregas
      for (let e = 0; e < numEntregas; e++) {
        const cliente = clientes[Math.floor(Math.random() * clientes.length)];
        const litros = e === numEntregas - 1 ? litrosTotal - (litrosPorEntrega * (numEntregas - 1)) : litrosPorEntrega;
        const precio = Math.random() > 0.3 ? cliente.precioEfectivoPorLitro : cliente.precioTransferenciaPorLitro;
        const total = Math.ceil((litros * precio) / 100) * 100;

        // Método de pago variado
        const rand = Math.random();
        let metodoPago = "credito";
        let montoEfectivo = 0;
        let montoTransferencia = 0;
        let estadoPago = "pendiente";

        if (rand < 0.5) {
          // Efectivo
          metodoPago = "efectivo";
          montoEfectivo = total;
          estadoPago = "pagado";
        } else if (rand < 0.75) {
          // Transferencia
          metodoPago = "transferencia";
          montoTransferencia = total;
          estadoPago = "pagado";
        } else {
          // Crédito (deuda)
          metodoPago = "credito";
          estadoPago = "pendiente";
        }

        const fechaEntrega = new Date(vueltaInicio.getTime() + e * 20 * 60 * 1000); // cada 20 min

        await db.entrega.create({
          data: {
            fecha: fechaEntrega,
            clienteNombre: cliente.nombre,
            clienteDireccion: cliente.direccion,
            clienteTelefono: cliente.telefono,
            clienteZona: cliente.zona,
            clienteId: cliente.id,
            vueltaId: vuelta.id,
            choferId: choferDelDia.id,
            duenoId,
            litros,
            metodoPago,
            precioPorLitro: precio,
            total,
            montoEfectivo,
            montoTransferencia,
            montoRecibido: montoEfectivo + montoTransferencia,
            estadoPago,
            descuento: 0,
            descuentoTipo: "ninguno",
            descuentoPor: "dueno",
          },
        });
        totalEntregas++;
      }
    }

    // Gastos del día (1-2)
    const gastosDelDia = Math.random() > 0.4 ? 1 : 2;
    for (let g = 0; g < gastosDelDia; g++) {
      const tipos = ["agua_planta", "combustible_camion", "combustible_motobomba", "cloro", "mantenimiento"];
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];
      const montos: Record<string, number> = {
        agua_planta: 22000,
        combustible_camion: 45000,
        combustible_motobomba: 8000,
        cloro: 5000,
        mantenimiento: 15000,
      };
      const monto = montos[tipo] + Math.floor(Math.random() * 5000);
      const fechaGasto = new Date(fecha);
      fechaGasto.setHours(7 + g, 30, 0, 0);

      await db.gasto.create({
        data: {
          fecha: fechaGasto,
          tipo,
          descripcion: tipo === "agua_planta" ? "Carga en planta sur" : tipo === "combustible_camion" ? "Estación Copec" : "",
          monto,
          pagadoPor: Math.random() > 0.3 ? "chofer" : "dueno",
          choferId: choferDelDia.id,
          duenoId,
        },
      });
      totalGastos++;
    }

    // Pagos sueltos (cobros de deuda) — 30% de los días
    if (Math.random() < 0.3) {
      const cliente = clientes[Math.floor(Math.random() * clientes.length)];
      const monto = 15000 + Math.floor(Math.random() * 50000);
      const fechaPago = new Date(fecha);
      fechaPago.setHours(15, 0, 0, 0);

      await db.pago.create({
        data: {
          fecha: fechaPago,
          clienteId: cliente.id,
          monto,
          metodoPago: Math.random() > 0.5 ? "efectivo" : "transferencia",
          nota: "Pago de deuda anterior",
          choferId: choferDelDia.id,
          duenoId,
        },
      });
      totalPagos++;
    }
  }

  // 7. Crear zona demo para la app cliente
  const zonaDemo = await db.zona.create({
    data: {
      nombre: "Las Condes — Demo",
      descripcion: "Zona de demostración",
      // Polígono simple alrededor de Las Condes, Santiago
      zonaGeoJson: JSON.stringify({
        type: "Polygon",
        coordinates: [[
          [-70.55, -33.40], [-70.50, -33.40], [-70.50, -33.35],
          [-70.55, -33.35], [-70.55, -33.40]
        ]]
      }),
      centroLat: -33.375,
      centroLng: -70.525,
      precioPorLitro: 9,
      radioKm: 5,
      activa: true,
    },
  });

  // 8. Crear cliente demo (ClienteApp) para la app /cliente
  const clienteAppEmail = "cliente@demo.aljibe.app";
  // Eliminar si ya existe (para regenerar)
  await db.clienteApp.deleteMany({ where: { email: clienteAppEmail } });

  const clienteApp = await db.clienteApp.create({
    data: {
      email: clienteAppEmail,
      passwordHash: hashPassword("demo1234"),
      nombre: "Ana Rivera",
      rut: "12.345.678-9",
      telefono: "+56988812001",
      direccion: "Av. Las Condes 8430, Las Condes",
      zonaId: zonaDemo.id,
      lat: -33.375,
      lng: -70.525,
      requiereIngresoPropiedad: false,
      entregaDesdeAfuera: true,
      conexionExterna: false,
      requiereClientePresente: false,
      indicacionesAcceso: "Estanque lateral, acceso por calle paralela.",
      usoAgua: "consumo",
      usoAguaNota: "Casa de 2 pisos, estanque 5000L",
      tiempoAceptacionPreferidoMin: 15,
      proveedorPreferidoId: duenoId,
      entregasExitosas: 12,
      saldo: 20000, // saldo a favor de $20.000
      activo: true,
    },
  });

  // 9. Crear algunos pedidos demo para el cliente app (PedidoApp)
  const ahoraPedidos = new Date();
  for (let i = 0; i < 5; i++) {
    const fechaPedido = new Date(ahoraPedidos);
    fechaPedido.setDate(fechaPedido.getDate() - i * 7); // uno por semana

    const litros = [3000, 2500, 4000, 3000, 2500][i];
    const monto = litros * 9; // $9/L
    const estados = ["entregado", "entregado", "entregado", "entregado", "en_pool"];
    const estado = estados[i];

    await db.pedidoApp.create({
      data: {
        creadoEn: fechaPedido,
        clienteId: clienteApp.id,
        litros,
        monto,
        comisionApp: Math.round(monto * 0.10),
        montoProveedor: Math.round(monto * 0.90),
        estado,
        estadoPago: estado === "entregado" ? "pagado" : "pendiente",
        metodoPago: estado === "entregado" ? (i % 2 === 0 ? "saldo" : "transferencia") : "saldo",
        direccion: "Av. Las Condes 8430, Las Condes",
        zonaId: zonaDemo.id,
        tomadoEn: estado === "entregado" ? new Date(fechaPedido.getTime() + 30 * 60 * 1000) : null,
        entregadoEn: estado === "entregado" ? new Date(fechaPedido.getTime() + 3 * 60 * 60 * 1000) : null,
        tomadoPorId: estado === "entregado" ? chofer1.id : null,
      },
    });
  }

  return {
    adminEmail: DEMO_EMAIL,
    adminPassword: DEMO_PASSWORD,
    clienteAppEmail,
    clienteAppPassword: "demo1234",
    duenoId,
    choferes: 2,
    camiones: 1,
    clientes: clientes.length,
    vueltas: totalVueltas,
    entregas: totalEntregas,
    gastos: totalGastos,
    pagos: totalPagos,
    zonaDemo: zonaDemo.nombre,
    clienteApp: clienteApp.nombre,
    pedidosApp: 5,
  };
}

async function limpiarDatosDemo(duenoId: string) {
  // Eliminar todos los datos del admin demo para regenerar limpio
  await db.pago.deleteMany({ where: { duenoId } });
  await db.gasto.deleteMany({ where: { duenoId } });
  await db.entrega.deleteMany({ where: { duenoId } });
  await db.vuelta.deleteMany({ where: { duenoId } });
  await db.pedido.deleteMany({ where: { duenoId } });
  await db.cliente.deleteMany({ where: { duenoId } });
  const camionesIds = (await db.camion.findMany({ where: { duenoId }, select: { id: true } })).map(c => c.id);
  if (camionesIds.length > 0) {
    await db.camionChofer.deleteMany({ where: { camionId: { in: camionesIds } } });
    await db.bitacoraCamion.deleteMany({ where: { camionId: { in: camionesIds } } });
    await db.camion.deleteMany({ where: { duenoId } });
  }
  await db.pedidoRecurrente.deleteMany({ where: { duenoId } });
  await db.configuracion.deleteMany({ where: { duenoId } });
  // Eliminar choferes demo existentes
  await db.usuario.deleteMany({ where: { duenoId, role: "chofer" } });

  // Eliminar cliente app demo y sus pedidos
  const clienteAppDemo = await db.clienteApp.findUnique({ where: { email: "cliente@demo.aljibe.app" } });
  if (clienteAppDemo) {
    await db.pedidoApp.deleteMany({ where: { clienteId: clienteAppDemo.id } });
    await db.movimientoSaldoClienteApp.deleteMany({ where: { clienteId: clienteAppDemo.id } });
    await db.clienteApp.delete({ where: { id: clienteAppDemo.id } });
  }
  // Eliminar zona demo
  await db.zona.deleteMany({ where: { nombre: "Las Condes — Demo" } });
}
