"use client";

import { useEffect, useState } from "react";
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
import { apiGet, apiPost, apiPatch, uploadFile } from "@/lib/api-client";
import {
  ESTADOS_PAGO,
  METODOS_PAGO,
  formatCurrency,
  formatNumber,
  labelMetodoPago,
  esVueltaCompletada,
  UMBRAL_COMPLETACION_VUELTA,
  formatTime,
} from "@/lib/helpers";

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
    clienteNombre: string;
    metodoPago: string;
    fecha: string;
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
    capacidadCamion: number;
  };
  vueltaActual: VueltaActual | null;
  pedidosPendientes?: { id: string; clienteNombre: string; clienteId: string | null; litrosSolicitados: number; metodoPagoPreferido: string }[];
  camiones?: { id: string; nombre: string; activo: boolean }[];
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
  const [estanquesEntrega, setEstanquesEntrega] = useState<{ nombre: string; litros: string; precio: string; metodoPago: string; montoRecibido: string }[]>([]);
  const [modoEstanques, setModoEstanques] = useState(false);

  const [lecturaAnterior, setLecturaAnterior] = useState<string>("");
  const [lecturaActual, setLecturaActual] = useState<string>("");
  const [litrosManual, setLitrosManual] = useState<string>("");
  const [precioPorLitro, setPrecioPorLitro] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");

  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [montoTransferencia, setMontoTransferencia] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("pendiente");

  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

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
    } else {
      setClienteId("");
      setClienteNombre("");
      setClienteDireccion("");
      setClienteTelefono("");
      setClienteZona("");
      setLecturaAnterior("");
      setLecturaActual("");
      setLitrosManual("");
      setMetodoPago("efectivo");
      setMontoEfectivo("");
      setMontoTransferencia("");
      setEstadoPago("pendiente");
      setFotoUrl(null);
      setNota("");
      setPedidoSeleccionadoId(null);
      // Auto-llenar precio según método default (efectivo)
      const precioDefault = config.precioEfectivoPorLitro || 0;
      if (precioDefault > 0) {
        setPrecioPorLitro(String(precioDefault));
      } else {
        setPrecioPorLitro("");
      }
    }
  }, [open, entrega, config.precioEfectivoPorLitro]);

  // Si el usuario selecciona un cliente del catálogo, autollenar datos y precio
  function onSelectCliente(id: string) {
    setClienteId(id);
    setPedidoSeleccionadoId(null); // limpiar pedido seleccionado al cambiar cliente manualmente
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
      setEstanquesEntrega(listaEstanques.map((e) => ({
        nombre: e.nombre || e.tipo,
        litros: "",
        precio: String(c.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0),
        metodoPago: "efectivo",
        montoRecibido: "",
      })));
      setModoEstanques(independientes.length > 0);
      toast.info(
        `Cliente tiene ${estanquesCliente.length} estanque(s). ${independientes.length} con facturación independiente. Modo estanques: ${independientes.length > 0 ? "ACTIVADO" : "desactivado"}`,
        { duration: 8000 }
      );
    } else {
      setModoEstanques(false);
      setEstanquesEntrega([]);
      toast.warning("Este cliente NO tiene estanques guardados. estanquesJson: " + (c.estanquesJson || "null"), { duration: 8000 });
    }

    // Cargar la deuda del cliente (en background)
    apiGet<{ entregas: any[] }>(`/api/entregas?period=todo&clienteId=${id}`)
      .then((data) => {
        const totalVentas = data.entregas.reduce((s: number, e: any) => s + (e.total || 0), 0);
        const totalRecibido = data.entregas.reduce((s: number, e: any) => s + (e.montoRecibido || 0), 0);
        setClienteDeuda(totalVentas - totalRecibido);
      })
      .catch(() => setClienteDeuda(null));
  }

  // Helper: aplicar precio según método de pago
  function aplicarPrecioSegunMetodo(metodo: string, cliente: ClienteOption | null) {
    let precio = 0;
    if (metodo === "efectivo") {
      precio = cliente?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
    } else if (metodo === "transferencia") {
      precio = cliente?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
    } else {
      // mixto o crédito: usar precio efectivo como base
      precio = cliente?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
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
    const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) : null;
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

  const litrosFinal = litrosManual !== "" ? Number(litrosManual) : litrosCalculado ?? 0;
  const precioFinal = Number(precioPorLitro) || 0;
  const totalCalculado = litrosFinal * precioFinal;
  const efectivoFinal = Number(montoEfectivo) || 0;
  const transferenciaFinal = Number(montoTransferencia) || 0;
  const recibidoFinal = efectivoFinal + transferenciaFinal;
  const saldoFinal = totalCalculado - recibidoFinal;

  // Auto-actualizar estadoPago según monto recibido (SIEMPRE automático, no manual)
  useEffect(() => {
    if (recibidoFinal === 0) {
      setEstadoPago("pendiente");
    } else if (recibidoFinal >= totalCalculado && totalCalculado > 0) {
      setEstadoPago("pagado");
    } else {
      setEstadoPago("parcial");
    }
  }, [recibidoFinal, totalCalculado]);

  async function handleFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const url = await uploadFile(file);
      setFotoUrl(url);
      toast.success("Foto del medidor subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  }

  // Guarda la entrega con un vueltaId opcional (cuando se inicia/reabre desde el diálogo)
  async function guardarEntrega(vueltaIdOverride?: string) {
    // Capturar el estado actual en variables locales para evitar problemas de stale closure
    const modoEst = modoEstanques;
    const estanques = estanquesEntrega;
    const clienteNombreLocal = clienteNombre.trim();
    const litrosFinalLocal = litrosFinal;
    const precioFinalLocal = precioFinal;
    const totalCalculadoLocal = totalCalculado;
    const efectivoFinalLocal = efectivoFinal;
    const transferenciaFinalLocal = transferenciaFinal;

    // Debug: trace what we're about to save
    console.log("[guardarEntrega] estado capturado:", {
      modoEstanques: modoEst,
      estanquesCount: estanques.length,
      estanquesConLitros: estanques.filter(e => Number(e.litros) > 0).length,
      clienteNombre: clienteNombreLocal,
      litrosFinal: litrosFinalLocal,
      vueltaIdOverride,
    });

    // Determinar si hay datos de estanques con litros > 0
    const estanquesConLitros = estanques.filter((e) => Number(e.litros) > 0);

    // Si está en modo estanques (o hay estanques con litros), usar el path de estanques
    if ((modoEst || estanquesConLitros.length > 0) && estanques.length > 0) {
      const totalLitrosEst = estanquesConLitros.reduce((s, e) => s + (Number(e.litros) || 0), 0);
      if (totalLitrosEst <= 0) {
        toast.error("Ingresa al menos litros en un estanque");
        return;
      }
      const totalVentaEst = estanquesConLitros.reduce((s, e) => s + (Number(e.litros) || 0) * (Number(e.precio) || 0), 0);
      const totalEfectivoEst = estanquesConLitros.filter((e) => e.metodoPago === "efectivo").reduce((s, e) => s + (Number(e.montoRecibido) || 0), 0);
      const totalTransferenciaEst = estanquesConLitros.filter((e) => e.metodoPago === "transferencia").reduce((s, e) => s + (Number(e.montoRecibido) || 0), 0);
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
          detalleEstanquesJson: JSON.stringify(estanquesConLitros.map((e) => ({
            nombre: e.nombre,
            litros: Number(e.litros) || 0,
            precioPorLitro: Number(e.precio) || 0,
            total: (Number(e.litros) || 0) * (Number(e.precio) || 0),
            metodoPago: e.metodoPago,
            montoRecibido: Number(e.montoRecibido) || 0,
          }))),
        };
        if (vueltaIdOverride) payload.vueltaId = vueltaIdOverride;
        if (pedidoSeleccionadoId) payload.pedidoId = pedidoSeleccionadoId;

        console.log("[guardarEntrega] guardando con estanques, payload:", {
          litros: totalLitrosEst,
          total: totalVentaEst,
          vueltaId: payload.vueltaId,
          pedidoId: payload.pedidoId,
          estanquesCount: estanquesConLitros.length,
        });

        if (isEdit && entrega) {
          await apiPatch(`/api/entregas/${entrega.id}`, payload);
          toast.success("Entrega actualizada");
        } else {
          await apiPost("/api/entregas", payload);
          toast.success("Entrega registrada");
        }
        onSaved();
        onOpenChange(false);
        setDialogoVueltaAbierto(false);
      } catch (e) {
        console.error("[guardarEntrega] error al guardar:", e);
        toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (litrosFinalLocal <= 0) {
      toast.error("Los litros deben ser mayores a 0");
      return;
    }

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
        litros: litrosFinalLocal,
        metodoPago,
        precioPorLitro: precioFinalLocal,
        total: totalCalculadoLocal,
        montoEfectivo: efectivoFinalLocal,
        montoTransferencia: transferenciaFinalLocal,
        estadoPago,
        fotoMedidorUrl: fotoUrl,
        nota: nota.trim() || null,
      };
      if (vueltaIdOverride) payload.vueltaId = vueltaIdOverride;
      if (pedidoSeleccionadoId) payload.pedidoId = pedidoSeleccionadoId;

      console.log("[guardarEntrega] guardando sin estanques, payload:", {
        litros: litrosFinalLocal,
        total: totalCalculadoLocal,
        vueltaId: payload.vueltaId,
        pedidoId: payload.pedidoId,
      });

      if (isEdit && entrega) {
        await apiPatch(`/api/entregas/${entrega.id}`, payload);
        toast.success("Entrega actualizada");
      } else {
        await apiPost("/api/entregas", payload);
        toast.success("Entrega registrada");
      }
      onSaved();
      onOpenChange(false);
      setDialogoVueltaAbierto(false);
    } catch (e) {
      console.error("[guardarEntrega] error al guardar:", e);
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  // Cargar vueltas recientes cerradas sin completar
  async function cargarVueltasRecientes() {
    setCargandoVueltas(true);
    try {
      const data = await apiGet<{ vueltas: VueltaReciente[] }>(`/api/vueltas?period=mes`);
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

  // Iniciar nueva vuelta y luego guardar la entrega con el nuevo vueltaId
  async function iniciarNuevaYGuardar() {
    const camionesActivos = (camiones ?? []).filter((c) => c.activo);
    if (camionesActivos.length === 0) {
      toast.error("No hay camiones activos. Agrega uno en Ajustes primero.");
      return;
    }
    const camionId = camionSeleccionado || camionesActivos[0].id;
    setIniciandoVuelta(true);
    try {
      console.log("[iniciarNuevaYGuardar] iniciando vuelta con camionId:", camionId);
      console.log("[iniciarNuevaYGuardar] estado del formulario antes de iniciar:", {
        modoEstanques,
        estanquesCount: estanquesEntrega.length,
        clienteNombre,
        litrosFinal,
      });
      const res = await apiPost<{ vuelta: { id: string; numero: number } }>("/api/vueltas", { camionId });
      toast.success(`Vuelta #${res.vuelta.numero} iniciada`);
      console.log("[iniciarNuevaYGuardar] vuelta creada:", res.vuelta);
      // Guardar la entrega PRIMERO (sin notificar al padre aún para evitar re-renders que puedan afectar el estado)
      await guardarEntrega(res.vuelta.id);
      // Después de guardar, onSaved() ya se encargó de refrescar el padre
    } catch (e) {
      console.error("[iniciarNuevaYGuardar] error:", e);
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar la vuelta");
    } finally {
      setIniciandoVuelta(false);
    }
  }

  // Reabrir vuelta existente y luego guardar la entrega con ese vueltaId
  async function reabrirYGuardar(vuelta: VueltaReciente) {
    setIniciandoVuelta(true);
    try {
      console.log("[reabrirYGuardar] reabriendo vuelta:", vuelta.id, "#"+vuelta.numero);
      console.log("[reabrirYGuardar] estado del formulario antes de reabrir:", {
        modoEstanques,
        estanquesCount: estanquesEntrega.length,
        clienteNombre,
        litrosFinal,
      });
      const res = await apiPost<{ vuelta: { id: string; numero: number } }>(`/api/vueltas/${vuelta.id}/reabrir`, {});
      toast.success(`Vuelta #${res.vuelta.numero} reabierta`);
      console.log("[reabrirYGuardar] vuelta reabierta:", res.vuelta);
      // Guardar la entrega PRIMERO
      await guardarEntrega(res.vuelta.id);
      // Después de guardar, onSaved() ya se encargó de refrescar el padre
    } catch (e) {
      console.error("[reabrirYGuardar] error:", e);
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

    // Si no hay vuelta activa, abrir el diálogo de selección de vuelta
    if (!vueltaActual) {
      // Verificar si hay camiones disponibles
      if (!camiones || camiones.filter(c => c.activo).length === 0) {
        toast.error("No hay vuelta activa ni camiones registrados. Agrega un camión en Ajustes primero.", { duration: 8000 });
        return;
      }
      // Cargar vueltas recientes y abrir el diálogo
      await cargarVueltasRecientes();
      setDialogoVueltaAbierto(true);
      return;
    }

    // Calcular litros totales según modo
    let litrosAEntregar = litrosFinal;
    if (modoEstanques && estanquesEntrega.length > 0) {
      litrosAEntregar = estanquesEntrega.reduce((s, e) => s + (Number(e.litros) || 0), 0);
    }

    // Avisar (no bloquear) si excede la capacidad del camión
    if (vueltaActual.capacidadCamion && vueltaActual.capacidadCamion > 0) {
      const disponible = vueltaActual.capacidadCamion - vueltaActual.litros;
      const tolerancia = 300;
      if (litrosAEntregar > disponible + tolerancia) {
        if (disponible <= 0) {
          toast.warning(
            `El camión está vacío. Esta entrega se registrará pero deberías cerrar la vuelta #${vueltaActual.numero} y empezar una nueva.`,
            { duration: 8000 }
          );
        } else {
          toast.warning(
            `Quedan ${formatNumber(disponible, 0)} L en el camión. Entregarás ${formatNumber(litrosAEntregar, 0)} L. ` +
            `Cierra la vuelta y empieza una nueva para recargar.`,
            { duration: 8000 }
          );
        }
      } else if (disponible - litrosAEntregar <= tolerancia && disponible - litrosAEntregar > 0) {
        toast.info(
          `Después de esta entrega quedarán ${formatNumber(disponible - litrosAEntregar, 0)} L en el camión. ` +
          `Considera cerrar la vuelta pronto.`,
          { duration: 6000 }
        );
      }
    }

    // Guardar con la vuelta activa actual
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

          {/* Pedidos pendientes — PRIMERA OPCIÓN */}
          {pedidosPendientes.length > 0 && (
            <div className="rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-blue-900 dark:text-blue-200">
                <ClipboardList className="h-4 w-4" /> Pedidos pendientes — clic para entregar
              </p>
              {pedidosPendientes.map((p) => {
                const clientePedido = p.clienteId ? clientes.find(c => c.id === p.clienteId) : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPedidoSeleccionadoId(p.id); // marcar que esta entrega viene de un pedido
                      if (p.clienteId) {
                        onSelectCliente(p.clienteId);
                        // onSelectCliente limpia pedidoSeleccionadoId, así que lo volvemos a setear
                        setPedidoSeleccionadoId(p.id);
                      } else {
                        setClienteId("__manual");
                        setClienteNombre(p.clienteNombre);
                      }
                      setLitrosManual(String(p.litrosSolicitados));
                      setMetodoPago(p.metodoPagoPreferido);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-background p-3 text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{p.clienteNombre}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{formatNumber(p.litrosSolicitados, 0)} L</span>
                        <span>·</span>
                        <span>{labelMetodoPago(p.metodoPagoPreferido)}</span>
                        {clientePedido?.estanquesJson && <span>· 🛢️ Estanques</span>}
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
          {pedidosPendientes.length > 0 && (
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

            {/* Panel de info de acceso del cliente seleccionado */}
            {clienteId && clienteId !== "__manual" && (() => {
              const c = clientes.find((cl) => cl.id === clienteId);
              if (!c) return null;
              const tieneAlgo = c.indicacionesAcceso || c.lat != null || c.requiereIngresoPropiedad || c.entregaDesdeAfuera || c.conexionExterna || c.requiereClientePresente === false;
              if (!tieneAlgo) return null;
              return (
                <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                    <DoorOpen className="h-3.5 w-3.5" /> Información de acceso
                  </p>

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

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="clienteDireccion">Dirección</Label>
              <Input
                id="clienteDireccion"
                value={clienteDireccion}
                onChange={(e) => setClienteDireccion(e.target.value)}
                placeholder="Calle, número, referencia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clienteZona">Zona</Label>
              <Input
                id="clienteZona"
                value={clienteZona}
                onChange={(e) => setClienteZona(e.target.value)}
                placeholder="Ej. Rural 5km"
                className="w-[150px]"
              />
            </div>
          </div>

          {/* Lecturas del medidor */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">Lecturas del medidor</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lecturaAnterior" className="text-xs">Lectura anterior</Label>
                <Input
                  id="lecturaAnterior"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={lecturaAnterior}
                  onChange={(e) => setLecturaAnterior(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lecturaActual" className="text-xs">Lectura actual</Label>
                <Input
                  id="lecturaActual"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={lecturaActual}
                  onChange={(e) => setLecturaActual(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="litrosManual" className="text-xs">
                  Litros {litrosCalculado != null && litrosManual === "" && "(auto)"}
                </Label>
                <Input
                  id="litrosManual"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={litrosManual}
                  onChange={(e) => setLitrosManual(e.target.value)}
                  placeholder={litrosCalculado != null ? String(litrosCalculado) : "0"}
                />
              </div>
            </div>
            {litrosCalculado != null && litrosManual === "" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Litros calculados: <strong>{formatNumber(litrosCalculado, 0)} L</strong>
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
            />
            <p className="text-xs text-muted-foreground">
              Default: {formatCurrency(config.precioEfectivoPorLitro)}/L efectivo · {formatCurrency(config.precioTransferenciaPorLitro)}/L transferencia
            </p>
          </div>

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
                <span className="text-xs uppercase text-muted-foreground">Total</span>
                <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(totalCalculado)}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Saldo</span>
                <p className={`text-lg font-bold tabular-nums ${saldoFinal > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatCurrency(saldoFinal)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Recibido: <strong>{formatCurrency(recibidoFinal)}</strong> (efectivo + transferencia)
            </p>
            {/* Si hay deuda anterior y el cliente paga más del total */}
            {clienteDeuda != null && clienteDeuda > 0 && recibidoFinal > totalCalculado && totalCalculado > 0 && (
              <div className="mt-1 rounded bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-800 dark:text-red-300">
                <p>Excedente para deuda anterior: <strong>{formatCurrency(recibidoFinal - totalCalculado)}</strong></p>
                <p>Deuda total después de este pago: <strong>{formatCurrency(Math.max(0, clienteDeuda - (recibidoFinal - totalCalculado)))}</strong></p>
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
                Este cliente tiene estanques que se facturan por separado. Registra los litros y pago de cada uno.
              </p>

              {estanquesEntrega.map((est, i) => {
                const litrosEst = Number(est.litros) || 0;
                const precioEst = Number(est.precio) || 0;
                const totalEst = litrosEst * precioEst;
                const recibidoEst = Number(est.montoRecibido) || 0;
                return (
                  <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-background p-2 space-y-2">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      {i + 1}. {est.nombre}
                    </p>
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
                            setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? {
                              ...est2,
                              litros: nuevosLitros,
                              // Auto-actualizar monto recibido si no fue editado manualmente
                              montoRecibido: est2.metodoPago === "credito" ? "" : (est2.montoRecibido || (totalCalc > 0 ? String(Math.round(totalCalc)) : "")),
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Método de pago</label>
                        <select
                          value={est.metodoPago}
                          onChange={(e) => {
                            const nuevoMetodo = e.target.value;
                            const c = clientes.find(cl => cl.id === clienteId);
                            let nuevoPrecio = est.precio;
                            if (nuevoMetodo === "efectivo") {
                              nuevoPrecio = String(c?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0);
                            } else if (nuevoMetodo === "transferencia") {
                              nuevoPrecio = String(c?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0);
                            } else {
                              // Sin pago: precio se definirá al cobrar
                              nuevoPrecio = "";
                            }
                            const totalEstCalc = (Number(est.litros) || 0) * (Number(nuevoPrecio) || 0);
                            setEstanquesEntrega(estanquesEntrega.map((est2, j) => j === i ? {
                              ...est2,
                              metodoPago: nuevoMetodo,
                              precio: nuevoPrecio,
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
                          <span className="text-muted-foreground">Total: <strong className="text-amber-600 dark:text-amber-400">Se definirá al cobrar</strong></span>
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
                          <p className="font-bold text-amber-600 dark:text-amber-400 text-xs">Se definirá al cobrar</p>
                        ) : (
                          <p className="font-bold tabular-nums">{formatCurrency(totalVentaEst)}</p>
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
                  const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) : null;
                  aplicarPrecioSegunMetodo("efectivo", clienteActual);
                  // Si no hay efectivo ingresado, auto-llenar con el total
                  if (!montoEfectivo) {
                    setMontoEfectivo(String(Math.round(totalCalculado)));
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
                  const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) : null;
                  aplicarPrecioSegunMetodo("transferencia", clienteActual);
                  // Si no hay transferencia ingresada, auto-llenar con el total
                  if (!montoTransferencia) {
                    setMontoTransferencia(String(Math.round(totalCalculado)));
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
                  // Sin pago = sin método definido. El precio se define al cobrar.
                  // Dejar el precio que tenía el usuario (no forzar efectivo ni transferencia).
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                  recibidoFinal === 0
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border-border hover:border-amber-500/50"
                }`}
              >
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Sin pago</span>
                <span className="text-xs text-muted-foreground">Pendiente</span>
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

      {/* Diálogo de selección de vuelta cuando no hay vuelta activa */}
      <Dialog open={dialogoVueltaAbierto} onOpenChange={(o) => {
        if (!iniciandoVuelta && !saving) setDialogoVueltaAbierto(o);
      }}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>No hay vuelta activa</DialogTitle>
            <DialogDescription>
              Para registrar la entrega necesitas una vuelta activa. Puedes retomar una vuelta sin completar o iniciar una nueva.
              {" "}Tus datos de entrega se mantendrán y se guardarán automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Opción: Retomar vuelta existente */}
            {cargandoVueltas ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando vueltas recientes…</span>
              </div>
            ) : vueltasRecientes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vueltas sin completar (puedes retomarlas)
                </p>
                {vueltasRecientes.map((v) => {
                  const porcentaje = v.capacidadCamion > 0 ? (v.litros / v.capacidadCamion) * 100 : 0;
                  const umbralLitros = v.capacidadCamion > 0 ? Math.ceil(v.capacidadCamion * UMBRAL_COMPLETACION_VUELTA) : 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={iniciandoVuelta || saving}
                      onClick={() => reabrirYGuardar(v)}
                      className="flex w-full items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <RotateCcw className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-amber-900 dark:text-amber-200">
                          Retomar Vuelta #{v.numero}
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          {formatNumber(v.litros, 0)} L de {formatNumber(v.capacidadCamion, 0)} L ({porcentaje.toFixed(0)}%)
                          {" · "}iniciada {formatTime(v.iniciadaEn)}
                          {v.camion && <> · {v.camion.nombre}</>}
                          {" · "}faltan {formatNumber(Math.max(0, umbralLitros - v.litros), 0)} L para completar
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                No tienes vueltas recientes sin completar en el último mes.
              </div>
            )}

            {/* Separador */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">o</span>
              </div>
            </div>

            {/* Opción: Iniciar nueva vuelta */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Iniciar nueva vuelta
              </p>
              {(() => {
                const camionesActivos = (camiones ?? []).filter((c) => c.activo);
                if (camionesActivos.length > 1) {
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="camionSelectEntrega">Camión</Label>
                      <select
                        id="camionSelectEntrega"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={camionSeleccionado || camionesActivos[0]?.id || ""}
                        onChange={(e) => setCamionSeleccionado(e.target.value)}
                        disabled={iniciandoVuelta || saving}
                      >
                        {camionesActivos.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}
              <Button
                type="button"
                className="w-full"
                onClick={iniciarNuevaYGuardar}
                disabled={iniciandoVuelta || saving}
              >
                {(iniciandoVuelta || saving) ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando…</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" /> Iniciar nueva vuelta y registrar entrega</>
                )}
              </Button>
            </div>

            {/* Aviso de preservación de datos */}
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Tus datos de entrega (cliente, litros, cobro) ya están cargados.
                {" "}Al elegir una opción, la entrega se guardará automáticamente con la vuelta seleccionada.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogoVueltaAbierto(false)}
              disabled={iniciandoVuelta || saving}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
