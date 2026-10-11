"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Camera, X, Droplets, MapPin, Navigation, DoorOpen, Fence, KeyRound, UserCheck, ExternalLink, Banknote, Smartphone, Clock, ClipboardList, RotateCcw, Plus, AlertTriangle, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, uploadFile } from "@/components/akuosplash/akuosplash-api-client";
import { GeofenceWidget } from "./geofence-widget";
import {
  ESTADOS_PAGO,
  METODOS_PAGO,
  formatCurrency,
  formatNumber,
  labelMetodoPago,
  esVueltaCompletada,
  UMBRAL_COMPLETACION_VUELTA,
  formatTime,
} from "@/components/akuosplash/akuosplash-helpers";

export interface Entrega {
  id: string;
  fecha: string;
  clienteNombre: string;
  clienteDireccion: string | null;
  clienteTelefono: string | null;
  clienteZona: string | null;
  clienteId: string | null;
  vueltaId: string | null;
  vuelta?: { id: string; numero: number; activa: boolean } | null;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  litros: number;
  metodoPago: string;
  precioPorLitro: number;
  total: number;
  montoEfectivo: number;
  montoTransferencia: number;
  montoRecibido: number;
  estadoPago: string;
  fotoMedidorUrl: string | null;
  nota: string | null;
  detalleEstanquesJson: string | null;
}

export interface VueltaActual {
  id: string;
  numero: number;
  iniciadaEn: string;
  cantidadEntregas: number;
  litros: number;
  litrosRestantes?: number;
  capacidadCamion?: number;
  ventas?: number;
  efectivoRecibido?: number;
  transferenciaRecibida?: number;
  camion?: {
    id: string;
    nombre: string;
    patente: string | null;
    capacidad: number;
  } | null;
  entregas?: {
    id: string;
    litros: number;
    total: number;
    montoEfectivo: number;
    montoTransferencia: number;
    montoRecibido: number;
    clienteId?: string | null;
    clienteNombre: string;
    clienteDireccion?: string | null;
    clienteZona?: string | null;
    clienteTelefono?: string | null;
    cliente?: { lat: number | null; lng: number | null } | null;
    clienteLat?: number | null;
    clienteLng?: number | null;
    metodoPago: string;
    estadoPago?: string;
    fecha?: string;
    creadoEn?: string;
  }[];
}

interface ClienteOption {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  precioCamionCompleto: number;
  // GPS y acceso
  lat: number | null;
  lng: number | null;
  requiereIngresoPropiedad: boolean;
  entregaDesdeAfuera: boolean;
  conexionExterna: boolean;
  requiereClientePresente: boolean;
  indicacionesAcceso: string | null;
  // Estanques
  estanquesJson: string | null;
}

interface EntregaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onVueltaIniciada?: () => void;
  entrega?: Entrega | null;
  clientes: ClienteOption[];
  config: {
    precioEfectivoPorLitro: number;
    precioTransferenciaPorLitro: number;
    precioCamionCompleto: number;
    capacidadCamion: number;
  };
  vueltaActual: VueltaActual | null;
  pedidosPendientes?: { id: string; clienteNombre: string; clienteId: string | null; litrosSolicitados: number; metodoPagoPreferido: string }[];
  camiones?: { id: string; nombre: string; activo: boolean }[];
  isDueno?: boolean;
}

interface VueltaReciente {
  id: string;
  numero: number;
  iniciadaEn: string;
  cerradaEn: string | null;
  litros: number;
  cantidadEntregas: number;
  capacidadCamion: number;
  camion?: { id: string; nombre: string; patente: string | null; capacidad: number } | null;
  chofer?: { id: string; nombre: string } | null;
}

// Componente auxiliar: muestra datos de transferencia en un panel colapsable
function DatosTransferenciaCollapsible() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiGet<{ transfData: any }>("/api/akuosplash/config/public?transfer=true")
      .then(r => { if (r.transfData) setData(r.transfData); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <details className="mt-2 rounded-md border border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20">
      <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
        💳 Mostrar datos de transferencia
      </summary>
      <div className="space-y-1 px-2 pb-2 text-xs">
        {data.transfBanco && (
          <div><span className="text-muted-foreground">Banco:</span> <strong>{data.transfBanco}</strong></div>
        )}
        {data.transfTipoCuenta && (
          <div><span className="text-muted-foreground">Tipo de cuenta:</span> <strong>{data.transfTipoCuenta}</strong></div>
        )}
        {data.transfNumeroCuenta && (
          <div>
            <span className="text-muted-foreground">N° cuenta:</span> <strong>{data.transfNumeroCuenta}</strong>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(data.transfNumeroCuenta); toast.success("Número de cuenta copiado"); }}
              className="ml-1 text-blue-600 hover:underline"
            >copiar</button>
          </div>
        )}
        {data.transfTitular && (
          <div><span className="text-muted-foreground">Titular:</span> <strong>{data.transfTitular}</strong></div>
        )}
        {data.transfRutTitular && (
          <div><span className="text-muted-foreground">RUT:</span> <strong>{data.transfRutTitular}</strong></div>
        )}
        {data.transfEmail && (
          <div>
            <span className="text-muted-foreground">Email:</span> <strong>{data.transfEmail}</strong>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(data.transfEmail); toast.success("Email copiado"); }}
              className="ml-1 text-blue-600 hover:underline"
            >copiar</button>
          </div>
        )}
        {data.transfTelefono && (
          <div><span className="text-muted-foreground">Teléfono:</span> <strong>{data.transfTelefono}</strong></div>
        )}
      </div>
    </details>
  );
}

export function EntregaForm({
  open,
  onOpenChange,
  onSaved,
  onVueltaIniciada,
  entrega,
  clientes,
  config,
  vueltaActual,
  pedidosPendientes = [],
  camiones = [],
  isDueno = false,
}: EntregaFormProps) {
  const isEdit = !!entrega;

  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteZona, setClienteZona] = useState("");

  // Deuda del cliente seleccionado (para pagos de entregas anteriores)
  const [clienteDeuda, setClienteDeuda] = useState<number | null>(null);
  // Desglose por estanque (cuando el cliente tiene facturación independiente)
  // Cada estanque puede tener su propia foto del medidor (est.fotoUrl).
  const [estanquesEntrega, setEstanquesEntrega] = useState<{ nombre: string; litros: string; precio: string; metodoPago: string; montoRecibido: string; modoIngreso?: "por_litros" | "por_precio"; precioTotalInput?: string; fotoUrl?: string | null; subiendoFoto?: boolean }[]>([]);
  const [modoEstanques, setModoEstanques] = useState(false);

  const [lecturaAnterior, setLecturaAnterior] = useState<string>("");
  const [lecturaActual, setLecturaActual] = useState<string>("");
  const [litrosManual, setLitrosManual] = useState<string>("");
  const [precioPorLitro, setPrecioPorLitro] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<string>("credito");

  // Modo de ingreso: por litros o por precio
  const [modoIngreso, setModoIngreso] = useState<"por_litros" | "por_precio">("por_litros");
  const [precioTotalInput, setPrecioTotalInput] = useState<string>("");

  // Modo camión completo: tarifa fija (anula precio por litro)
  const [esCamionCompleto, setEsCamionCompleto] = useState(false);

  // Descuento
  const [descuentoTipo, setDescuentoTipo] = useState<string>("ninguno"); // ninguno | total | por_litro
  const [descuentoMonto, setDescuentoMonto] = useState<string>(""); // monto del descuento
  const [descuentoPorLitroInput, setDescuentoPorLitroInput] = useState<string>(""); // descuento por litro
  const [descuentoQuien, setDescuentoQuien] = useState<string>("chofer"); // chofer | dueno — quién asume el descuento

  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [montoTransferencia, setMontoTransferencia] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("pendiente");

  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);  // Guard contra double-submit (más rápido que setSaving)

  // Diálogo de selección de vuelta (cuando no hay vuelta activa)
  const [dialogoVueltaAbierto, setDialogoVueltaAbierto] = useState(false);
  const [vueltasRecientes, setVueltasRecientes] = useState<VueltaReciente[]>([]);
  const [cargandoVueltas, setCargandoVueltas] = useState(false);
  const [iniciandoVuelta, setIniciandoVuelta] = useState(false);
  const [camionSeleccionado, setCamionSeleccionado] = useState<string>("");

  // Pedido seleccionado (cuando se entrega desde un pedido pendiente)
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Reset al abrir / cambia entrega
  useEffect(() => {
    if (!open) return;
    if (entrega) {
      setClienteId(entrega.clienteId ?? "");
      setClienteNombre(entrega.clienteNombre);
      setClienteDireccion(entrega.clienteDireccion ?? "");
      setClienteTelefono(entrega.clienteTelefono ?? "");
      setClienteZona(entrega.clienteZona ?? "");
      setLecturaAnterior(entrega.lecturaAnterior != null ? String(entrega.lecturaAnterior) : "");
      setLecturaActual(entrega.lecturaActual != null ? String(entrega.lecturaActual) : "");
      setLitrosManual(String(entrega.litros ?? ""));
      setPrecioPorLitro(String(entrega.precioPorLitro ?? ""));
      setMetodoPago(entrega.metodoPago || "efectivo");
      setMontoEfectivo(entrega.montoEfectivo ? String(entrega.montoEfectivo) : "");
      setMontoTransferencia(entrega.montoTransferencia ? String(entrega.montoTransferencia) : "");
      setEstadoPago(entrega.estadoPago);
      setFotoUrl(entrega.fotoMedidorUrl);
      setNota(entrega.nota ?? "");
      setPedidoSeleccionadoId(null);
      // Cargar estanques guardados si la entrega los tiene (para edición)
      let estanquesCargados: typeof estanquesEntrega = [];
      if (entrega.detalleEstanquesJson) {
        try {
          const parsed = JSON.parse(entrega.detalleEstanquesJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            estanquesCargados = parsed.map((e: any) => ({
              nombre: e.nombre || "Estanque",
              litros: e.litros != null ? String(e.litros) : "",
              precio: e.precioPorLitro != null ? String(e.precioPorLitro) : "",
              metodoPago: e.metodoPago || "credito",
              montoRecibido: e.montoRecibido != null ? String(e.montoRecibido) : "",
              modoIngreso: "por_litros",
              fotoUrl: e.fotoUrl || null,
            }));
            setModoEstanques(true);
          }
        } catch { /* ignore */ }
      }
      setEstanquesEntrega(estanquesCargados);
      setClienteDeuda(null);
      setDialogoVueltaAbierto(false);
      setVueltasRecientes([]);
      setCamionSeleccionado("");
    } else {
      setClienteId("");
      setClienteNombre("");
      setClienteDireccion("");
      setClienteTelefono("");
      setClienteZona("");
      setLecturaAnterior("");
      setLecturaActual("");
      setLitrosManual("");
      setMetodoPago("credito");
      setMontoEfectivo("");
      setMontoTransferencia("");
      setEstadoPago("pendiente");
      setFotoUrl(null);
      setNota("");
      setPedidoSeleccionadoId(null);
      setModoEstanques(false);
      setEstanquesEntrega([]);
      setClienteDeuda(null);
      setDialogoVueltaAbierto(false);
      setVueltasRecientes([]);
      setCamionSeleccionado("");
      // Auto-llenar precio: para "credito" (sin pago) usar el precio MÁS ALTO
      const precioEfectivoDef = config.precioEfectivoPorLitro || 0;
      const precioTransferenciaDef = config.precioTransferenciaPorLitro || 0;
      const precioDefault = Math.max(precioEfectivoDef, precioTransferenciaDef);
      if (precioDefault > 0) {
        setPrecioPorLitro(String(precioDefault));
      } else {
        setPrecioPorLitro("");
      }
    }
  }, [open, entrega, config.precioEfectivoPorLitro]);

  // Si el usuario selecciona un cliente del catálogo, autollenar datos y precio
  // pedidoIdOpcional: si viene de un click en pedido pendiente, se pasa aquí para no perderlo
  function onSelectCliente(id: string, pedidoIdOpcional?: string | null) {
    setClienteId(id);
    // limpiar pedido seleccionado al cambiar cliente manualmente
    // (a menos que vengamos de un click en pedido, en cuyo caso lo preservamos)
    setPedidoSeleccionadoId(pedidoIdOpcional ?? null);
    if (!id || id === "__manual") {
      aplicarPrecioSegunMetodo(metodoPago, null);
      setClienteDeuda(null);
      setModoEstanques(false);
      setEstanquesEntrega([]);
      return;
    }
    const c = clientes.find((c) => c.id === id);
    if (!c) {
      toast.error("Cliente no encontrado en la lista. ID: " + id);
      return;
    }

    toast.success("Cliente seleccionado: " + c.nombre);

    setClienteNombre(c.nombre);
    setClienteDireccion(c.direccion ?? "");
    setClienteTelefono(c.telefono ?? "");
    setClienteZona(c.zona ?? "");
    aplicarPrecioSegunMetodo(metodoPago, c);

    // Detectar si el cliente tiene estanques
    let estanquesCliente: { tipo: string; capacidad: string; nombre: string; ubicacion: string; facturaSeparada?: boolean }[] = [];
    if (c.estanquesJson) {
      try {
        estanquesCliente = JSON.parse(c.estanquesJson);
      } catch {
        toast.error("Error al leer los estanques del cliente");
      }
    }

    if (estanquesCliente.length > 0) {
      const independientes = estanquesCliente.filter((e) => e.facturaSeparada === true);
      const listaEstanques = independientes.length > 0 ? independientes : estanquesCliente;
      // Para "sin pago" (credito) usar el precio MÁS ALTO — genera deuda correcta
      const precioEfectivoEst = c.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
      const precioTransferenciaEst = c.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
      const precioMaxEst = Math.max(precioEfectivoEst, precioTransferenciaEst);
      setEstanquesEntrega(listaEstanques.map((e) => ({
        nombre: e.nombre || e.tipo,
        litros: "",
        precio: String(precioMaxEst || 0),
        metodoPago: "credito",
        montoRecibido: "",
        modoIngreso: "por_litros" as const,
        precioTotalInput: "",
      })));
      // Si hay estanques con facturación independiente, activar modo estanques automáticamente
      setModoEstanques(independientes.length > 0);
      if (independientes.length > 0) {
        toast.info(
          `Cliente tiene ${estanquesCliente.length} estanque(s), ${independientes.length} con facturación independiente. Puedes activar "Entregar por estanque" si quieres cobro separado.`,
          { duration: 6000 }
        );
      }
    } else {
      // El cliente no tiene estanques registrados — NO es un error.
      // Se puede entregar igual (modo normal con litros manuales).
      // Si el usuario quiere facturación por estanque, puede agregarlos desde aquí.
      setModoEstanques(false);
      setEstanquesEntrega([]);
    }

    // Cargar la deuda del cliente (en background) — incluye deudaInicial + pagos sueltos
    Promise.all([
      apiGet<{ entregas: any[] }>(`/api/akuosplash/entregas?period=todo&clienteId=${id}`),
      apiGet<{ pagos: any[] }>(`/api/akuosplash/pagos?clienteId=${id}`),
    ])
      .then(([dataEnt, dataPag]) => {
        const totalVentas = dataEnt.entregas.reduce((s: number, e: any) => s + (e.total || 0), 0);
        const totalRecibido = dataEnt.entregas.reduce((s: number, e: any) => s + (e.montoRecibido || 0), 0);
        const totalPagosSueltos = (dataPag.pagos || []).reduce((s: number, p: any) => s + (p.monto || 0), 0);
        // Incluir deudaInicial del cliente (importante: la ficha del cliente lo incluye)
        const c = clientes.find((cl) => cl.id === id);
        const deudaInicial = (c as any)?.deudaInicial || 0;
        setClienteDeuda(deudaInicial + totalVentas - totalRecibido - totalPagosSueltos);
      })
      .catch(() => setClienteDeuda(null));
  }

  // Helper: aplicar precio según método de pago
  function aplicarPrecioSegunMetodo(metodo: string, cliente: ClienteOption | null) {
    const precioEfectivo = cliente?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
    const precioTransferencia = cliente?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
    let precio = 0;
    if (metodo === "efectivo") {
      precio = precioEfectivo;
    } else if (metodo === "transferencia") {
      precio = precioTransferencia;
    } else {
      // mixto o crédito (sin pago): usar el precio MÁS ALTO como base
      // — para "sin pago" esto genera la deuda correcta desde el inicio,
      //   y el usuario puede ajustar el precio al momento de cobrar
      precio = Math.max(precioEfectivo, precioTransferencia);
    }
    // Siempre setear el precio (incluso si es 0, para que el usuario vea que no hay configurado)
    setPrecioPorLitro(precio > 0 ? String(precio) : "");
  }

  // Si cambia método de pago (y el usuario no ha tocado el precio manualmente)
  function onChangeMetodoPago(nuevoMetodo: string) {
    const metodoAnterior = metodoPago;
    setMetodoPago(nuevoMetodo);
    // Solo recalcular si el precio actual coincide con el del método anterior
    // (es decir, el usuario no lo modificó manualmente)
    const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) ?? null : null;
    const precioEsperadoAnterior =
      metodoAnterior === "efectivo"
        ? clienteActual?.precioEfectivoPorLitro || config.precioEfectivoPorLitro
        : metodoAnterior === "transferencia"
        ? clienteActual?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro
        : clienteActual?.precioEfectivoPorLitro || config.precioEfectivoPorLitro;
    const precioActual = Number(precioPorLitro) || 0;
    if (precioActual === precioEsperadoAnterior || precioActual === 0) {
      aplicarPrecioSegunMetodo(nuevoMetodo, clienteActual);
    }
  }

  // Calcular litros desde lecturas si no se ingresa manualmente
  const litrosCalculado =
    lecturaAnterior !== "" && lecturaActual !== ""
      ? Number(lecturaActual) - Number(lecturaAnterior)
      : null;

  // === Cálculos con redondeo y descuento ===
  let litrosFinal = litrosManual !== "" ? Number(litrosManual) : litrosCalculado ?? 0;
  const precioFinal = Number(precioPorLitro) || 0;

  // Modo "por precio": calcular litros desde el precio total
  if (modoIngreso === "por_precio" && precioTotalInput) {
    const precioTotal = Number(precioTotalInput) || 0;
    if (precioFinal > 0) {
      litrosFinal = Math.round(precioTotal / precioFinal);
    }
  }

  // Si estamos en modo estanques, sumar litros y total de los estanques
  let litrosEstanquesTotal = 0;
  let totalEstanquesRaw = 0;
  if (modoEstanques && estanquesEntrega.length > 0) {
    for (const est of estanquesEntrega) {
      const litrosEst = Number(est.litros) || 0;
      const precioEst = Number(est.precio) || 0;
      litrosEstanquesTotal += litrosEst;
      totalEstanquesRaw += litrosEst * precioEst;
    }
    // En modo estanques, usar los totales de estanques para el resumen
    litrosFinal = litrosEstanquesTotal;
  }

  // Total calculado con redondeo a $100 superior
  // Si es camión completo, usar el precio fijo (del cliente o de la config)
  const clienteActualCalc = clienteId ? clientes.find((c) => c.id === clienteId) : null;
  const precioCamionCompletoVal =
    (clienteActualCalc?.precioCamionCompleto ?? 0) ||
    config.precioCamionCompleto ||
    0;
  let totalCalculado = esCamionCompleto && precioCamionCompletoVal > 0
    ? precioCamionCompletoVal
    : modoEstanques
      ? totalEstanquesRaw
      : litrosFinal * precioFinal;
  if (totalCalculado > 0) {
    totalCalculado = Math.ceil(totalCalculado / 100) * 100;
  }

  // Descuento
  let descuentoMontoFinal = 0;
  if (descuentoTipo === "total") {
    descuentoMontoFinal = Number(descuentoMonto) || 0;
  } else if (descuentoTipo === "por_litro") {
    descuentoMontoFinal = (Number(descuentoPorLitroInput) || 0) * litrosFinal;
  }
  const totalConDescuento = Math.max(0, totalCalculado - descuentoMontoFinal);

  const efectivoFinal = Number(montoEfectivo) || 0;
  const transferenciaFinal = Number(montoTransferencia) || 0;
  const recibidoFinal = efectivoFinal + transferenciaFinal;
  const saldoFinal = totalConDescuento - recibidoFinal;

  // Auto-actualizar estadoPago según monto recibido (SIEMPRE automático, no manual)
  useEffect(() => {
    if (recibidoFinal === 0) {
      setEstadoPago("pendiente");
    } else if (recibidoFinal >= totalConDescuento && totalConDescuento > 0) {
      setEstadoPago("pagado");
    } else {
      setEstadoPago("parcial");
    }
  }, [recibidoFinal, totalConDescuento]);

  async function handleFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const result = await uploadFile(file, { tipo: "medidor", clienteId: clienteId || undefined, clienteNombre: clienteNombre || undefined });
      setFotoUrl(result.url);
      if (result.uploadedToServer) {
        toast.success("Foto del medidor subida");
      } else {
        toast.success("📷 Foto guardada en el dispositivo (sin señal). Se subirá automáticamente cuando tengas conexión.", { duration: 8000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  }

  // Guarda la entrega con un vueltaId opcional (cuando se inicia/reabre desde el diálogo)
  async function guardarEntrega(vueltaIdOverride?: string) {
    // Guard contra double-submit: si ya estamos guardando, ignorar
    if (savingRef.current) {
      console.warn("[guardarEntrega] ya hay un guardado en curso, ignorando");
      return;
    }
    savingRef.current = true;
    // Capturar el estado actual en variables locales para evitar problemas de stale closure
    const modoEst = modoEstanques;
    const estanques = estanquesEntrega;
    const clienteNombreLocal = clienteNombre.trim();
    const litrosFinalLocal = litrosFinal;
    const precioFinalLocal = precioFinal;
    const totalCalculadoLocal = totalCalculado;
    const efectivoFinalLocal = efectivoFinal;
    const transferenciaFinalLocal = transferenciaFinal;

    // Determinar si hay datos de estanques con litros > 0
    const estanquesConLitros = estanques.filter((e) => Number(e.litros) > 0);

    // Si está en modo estanques (o hay estanques con litros), usar el path de estanques
    if ((modoEst || estanquesConLitros.length > 0) && estanques.length > 0) {
      const totalLitrosEst = estanquesConLitros.reduce((s, e) => s + (Number(e.litros) || 0), 0);
      if (totalLitrosEst <= 0) {
        toast.error("Ingresa al menos litros en un estanque");
        savingRef.current = false;
        return;
      }

      // Normalizar montoRecibido por estanque: si es efectivo/transferencia y está vacío,
      // usar el total calculado (litros × precio) con redondeo a $100. Si es credito, queda 0 (deuda).
      const estanquesNormalizados = estanquesConLitros.map((e) => {
        const litrosNum = Number(e.litros) || 0;
        const precioNum = Number(e.precio) || 0;
        const totalEstRaw = litrosNum * precioNum;
        // Redondear a $100 superior
        const totalEstCalc = totalEstRaw > 0 ? Math.ceil(totalEstRaw / 100) * 100 : 0;
        let montoRecibidoNum = Number(e.montoRecibido) || 0;
        if (e.metodoPago !== "credito" && montoRecibidoNum === 0 && totalEstCalc > 0) {
          montoRecibidoNum = totalEstCalc;
        }
        return {
          ...e,
          litros: litrosNum,
          precio: precioNum,
          montoRecibido: montoRecibidoNum,
          total: totalEstCalc,
        };
      });

      const totalVentaEst = estanquesNormalizados.reduce((s, e) => s + e.total, 0);
      const totalEfectivoEst = estanquesNormalizados.filter((e) => e.metodoPago === "efectivo").reduce((s, e) => s + e.montoRecibido, 0);
      const totalTransferenciaEst = estanquesNormalizados.filter((e) => e.metodoPago === "transferencia").reduce((s, e) => s + e.montoRecibido, 0);
      const totalRecibidoEst = totalEfectivoEst + totalTransferenciaEst;

      let estadoPagoEst = "pendiente";
      if (totalRecibidoEst >= totalVentaEst && totalVentaEst > 0) estadoPagoEst = "pagado";
      else if (totalRecibidoEst > 0) estadoPagoEst = "parcial";

      setSaving(true);
      try {
        const payload: Record<string, unknown> = {
          clienteId: clienteId && clienteId !== "__manual" ? clienteId : null,
          clienteNombre: clienteNombreLocal,
          clienteDireccion: clienteDireccion.trim() || null,
          clienteTelefono: clienteTelefono.trim() || null,
          clienteZona: clienteZona.trim() || null,
          litros: totalLitrosEst,
          metodoPago: "mixto",
          precioPorLitro: 0,
          total: totalVentaEst,
          montoEfectivo: totalEfectivoEst,
          montoTransferencia: totalTransferenciaEst,
          estadoPago: estadoPagoEst,
          fotoMedidorUrl: fotoUrl,
          nota: nota.trim() || null,
          detalleEstanquesJson: JSON.stringify(estanquesNormalizados.map((e) => ({
            nombre: e.nombre,
            litros: e.litros,
            precioPorLitro: e.precio,
            total: e.total,
            metodoPago: e.metodoPago,
            montoRecibido: e.montoRecibido,
            fotoUrl: e.fotoUrl || null,
          }))),
        };
        if (vueltaIdOverride) payload.vueltaId = vueltaIdOverride;
        if (pedidoSeleccionadoId) payload.pedidoId = pedidoSeleccionadoId;

        if (isEdit && entrega) {
          await apiPatch(`/api/akuosplash/entregas/${entrega.id}`, payload);
          toast.success("Entrega actualizada correctamente", { duration: 6000 });
        } else {
          await apiPost("/api/akuosplash/entregas", payload);
          // Confirmación muy clara con detalles para que el chofer sepa que se registró
          toast.success(`✓ Entrega registrada: ${formatNumber(totalLitrosEst, 0)} L · ${formatCurrency(totalVentaEst)} · ${clienteNombreLocal}`, {
            duration: 8000,
            description: "La entrega se guardó correctamente. No necesitás registrar otra vez.",
          });
        }
        onSaved();
        onOpenChange(false);
        setDialogoVueltaAbierto(false);
      } catch (e) {
        console.error("[guardarEntrega] error al guardar:", e);
        const msg = e instanceof Error ? e.message : "No se pudo guardar";
        if (msg.includes("PEDIDO_YA_ENTREGADO") || msg.includes("ya fue entregado") || msg.includes("ya entregado")) {
          toast.error("⚠ Este pedido ya fue entregado antes. No se puede registrar otra entrega para el mismo pedido.", {
            duration: 10000,
            description: "Si querés registrar otra entrega, creá un pedido nuevo. La foto que subiste NO se perdió.",
          });
        } else {
          toast.error(`No se pudo guardar la entrega: ${msg}`, {
            duration: 10000,
            description: "La foto que subiste NO se perdió. Revisá los datos y volvé a intentar.",
          });
        }
        // NO cerramos el form si falla — el usuario no pierde la foto ni los datos
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    if (litrosFinalLocal <= 0 && !esCamionCompleto) {
      toast.error("Los litros deben ser mayores a 0");
      savingRef.current = false;
      return;
    }
    // Si es camión completo y no hay litros, usar la capacidad del camión
    const litrosParaGuardar = esCamionCompleto && litrosFinalLocal <= 0
      ? (vueltaActual?.camion?.capacidad ?? config.capacidadCamion ?? 17000)
      : litrosFinalLocal;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        clienteId: clienteId && clienteId !== "__manual" ? clienteId : null,
        clienteNombre: clienteNombreLocal,
        clienteDireccion: clienteDireccion.trim() || null,
        clienteTelefono: clienteTelefono.trim() || null,
        clienteZona: clienteZona.trim() || null,
        lecturaAnterior: lecturaAnterior !== "" ? Number(lecturaAnterior) : null,
        lecturaActual: lecturaActual !== "" ? Number(lecturaActual) : null,
        litros: litrosParaGuardar,
        metodoPago,
        precioPorLitro: esCamionCompleto ? 0 : precioFinalLocal,
        total: totalConDescuento,
        montoEfectivo: efectivoFinalLocal,
        montoTransferencia: transferenciaFinalLocal,
        estadoPago,
        descuentoTipo,
        descuento: descuentoTipo === "total" ? (Number(descuentoMonto) || 0) : 0,
        descuentoPorLitro: descuentoTipo === "por_litro" ? (Number(descuentoPorLitroInput) || 0) : 0,
        descuentoPor: descuentoQuien, // chofer | dueno — quién asume el descuento
        fotoMedidorUrl: fotoUrl,
        nota: nota.trim() || null,
      };
      // Modo precio: enviar flag para que el backend calcule litros
      if (modoIngreso === "por_precio" && precioTotalInput) {
        payload.modoPrecio = "por_precio";
        payload.precioTotal = Number(precioTotalInput) || 0;
      }
      if (vueltaIdOverride) payload.vueltaId = vueltaIdOverride;
      if (pedidoSeleccionadoId) payload.pedidoId = pedidoSeleccionadoId;

      if (isEdit && entrega) {
        await apiPatch(`/api/akuosplash/entregas/${entrega.id}`, payload);
        toast.success("Entrega actualizada correctamente", { duration: 6000 });
      } else {
        await apiPost("/api/akuosplash/entregas", payload);
        // Confirmación muy clara con detalles para que el chofer sepa que se registró
        toast.success(`✓ Entrega registrada: ${formatNumber(litrosFinalLocal, 0)} L · ${formatCurrency(totalConDescuento)} · ${clienteNombreLocal}`, {
          duration: 8000,
          description: "La entrega se guardó correctamente. No necesitás registrar otra vez.",
        });
      }
      onSaved();
      onOpenChange(false);
      setDialogoVueltaAbierto(false);
    } catch (e) {
      console.error("[guardarEntrega] error al guardar:", e);
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      // Si el error es porque el pedido ya fue entregado, mensaje específico
      if (msg.includes("PEDIDO_YA_ENTREGADO") || msg.includes("ya fue entregado") || msg.includes("ya entregado")) {
        toast.error("⚠ Este pedido ya fue entregado antes. No se puede registrar otra entrega para el mismo pedido.", {
          duration: 10000,
          description: "Si querés registrar otra entrega, creá un pedido nuevo. La foto que subiste NO se perdió — está en el campo de foto del medidor.",
        });
      } else {
        toast.error(`No se pudo guardar la entrega: ${msg}`, {
          duration: 10000,
          description: "La foto que subiste NO se perdió — está en el campo de foto del medidor. Revisá los datos y volvé a intentar.",
        });
      }
      // NO cerramos el form si falla — el usuario no pierde la foto
      // Pero sí reseteamos el flag de saving
    } finally {
      // IMPORTANTE: resetear savingRef SIEMPRE, sino queda bloqueado y no
      // se pueden registrar más entregas hasta recargar la página.
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Cargar vueltas recientes cerradas sin completar
  async function cargarVueltasRecientes() {
    setCargandoVueltas(true);
    try {
      const data = await apiGet<{ vueltas: VueltaReciente[] }>(`/api/akuosplash/vueltas?period=mes`);
      // Filtrar: no activas + no completadas + de este chofer (si aplica)
      const excluidas = data.vueltas.filter((v) => {
        const completada = esVueltaCompletada(v.litros, v.capacidadCamion, v.cantidadEntregas);
        return !completada;
      });
      setVueltasRecientes(excluidas.slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoVueltas(false);
    }
  }

  // Validar que haya litros suficientes antes de iniciar/reabrir vuelta
  // Retorna true si la validación pasa, false si falla (y muestra error)
  function validarLitrosAntesDeVuelta(): boolean {
    const estanquesConLitros = estanquesEntrega.filter((e) => Number(e.litros) > 0);
    const modoEst = modoEstanques;

    if ((modoEst || estanquesConLitros.length > 0) && estanquesEntrega.length > 0) {
      const totalLitrosEst = estanquesConLitros.reduce((s, e) => s + (Number(e.litros) || 0), 0);
      if (totalLitrosEst <= 0) {
        toast.error("Ingresa al menos litros en un estanque antes de iniciar la vuelta");
        return false;
      }
      return true;
    }

    if (litrosFinal <= 0) {
      toast.error("Los litros deben ser mayores a 0 antes de iniciar la vuelta");
      return false;
    }
    return true;
  }

  // Iniciar nueva vuelta y luego guardar la entrega con el nuevo vueltaId
  async function iniciarNuevaYGuardar() {
    // Validar ANTES de crear la vuelta para evitar vueltas huérfanas
    if (!validarLitrosAntesDeVuelta()) return;

    const camionesActivos = (camiones ?? []).filter((c) => c.activo);
    if (camionesActivos.length === 0) {
      toast.error(
        isDueno
          ? "No hay camiones activos. Agrega uno en Ajustes primero."
          : "No tienes camiones asignados. Pídele al administrador que te asigne uno en Ajustes → Camiones."
      );
      return;
    }
    const camionId = camionSeleccionado || camionesActivos[0].id;
    setIniciandoVuelta(true);
    try {
      const res = await apiPost<{ vuelta: { id: string; numero: number } }>("/api/akuosplash/vueltas", { camionId });
      toast.success(`Vuelta #${res.vuelta.numero} iniciada`);
      // Guardar la entrega PRIMERO (sin notificar al padre aún para evitar re-renders que puedan afectar el estado)
      await guardarEntrega(res.vuelta.id);
      // Después de guardar, onSaved() ya se encargó de refrescar el padre
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar la vuelta");
    } finally {
      setIniciandoVuelta(false);
    }
  }

  // Reabrir vuelta existente y luego guardar la entrega con ese vueltaId
  async function reabrirYGuardar(vuelta: VueltaReciente) {
    // Validar ANTES de reabrir la vuelta para evitar vueltas huérfanas
    if (!validarLitrosAntesDeVuelta()) return;

    setIniciandoVuelta(true);
    try {
      const res = await apiPost<{ vuelta: { id: string; numero: number } }>(`/api/akuosplash/vueltas/${vuelta.id}/reabrir`, {});
      toast.success(`Vuelta #${res.vuelta.numero} reabierta`);
      // Guardar la entrega PRIMERO
      await guardarEntrega(res.vuelta.id);
      // Después de guardar, onSaved() ya se encargó de refrescar el padre
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reabrir la vuelta");
    } finally {
      setIniciandoVuelta(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteNombre.trim()) {
      toast.error("Indica el nombre del cliente");
      return;
    }
    // Directamente guardar. Si no hay vuelta activa, el backend guarda la entrega
    // con vueltaId=null. Sin diálogos molestos.
    await guardarEntrega();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar entrega" : "Registrar entrega de agua"}</DialogTitle>
          <DialogDescription>
            Registra la venta de agua. Puedes calcular los litros desde las lecturas del medidor o ingresarlos manualmente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vuelta actual (info) */}
          {vueltaActual && !isEdit && (
            <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" />
                <span>
                  Se asignará a la <strong>Vuelta #{vueltaActual.numero}</strong>
                  {vueltaActual.camion && <> · {vueltaActual.camion.nombre}</>}
                </span>
              </div>
              {vueltaActual.capacidadCamion != null && vueltaActual.capacidadCamion > 0 && (
                <span className="text-xs text-muted-foreground">
                  Entregado: {formatNumber(vueltaActual.litros, 0)} L · Disponible: {formatNumber(Math.max(0, vueltaActual.capacidadCamion - vueltaActual.litros), 0)} L
                </span>
              )}
            </div>
          )}

          {/* Aviso de pedido seleccionado */}
          {pedidoSeleccionadoId && !isEdit && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>
                Esta entrega corresponde a un <strong>pedido pendiente</strong>.
                {" "}Al guardar, el pedido se marcará automáticamente como <strong>entregado</strong>.
              </span>
              <button
                type="button"
                onClick={() => setPedidoSeleccionadoId(null)}
                className="ml-auto shrink-0 text-xs text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
              >
                Desvincular
              </button>
            </div>
          )}

          {/* Pedidos pendientes — PRIMERA OPCIÓN — solo si no hay cliente seleccionado */}
          {pedidosPendientes.length > 0 && !clienteId && (
            <div className="rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-blue-900 dark:text-blue-200">
                  <ClipboardList className="h-4 w-4" /> Pedidos pendientes — clic para entregar
                </p>
                {vueltaActual && vueltaActual.capacidadCamion != null && vueltaActual.capacidadCamion > 0 && (
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    Agua disponible: {formatNumber(Math.max(0, vueltaActual.capacidadCamion - vueltaActual.litros), 0)} L
                  </span>
                )}
              </div>
              {pedidosPendientes.map((p) => {
                const clientePedido = p.clienteId ? clientes.find(c => c.id === p.clienteId) : null;
                // Calcular agua disponible en la vuelta activa
                const capacidadVuelta = vueltaActual?.capacidadCamion ?? 0;
                const litrosEntregadosVuelta = vueltaActual?.litros ?? 0;
                const aguaDisponible = Math.max(0, capacidadVuelta - litrosEntregadosVuelta);
                const excedeAgua = capacidadVuelta > 0 && p.litrosSolicitados > aguaDisponible;
                const litrosFaltantes = excedeAgua ? p.litrosSolicitados - aguaDisponible : 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      // Pasar pedidoId a onSelectCliente para preservarlo
                      if (p.clienteId) {
                        onSelectCliente(p.clienteId, p.id);
                      } else {
                        setClienteId("__manual");
                        setClienteNombre(p.clienteNombre);
                        setPedidoSeleccionadoId(p.id);
                      }
                      setLitrosManual(String(p.litrosSolicitados));
                      setMetodoPago(p.metodoPagoPreferido);
                      // Aviso inmediato si no hay suficiente agua
                      if (excedeAgua) {
                        toast.warning(
                          `Este pedido pide ${formatNumber(p.litrosSolicitados, 0)} L pero solo quedan ${formatNumber(aguaDisponible, 0)} L en la vuelta #${vueltaActual?.numero}. ` +
                          `Faltan ${formatNumber(litrosFaltantes, 0)} L. ` +
                          `Puedes entregar lo que queda y cerrar la vuelta, o cerrar la vuelta y empezar una nueva.`,
                          { duration: 10000 }
                        );
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-background p-3 text-left transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{p.clienteNombre}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          {p.litrosSolicitados > 0 ? `${formatNumber(p.litrosSolicitados, 0)} L` : "Sin cantidad"}
                        </span>
                        <span>·</span>
                        <span>{labelMetodoPago(p.metodoPagoPreferido)}</span>
                        {clientePedido?.estanquesJson && <span>· 🛢️ Estanques</span>}
                        {excedeAgua && (
                          <span className="text-amber-600 dark:text-amber-400">
                            ⚠ Solo quedan {formatNumber(aguaDisponible, 0)} L
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="ml-2 shrink-0 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                      Entregar →
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Separador */}
          {pedidosPendientes.length > 0 && !clienteId && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">o entrega sin pedido</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="clienteSelect">Cliente del catálogo</Label>
            <select
              id="clienteSelect"
              value={clienteId || "__manual"}
              onChange={(e) => onSelectCliente(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="__manual">— Ingreso manual —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.zona ? ` · ${c.zona}` : ""}{c.estanquesJson ? " 🛢️" : ""}
                </option>
              ))}
            </select>

            {/* Botón manual para activar estanques */}
            {clienteId && clienteId !== "__manual" && estanquesEntrega.length > 0 && !modoEstanques && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModoEstanques(true)}
                className="w-full border-amber-400 text-amber-800"
              >
                💧 Entregar por estanque ({estanquesEntrega.length} estanque(s))
              </Button>
            )}

            {/* Panel de info de acceso del cliente seleccionado — colapsable */}
            {clienteId && clienteId !== "__manual" && (() => {
              const c = clientes.find((cl) => cl.id === clienteId);
              if (!c) return null;
              const tieneAlgo = c.indicacionesAcceso || c.lat != null || c.requiereIngresoPropiedad || c.entregaDesdeAfuera || c.conexionExterna || c.requiereClientePresente === false;
              if (!tieneAlgo) return null;
              return (
                <details className="mt-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-2">
                  <summary className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                    <DoorOpen className="h-3.5 w-3.5" /> Información de acceso
                  </summary>
                  <div className="mt-2 space-y-2">
                    {(c.requiereIngresoPropiedad || c.entregaDesdeAfuera || c.conexionExterna || c.requiereClientePresente === false) && (
                      <div className="flex flex-wrap gap-1">
                        {c.requiereIngresoPropiedad && (
                          <span className="inline-flex items-center gap-0.5 rounded border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 text-[10px] text-amber-900 dark:text-amber-200">
                            <DoorOpen className="h-2.5 w-2.5" /> Ingreso
                          </span>
                        )}
                        {c.entregaDesdeAfuera && (
                          <span className="inline-flex items-center gap-0.5 rounded border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 text-[10px] text-amber-900 dark:text-amber-200">
                            <Fence className="h-2.5 w-2.5" /> Desde afuera
                          </span>
                        )}
                        {c.conexionExterna && (
                          <span className="inline-flex items-center gap-0.5 rounded border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:text-emerald-200">
                            <KeyRound className="h-2.5 w-2.5" /> Conexión externa
                          </span>
                        )}
                        {c.requiereClientePresente === false && (
                          <span className="inline-flex items-center gap-0.5 rounded border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 text-[10px] text-blue-900 dark:text-blue-200">
                            <UserCheck className="h-2.5 w-2.5" /> Sin presencia
                          </span>
                        )}
                      </div>
                    )}
                    {c.indicacionesAcceso && (
                      <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                        {c.indicacionesAcceso}
                      </p>
                    )}
                    {c.lat != null && c.lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Navigation className="h-3 w-3" /> Cómo llegar (Google Maps)
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  {/* Geofence: verificar llegada */}
                  {c.lat != null && c.lng != null && (
                    <div className="mt-2">
                      <GeofenceWidget
                        clienteLat={c.lat}
                        clienteLng={c.lng}
                        clienteNombre={c.nombre}
                        compact
                      />
                    </div>
                  )}
                </details>
              );
            })()}

            {/* Panel de deuda del cliente */}
            {clienteId && clienteId !== "__manual" && clienteDeuda != null && clienteDeuda !== 0 && (
              <div className={`mt-2 rounded-lg border p-3 space-y-1 ${
                clienteDeuda > 0
                  ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                  : "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
              }`}>
                <p className={`flex items-center gap-1.5 text-xs font-medium ${
                  clienteDeuda > 0 ? "text-red-800 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"
                }`}>
                  <Banknote className="h-3.5 w-3.5" />
                  {clienteDeuda > 0
                    ? `Este cliente tiene una deuda pendiente de ${formatCurrency(clienteDeuda)}`
                    : `Este cliente tiene saldo a favor de ${formatCurrency(Math.abs(clienteDeuda))}`
                  }
                </p>
                {clienteDeuda > 0 && (
                  <p className="text-[11px] text-red-700 dark:text-red-400">
                    Puedes recibir más efectivo que el total de esta entrega para cubrir la deuda anterior.
                    El exceso se descontará automáticamente del saldo pendiente.
                  </p>
                )}
              </div>
            )}

            {/* Botón para activar entrega por estanque */}
            {clienteId && clienteId !== "__manual" && estanquesEntrega.length > 0 && !modoEstanques && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <Droplets className="h-3.5 w-3.5" />
                  Este cliente tiene {estanquesEntrega.length} estanque(s) registrado(s)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModoEstanques(true)}
                  className="w-full border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-300"
                >
                  <Droplets className="mr-1 h-4 w-4" />
                  Entregar por estanque (cobro separado)
                </Button>
              </div>
            )}

            {/* Botón para agregar estanques cuando el cliente no tiene ninguno registrado */}
            {clienteId && clienteId !== "__manual" && estanquesEntrega.length === 0 && !modoEstanques && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Agregar un estanque vacío para facturación independiente
                    const c = clientes.find((cl) => cl.id === clienteId);
                    const precioEfectivoEst = c?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
                    const precioTransferenciaEst = c?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
                    const precioMaxEst = Math.max(precioEfectivoEst, precioTransferenciaEst);
                    setEstanquesEntrega([{
                      nombre: "Estanque 1",
                      litros: "",
                      precio: String(precioMaxEst || 0),
                      metodoPago: "credito",
                      montoRecibido: "",
                    }]);
                    setModoEstanques(true);
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-amber-700 dark:hover:text-amber-300"
                >
                  <Droplets className="mr-1 h-3.5 w-3.5" />
                  Cobrar por estanque (el cliente no tiene estanques registrados, pero puedes agregarlos aquí)
                </Button>
              </div>
            )}

            {/* Botón para desactivar modo estanques */}
            {modoEstanques && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoEstanques(false)}
                  className="text-xs"
                >
                  ← Volver a entrega simple (un solo cobro)
                </Button>
              </div>
            )}
          </div>

          {/* Info compacta del cliente + botón ver ficha */}
          {clienteId && clienteId !== "__manual" && clienteNombre && (() => {
            const c = clientes.find((cl) => cl.id === clienteId);
            return (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{clienteNombre}</p>
                  {clienteDireccion && <p className="truncate text-xs text-muted-foreground">📍 {clienteDireccion}</p>}
                </div>
                {c && c.lat != null && c.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10"
                    title="Ver ubicación"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                )}
              </div>
            );
          })()}

          {/* Solo mostrar campos de cliente para ingreso manual */}
          {clienteId === "__manual" && (
            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clienteNombre">Nombre del cliente *</Label>
                  <Input
                    id="clienteNombre"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clienteTelefono">Teléfono</Label>
                  <Input
                    id="clienteTelefono"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678"
                  />
                </div>
              </div>
              {/* Aviso si el nombre coincide con un cliente del catálogo */}
              {clienteNombre.trim().length >= 3 && (() => {
                const nombreLower = clienteNombre.trim().toLowerCase();
                const coincidencias = clientes.filter(c =>
                  c.nombre.toLowerCase().includes(nombreLower) ||
                  nombreLower.includes(c.nombre.toLowerCase())
                ).slice(0, 3);
                if (coincidencias.length > 0) {
                  return (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        ⚠️ ¿Es uno de estos clientes?
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {coincidencias.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectCliente(c.id)}
                            className="rounded border border-amber-400 bg-white px-2 py-0.5 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
                          >
                            {c.nombre}{c.zona ? ` · ${c.zona}` : ""}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                        Seleccioná el cliente del catálogo para que la entrega se asocie a su ficha.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Toggle: Por litros / Por precio — siempre visible */}
          {(
            <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant={modoIngreso === "por_litros" ? "default" : "ghost"}
                onClick={() => setModoIngreso("por_litros")}
                className="h-7 flex-1"
              >
                Por litros
              </Button>
              <Button
                type="button"
                size="sm"
                variant={modoIngreso === "por_precio" ? "default" : "ghost"}
                onClick={() => setModoIngreso("por_precio")}
                className="h-7 flex-1"
              >
                Por precio ($)
              </Button>
            </div>
          )}

          {/* Lecturas del medidor / Modo precio — siempre visible */}
          {modoIngreso === "por_litros" && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Litros entregados</p>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">Usar lecturas del medidor</summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="lecturaAnterior" className="text-xs">Lectura anterior</Label>
                    <Input
                      id="lecturaAnterior"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={lecturaAnterior}
                      onChange={(e) => setLecturaAnterior(e.target.value)}
                      placeholder="0"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lecturaActual" className="text-xs">Lectura actual</Label>
                    <Input
                      id="lecturaActual"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={lecturaActual}
                      onChange={(e) => setLecturaActual(e.target.value)}
                      placeholder="0"
                      className="h-8"
                    />
                  </div>
                </div>
                {litrosCalculado != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Diferencia: <strong>{formatNumber(litrosCalculado, 0)} L</strong>
                  </p>
                )}
              </details>
            </div>
            <div className="space-y-2">
              <Input
                id="litrosManual"
                type="number"
                inputMode="decimal"
                step="any"
                value={litrosManual}
                onChange={(e) => setLitrosManual(e.target.value)}
                placeholder={litrosCalculado != null ? String(litrosCalculado) : "Ingresar litros"}
                className="text-lg font-medium"
              />
              {litrosCalculado != null && litrosManual === "" && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculado: <strong>{formatNumber(litrosCalculado, 0)} L</strong>
                  {vueltaActual && vueltaActual.capacidadCamion != null && vueltaActual.capacidadCamion > 0 && (
                    (() => {
                      const disponible = Math.max(0, vueltaActual.capacidadCamion - vueltaActual.litros);
                      if (litrosCalculado > disponible) {
                        return (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">
                            ⚠ Solo quedan {formatNumber(disponible, 0)} L en el camión
                          </span>
                        );
                      }
                      return null;
                  })()
                )}
              </p>
            )}
            </div>
          </div>
          )}

          {/* Modo precio: ingresar monto total — siempre visible */}
          {modoIngreso === "por_precio" && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <Label htmlFor="precioTotal" className="text-sm font-medium text-blue-900 dark:text-blue-200">
                ¿Cuántos pesos de agua quiere el cliente?
              </Label>
              <Input
                id="precioTotal"
                type="number"
                inputMode="decimal"
                step="any"
                value={precioTotalInput}
                onChange={(e) => setPrecioTotalInput(e.target.value)}
                placeholder="Ej. 10000"
                className="mt-1"
              />
              {precioTotalInput && precioFinal > 0 && (
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  Se entregarán <strong>{formatNumber(Math.round((Number(precioTotalInput) || 0) / precioFinal), 0)} L</strong>
                  {" "}(a {formatCurrency(precioFinal)}/L)
                  {metodoPago === "credito" && " · Se asume transferencia si no especifica pago"}
                </p>
              )}
            </div>
          )}

          {/* Precio por litro */}
          <div className="space-y-2">
            <Label htmlFor="precio">Precio por litro</Label>
            <Input
              id="precio"
              type="number"
              inputMode="decimal"
              step="any"
              value={precioPorLitro}
              onChange={(e) => setPrecioPorLitro(e.target.value)}
              placeholder="0"
              disabled={esCamionCompleto}
            />
            <p className="text-xs text-muted-foreground">
              Default: {formatCurrency(config.precioEfectivoPorLitro)}/L efectivo · {formatCurrency(config.precioTransferenciaPorLitro)}/L transferencia
            </p>
            {precioCamionCompletoVal > 0 && (
              <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
                <input
                  type="checkbox"
                  checked={esCamionCompleto}
                  onChange={(e) => {
                    setEsCamionCompleto(e.target.checked);
                    if (e.target.checked) {
                      // Al activar camión completo, pasar a modo por litros (no usa precio total)
                      setModoIngreso("por_litros");
                      setPrecioTotalInput("");
                    }
                  }}
                  className="h-4 w-4"
                />
                <span className="text-xs text-amber-900 dark:text-amber-200">
                  <strong>Camión completo</strong> — tarifa fija {formatCurrency(precioCamionCompletoVal)} (independiente de litros)
                </span>
              </label>
            )}
          </div>

          {/* Descuento — siempre visible */}
          {(
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Descuento</Label>
                <select
                  value={descuentoTipo}
                  onChange={(e) => {
                    setDescuentoTipo(e.target.value);
                    setDescuentoMonto("");
                    setDescuentoPorLitroInput("");
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="ninguno">Sin descuento</option>
                  <option value="total">Descuento sobre el total</option>
                  <option value="por_litro">Descuento por litro</option>
                </select>
              </div>
              {descuentoTipo === "total" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={descuentoMonto}
                    onChange={(e) => setDescuentoMonto(e.target.value)}
                    placeholder="Ej. 1200 (para redondear de 21200 a 20000)"
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    → {formatCurrency(Math.max(0, totalCalculado - (Number(descuentoMonto) || 0)))}
                  </span>
                </div>
              )}
              {descuentoTipo === "por_litro" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={descuentoPorLitroInput}
                    onChange={(e) => setDescuentoPorLitroInput(e.target.value)}
                    placeholder="Ej. 1 (bajar de 8 a 7 por litro)"
                    className="h-8 text-sm w-32"
                  />
                  <span className="text-xs text-muted-foreground">
                    {litrosFinal > 0 && `→ ${formatCurrency((Number(descuentoPorLitroInput) || 0) * litrosFinal)} off`}
                  </span>
                </div>
              )}
              {descuentoTipo !== "ninguno" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Lo asume:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setDescuentoQuien("chofer")}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${
                          descuentoQuien === "chofer"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Chofer
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescuentoQuien("dueno")}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${
                          descuentoQuien === "dueno"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Admin
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {descuentoQuien === "chofer"
                      ? "Se descontará de tu pago en liquidación."
                      : "Se descontará de la utilidad del administrador."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resumen de cálculo — siempre visible y automático */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
              Cálculo automático
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <span className="text-xs uppercase text-muted-foreground">Litros</span>
                <p className="text-lg font-bold tabular-nums">{formatNumber(litrosFinal, 0)} L</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Precio/L</span>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(precioFinal)}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Subtotal</span>
                <p className="text-base font-bold tabular-nums text-muted-foreground">{formatCurrency(totalCalculado)}</p>
                {descuentoMontoFinal > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    −{formatCurrency(descuentoMontoFinal)} desc.
                  </p>
                )}
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Total final</span>
                <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(totalConDescuento)}</p>
                {saldoFinal > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Saldo: {formatCurrency(saldoFinal)}</p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Recibido: <strong>{formatCurrency(recibidoFinal)}</strong> (efectivo + transferencia)
            </p>
            {/* Si hay deuda anterior y el cliente paga más del total */}
            {clienteDeuda != null && clienteDeuda > 0 && recibidoFinal > totalConDescuento && totalConDescuento > 0 && (
              <div className="mt-1 rounded bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-800 dark:text-red-300">
                <p>Excedente para deuda anterior: <strong>{formatCurrency(recibidoFinal - totalConDescuento)}</strong></p>
                <p>Deuda total después de este pago: <strong>{formatCurrency(Math.max(0, clienteDeuda - (recibidoFinal - totalConDescuento)))}</strong></p>
              </div>
            )}
            {/* Si el cliente tiene saldo a favor */}
            {clienteDeuda != null && clienteDeuda < 0 && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Saldo a favor anterior: <strong>{formatCurrency(Math.abs(clienteDeuda))}</strong>
              </p>
            )}
          </div>

          {/* Desglose por estanque (cuando el cliente tiene facturación independiente) */}
          {modoEstanques && estanquesEntrega.length > 0 && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
                <Droplets className="h-4 w-4" /> Entrega por estanque (facturación independiente)
              </Label>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Registra los litros y el pago de cada estanque por separado.
              </p>

              {estanquesEntrega.map((est, i) => {
                const litrosEst = Number(est.litros) || 0;
                const precioEst = Number(est.precio) || 0;
                const totalEstRaw = litrosEst * precioEst;
                // Redondear a $100 superior
                const totalEst = totalEstRaw > 0 ? Math.ceil(totalEstRaw / 100) * 100 : 0;
                const recibidoEst = Number(est.montoRecibido) || 0;
                return (
                  <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-background p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 shrink-0">{i + 1}.</span>
                      <Input
                        type="text"
                        value={est.nombre}
                        onChange={(e) => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, nombre: e.target.value } : est2))}
                        className="h-7 text-xs flex-1"
                        placeholder="Nombre del estanque"
                      />
                      {estanquesEntrega.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => setEstanquesEntrega(estanquesEntrega.filter((_, j) => j !== i))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {/* Toggle por litros / por precio para cada estanque */}
                    <div className="flex gap-1 rounded bg-amber-100/50 p-0.5 dark:bg-amber-900/30">
                      <button
                        type="button"
                        onClick={() => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, modoIngreso: "por_litros", litros: "", precioTotalInput: "" } : est2))}
                        className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition ${(est.modoIngreso ?? "por_litros") === "por_litros" ? "bg-white text-amber-900 dark:bg-background dark:text-amber-200 shadow-sm" : "text-amber-700 dark:text-amber-300"}`}
                      >
                        Por litros
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, modoIngreso: "por_precio", litros: "", precioTotalInput: "" } : est2))}
                        className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition ${(est.modoIngreso ?? "por_litros") === "por_precio" ? "bg-white text-amber-900 dark:bg-background dark:text-amber-200 shadow-sm" : "text-amber-700 dark:text-amber-300"}`}
                      >
                        Por precio ($)
                      </button>
                    </div>
                    {/* Campos según modo de ingreso del estanque */}
                    {(est.modoIngreso ?? "por_litros") === "por_litros" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Litros</label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={est.litros}
                            onChange={(e) => {
                              const nuevosLitros = e.target.value;
                              const precioCalc = Number(est.precio) || 0;
                              const totalCalc = (Number(nuevosLitros) || 0) * precioCalc;
                              const totalRedondeado = totalCalc > 0 ? Math.ceil(totalCalc / 100) * 100 : 0;
                              setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? {
                                ...est2,
                                litros: nuevosLitros,
                                montoRecibido: est2.metodoPago === "credito" ? "" : (est2.montoRecibido || (totalRedondeado > 0 ? String(totalRedondeado) : "")),
                              } : est2));
                            }}
                            placeholder="0"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Precio/L</label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={est.precio}
                            onChange={(e) => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, precio: e.target.value } : est2))}
                            placeholder="0"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">¿Cuántos pesos de agua?</label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={est.precioTotalInput ?? ""}
                            onChange={(e) => {
                              const precioTotalStr = e.target.value;
                              const precioCalc = Number(est.precio) || 0;
                              const litrosCalc = precioCalc > 0 ? Math.round((Number(precioTotalStr) || 0) / precioCalc) : 0;
                              const totalRedondeado = Number(precioTotalStr) > 0 ? Math.ceil(Number(precioTotalStr) / 100) * 100 : 0;
                              setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? {
                                ...est2,
                                precioTotalInput: precioTotalStr,
                                litros: litrosCalc > 0 ? String(litrosCalc) : "",
                                montoRecibido: est2.metodoPago === "credito" ? "" : (totalRedondeado > 0 ? String(totalRedondeado) : ""),
                              } : est2));
                            }}
                            placeholder="Ej. 5000"
                            className="h-8 text-xs"
                          />
                        </div>
                        {est.precioTotalInput && Number(est.precio) > 0 && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-300">
                            → {formatNumber(Math.round((Number(est.precioTotalInput) || 0) / (Number(est.precio) || 1)), 0)} L a {formatCurrency(Number(est.precio))}/L
                          </p>
                        )}
                        <div>
                          <label className="text-[10px] text-muted-foreground">Precio/L (para cálculo)</label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={est.precio}
                            onChange={(e) => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, precio: e.target.value } : est2))}
                            placeholder="0"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Método de pago</label>
                        <select
                          value={est.metodoPago}
                          onChange={(e) => {
                            const nuevoMetodo = e.target.value;
                            const c = clientes.find(cl => cl.id === clienteId);
                            const precioEfectivo = c?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
                            const precioTransferencia = c?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
                            let nuevoPrecio = est.precio;
                            if (nuevoMetodo === "efectivo") {
                              nuevoPrecio = String(precioEfectivo || 0);
                            } else if (nuevoMetodo === "transferencia") {
                              nuevoPrecio = String(precioTransferencia || 0);
                            } else {
                              // Sin pago: usar el precio MÁS ALTO para generar deuda correcta
                              // El usuario puede ajustar al momento de cobrar
                              nuevoPrecio = String(Math.max(precioEfectivo, precioTransferencia) || 0);
                            }
                            const totalEstCalc = (Number(est.litros) || 0) * (Number(nuevoPrecio) || 0);
                            setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? {
                              ...est2,
                              metodoPago: nuevoMetodo,
                              precio: nuevoPrecio,
                              // Sin pago: NO auto-llenar montoRecibido (queda vacío = 0 = deuda)
                              montoRecibido: nuevoMetodo === "credito" ? "" : (est2.montoRecibido || (totalEstCalc > 0 ? String(Math.round(totalEstCalc)) : "")),
                            } : est2));
                          }}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="credito">Sin pago</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Monto recibido</label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={est.montoRecibido}
                          onChange={(e) => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, montoRecibido: e.target.value } : est2))}
                          placeholder={est.metodoPago === "credito" ? "—" : String(Math.round(totalEst))}
                          disabled={est.metodoPago === "credito"}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      {est.metodoPago === "credito" ? (
                        <>
                          <span className="text-muted-foreground">Total: <strong className="text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(totalEst)}</strong> <span className="text-[9px]">(a crédito)</span></span>
                          <span className="text-amber-600 dark:text-amber-400">Pendiente</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Total: <strong className="text-foreground tabular-nums">{formatCurrency(totalEst)}</strong></span>
                          {recibidoEst > 0 && recibidoEst < totalEst && (
                            <span className="text-amber-600 dark:text-amber-400">Saldo: {formatCurrency(totalEst - recibidoEst)}</span>
                          )}
                          {recibidoEst >= totalEst && totalEst > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400">✓ Pagado</span>
                          )}
                        </>
                      )}
                    </div>
                    {/* Foto del medidor POR ESTANQUE — cada estanque tiene su propio medidor */}
                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-[10px] text-muted-foreground shrink-0">📷 Medidor:</label>
                      {est.fotoUrl ? (
                        <div className="flex items-center gap-2">
                          <a href={est.fotoUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={est.fotoUrl} alt={`Medidor de ${est.nombre}`} className="h-12 w-12 rounded border border-amber-200 object-cover" />
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-red-600"
                            onClick={() => setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, fotoUrl: null } : est2))}
                          >
                            Quitar
                          </Button>
                        </div>
                      ) : (
                        <label className={`inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 text-[10px] text-amber-900 dark:text-amber-200 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 ${est.subiendoFoto ? "opacity-50 pointer-events-none" : ""}`}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={async (ev) => {
                              const file = ev.target.files?.[0];
                              if (!file) return;
                              // Marcar como subiendo
                              setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, subiendoFoto: true } : est2));
                              try {
                                const { uploadFile } = await import("@/lib/api-client");
                                const result = await uploadFile(file, { tipo: "estanque", clienteId: clienteId || undefined, clienteNombre: clienteNombre || undefined, estanqueNombre: est.nombre });
                                setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, fotoUrl: result.url, subiendoFoto: false } : est2));
                                if (result.uploadedToServer) {
                                  toast.success(`Foto del medidor de "${est.nombre}" guardada`);
                                } else {
                                  toast.success(`📷 Foto de "${est.nombre}" guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.`, { duration: 8000 });
                                }
                              } catch (e: any) {
                                console.error("Error subiendo foto de estanque:", e);
                                toast.error(e?.message || "No se pudo subir la foto del medidor");
                                setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? { ...est2, subiendoFoto: false } : est2));
                              }
                              // Limpiar el input para poder volver a seleccionar el mismo archivo
                              ev.target.value = "";
                            }}
                          />
                          {est.subiendoFoto ? "Subiendo…" : "Tomar foto"}
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Total de la entrega (suma de estanques) */}
              {(() => {
                const totalLitrosEst = estanquesEntrega.reduce((s, e) => s + (Number(e.litros) || 0), 0);
                const totalVentaEst = estanquesEntrega.reduce((s, e) => s + (Number(e.litros) || 0) * (Number(e.precio) || 0), 0);
                const totalRecibidoEst = estanquesEntrega.reduce((s, e) => s + (Number(e.montoRecibido) || 0), 0);
                const haySinPago = estanquesEntrega.some(e => e.metodoPago === "credito");
                return (
                  <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2 text-center text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Total litros</p>
                        <p className="font-bold tabular-nums">{formatNumber(totalLitrosEst, 0)} L</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Total venta</p>
                        {haySinPago && totalVentaEst === 0 ? (
                          <p className="font-bold text-amber-600 dark:text-amber-400 text-xs">Ingresá litros y precio</p>
                        ) : (
                          <p className={`font-bold tabular-nums ${haySinPago ? "text-amber-600 dark:text-amber-400" : ""}`} title={haySinPago ? "Parte del total está a crédito" : ""}>
                            {formatCurrency(totalVentaEst)}
                            {haySinPago && <span className="text-[9px] font-normal ml-1">(parcial a crédito)</span>}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Total recibido</p>
                        <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRecibidoEst)}</p>
                      </div>
                    </div>
                    {haySinPago && (
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        Los estanques sin pago se cobrarán después. Ve a la ficha del cliente → Registrar pago.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Botón para agregar otro estanque */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const c = clientes.find((cl) => cl.id === clienteId);
                  const precioEfectivoEst = c?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
                  const precioTransferenciaEst = c?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
                  const precioMaxEst = Math.max(precioEfectivoEst, precioTransferenciaEst);
                  setEstanquesEntrega([...estanquesEntrega, {
                    nombre: `Estanque ${estanquesEntrega.length + 1}`,
                    litros: "",
                    precio: String(precioMaxEst || 0),
                    metodoPago: "credito",
                    montoRecibido: "",
                  }]);
                }}
                className="w-full border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-300"
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar otro estanque
              </Button>
            </div>
          )}

          {/* Si NO está en modo estanques, mostrar los botones de cobro normales */}
          {!modoEstanques && (
          <>
          {/* Botones rápidos de cobro */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cobro al cliente</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* Botón: Efectivo */}
              <button
                type="button"
                onClick={() => {
                  setMetodoPago("efectivo");
                  setMontoTransferencia("");
                  // Actualizar precio según método
                  const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) ?? null : null;
                  const precioEfectivoNuevo = clienteActual?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
                  aplicarPrecioSegunMetodo("efectivo", clienteActual);
                  // Calcular el nuevo total con el precio efectivo (no usar totalConDescuento que tiene precio viejo)
                  let nuevoTotal = esCamionCompleto && precioCamionCompletoVal > 0
                    ? precioCamionCompletoVal
                    : (litrosFinal || 0) * precioEfectivoNuevo;
                  if (nuevoTotal > 0) {
                    nuevoTotal = Math.ceil(nuevoTotal / 100) * 100;
                  }
                  // Aplicar descuento si existe
                  let descuentoAplicar = 0;
                  if (descuentoTipo === "total") descuentoAplicar = Number(descuentoMonto) || 0;
                  else if (descuentoTipo === "por_litro") descuentoAplicar = (Number(descuentoPorLitroInput) || 0) * litrosFinal;
                  const nuevoTotalConDescuento = Math.max(0, nuevoTotal - descuentoAplicar);
                  // Si no hay efectivo ingresado, auto-llenar con el total NUEVO
                  if (!montoEfectivo) {
                    setMontoEfectivo(String(Math.round(nuevoTotalConDescuento)));
                  }
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                  metodoPago === "efectivo" && efectivoFinal > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-sm font-medium">Efectivo</span>
                {efectivoFinal > 0 && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(efectivoFinal)}</span>
                )}
              </button>

              {/* Botón: Transferencia */}
              <button
                type="button"
                onClick={() => {
                  setMetodoPago("transferencia");
                  setMontoEfectivo("");
                  // Actualizar precio según método
                  const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) ?? null : null;
                  const precioTransfNuevo = clienteActual?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
                  aplicarPrecioSegunMetodo("transferencia", clienteActual);
                  // Calcular el nuevo total con el precio transferencia (no usar totalConDescuento que tiene precio viejo)
                  let nuevoTotal = esCamionCompleto && precioCamionCompletoVal > 0
                    ? precioCamionCompletoVal
                    : (litrosFinal || 0) * precioTransfNuevo;
                  if (nuevoTotal > 0) {
                    nuevoTotal = Math.ceil(nuevoTotal / 100) * 100;
                  }
                  // Aplicar descuento si existe
                  let descuentoAplicar = 0;
                  if (descuentoTipo === "total") descuentoAplicar = Number(descuentoMonto) || 0;
                  else if (descuentoTipo === "por_litro") descuentoAplicar = (Number(descuentoPorLitroInput) || 0) * litrosFinal;
                  const nuevoTotalConDescuento = Math.max(0, nuevoTotal - descuentoAplicar);
                  // Si no hay transferencia ingresada, auto-llenar con el total NUEVO
                  if (!montoTransferencia) {
                    setMontoTransferencia(String(Math.round(nuevoTotalConDescuento)));
                  }
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                  metodoPago === "transferencia" && transferenciaFinal > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Smartphone className="h-5 w-5" />
                <span className="text-sm font-medium">Transferencia</span>
                {transferenciaFinal > 0 && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(transferenciaFinal)}</span>
                )}
              </button>

              {/* Botón: Sin pago (pendiente) */}
              <button
                type="button"
                onClick={() => {
                  setMetodoPago("credito");
                  setMontoEfectivo("");
                  setMontoTransferencia("");
                  // Sin pago: usar el precio MÁS ALTO para generar deuda correcta
                  // El usuario puede ajustar el precio al momento de cobrar
                  const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) ?? null : null;
                  aplicarPrecioSegunMetodo("credito", clienteActual);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                  recibidoFinal === 0
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border-border hover:border-amber-500/50"
                }`}
              >
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Sin pago</span>
                <span className="text-xs text-muted-foreground">Genera deuda</span>
              </button>
            </div>

            {/* Inputs de monto (aparecen cuando hay cobro) */}
            {efectivoFinal > 0 && (
              <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-2">
                <Label htmlFor="montoEfectivo" className="text-xs">
                  <Banknote className="mr-1 inline h-3 w-3" /> Efectivo recibido
                </Label>
                <Input
                  id="montoEfectivo"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={montoEfectivo}
                  onChange={(e) => setMontoEfectivo(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {transferenciaFinal > 0 && (
              <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-2">
                <Label htmlFor="montoTransferencia" className="text-xs">
                  <Smartphone className="mr-1 inline h-3 w-3" /> Transferencia recibida
                </Label>
                <Input
                  id="montoTransferencia"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={montoTransferencia}
                  onChange={(e) => setMontoTransferencia(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {/* Mostrar datos de transferencia al chofer cuando el método es transferencia
                o cuando ya hay un monto de transferencia ingresado (método mixto implícito).
                Importante: mostrarlo SIEMPRE que el método sea transferencia, no solo
                cuando ya hay monto ingresado — el chofer necesita ver los datos ANTES
                de ingresar el monto, para saber a dónde el cliente tiene que transferir. */}
            {(metodoPago === "transferencia" || transferenciaFinal > 0) && (
              <DatosTransferenciaCollapsible />
            )}

            {/* Estado automático (solo lectura) */}
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Estado del pago:</span>
              <span className={`font-semibold ${
                estadoPago === "pagado" ? "text-emerald-600 dark:text-emerald-400"
                : estadoPago === "parcial" ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
              }`}>
                {estadoPago === "pagado" ? "✓ Pagado" : estadoPago === "parcial" ? "Parcial" : "Pendiente"}
              </span>
            </div>
          </div>
          </>
          )}

          {/* Foto del medidor */}
          <div className="space-y-2">
            <Label>Foto del medidor (respaldo)</Label>
            {fotoUrl ? (
              <div className="relative w-fit">
                { }
                <img
                  src={fotoUrl}
                  alt="Foto del medidor"
                  className="h-40 w-auto rounded-lg border border-border object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute -right-2 -top-2 h-7 w-7 rounded-full"
                  onClick={() => setFotoUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5">
                {subiendoFoto ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-6 w-6" />
                    <span>Tomar foto o subir imagen</span>
                    <span className="text-xs">JPG / PNG / WEBP · máx 8 MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFoto(f);
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nota">Nota</Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Observaciones: ubicación del estanque, dificultad de acceso, etc."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Registrar entrega"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

