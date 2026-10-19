"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronRight, Map as MapIcon, List, CheckCircle2, Circle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";

interface ZonaInfo {
  id: string;
  activa: boolean;
  precioPorLitro: number;
  precioMinimoPorLitro: number | null;
  precioMinimoTotal: number | null;
  precioMaximoPorLitro: number | null;
  litrosMinimos: number;
  radioKm: number | null;
}

interface Comuna {
  codComuna: string;
  nombre: string;
  codRegion: number;
  region: string;
  provincia: string;
  centroidLat: number;
  centroidLng: number;
  poligonoUrl: string;
  zona: ZonaInfo | null;
}

interface Region {
  codregion: number;
  nombre: string;
  comunasCount: number;
}

interface EditForm {
  activa: boolean;
  precioPorLitro: number | "";
  precioMinimoPorLitro: number | "";
  precioMinimoTotal: number | "";
  precioMaximoPorLitro: number | "";
  litrosMinimos: number | "";
}

export function RegionesComunasTab() {
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [comunas, setComunas] = useState<Comuna[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Comuna | null>(null);
  const [form, setForm] = useState<EditForm>({
    activa: true,
    precioPorLitro: 50,
    precioMinimoPorLitro: "",
    precioMinimoTotal: "",
    precioMaximoPorLitro: "",
    litrosMinimos: 1000,
  });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<{ regiones: Region[]; comunas: Comuna[]; totalActivas: number; totalConfiguradas: number }>(
        "/api/akuosplash/admin/regiones-comunas"
      );
      setRegiones(d.regiones || []);
      setComunas(d.comunas || []);
    } catch (e: any) {
      toast.error("No se pudo cargar: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function toggleRegion(cod: number) {
    const next = new Set(expandedRegions);
    if (next.has(cod)) next.delete(cod);
    else next.add(cod);
    setExpandedRegions(next);
  }

  function abrirEditar(c: Comuna) {
    setEditing(c);
    setForm({
      activa: c.zona?.activa ?? true,
      precioPorLitro: c.zona?.precioPorLitro ?? 50,
      precioMinimoPorLitro: c.zona?.precioMinimoPorLitro ?? "",
      precioMinimoTotal: c.zona?.precioMinimoTotal ?? "",
      precioMaximoPorLitro: c.zona?.precioMaximoPorLitro ?? "",
      litrosMinimos: c.zona?.litrosMinimos ?? 1000,
    });
  }

  async function guardar() {
    if (!editing) return;
    setSaving(true);
    try {
      await akuoApi(`/api/akuosplash/admin/regiones-comunas/${editing.codComuna}`, {
        method: "PATCH",
        body: JSON.stringify({
          activa: form.activa,
          precioPorLitro: Number(form.precioPorLitro) || 50,
          precioMinimoPorLitro: form.precioMinimoPorLitro === "" ? null : Number(form.precioMinimoPorLitro),
          precioMinimoTotal: form.precioMinimoTotal === "" ? null : Number(form.precioMinimoTotal),
          precioMaximoPorLitro: form.precioMaximoPorLitro === "" ? null : Number(form.precioMaximoPorLitro),
          litrosMinimos: Number(form.litrosMinimos) || 1000,
        }),
      });
      toast.success(`Zona de ${editing.nombre} ${editing.zona ? "actualizada" : "creada"}`);
      setEditing(null);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function desactivar(c: Comuna) {
    if (!c.zona) return;
    if (!confirm(`¿Desactivar la zona de ${c.nombre}?`)) return;
    try {
      await akuoApi(`/api/akuosplash/admin/regiones-comunas/${c.codComuna}`, { method: "DELETE" });
      toast.success(`Zona de ${c.nombre} desactivada`);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo desactivar");
    }
  }

  // Filtrar comunas por búsqueda
  const comunasFiltradas = search
    ? comunas.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || c.region.toLowerCase().includes(search.toLowerCase()))
    : comunas;

  // Filtrar por región expandida
  const comunasPorRegion = (codRegion: number) => comunasFiltradas.filter(c => c.codRegion === codRegion);

  // Stats
  const totalActivas = comunas.filter(c => c.zona?.activa).length;
  const totalConfiguradas = comunas.filter(c => c.zona).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Regiones y Comunas de Chile</h3>
          <p className="text-xs text-muted-foreground">{totalActivas} comunas activas · {totalConfiguradas} configuradas · {comunas.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant={vista === "lista" ? "default" : "outline"} size="sm" onClick={() => setVista("lista")}>
            <List className="h-3.5 w-3.5 mr-1" /> Lista
          </Button>
          <Button variant={vista === "mapa" ? "default" : "outline"} size="sm" onClick={() => setVista("mapa")}>
            <MapIcon className="h-3.5 w-3.5 mr-1" /> Mapa
          </Button>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar comuna o región..."
          className="h-8 pl-7 text-sm"
        />
      </div>

      {/* Vista Lista */}
      {vista === "lista" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : regiones.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay datos</CardContent></Card>
          ) : (
            regiones.map(r => {
              const cs = comunasPorRegion(r.codregion);
              if (cs.length === 0 && search) return null;
              const isExpanded = expandedRegions.has(r.codregion) || !!search;
              const activasEnRegion = cs.filter(c => c.zona?.activa).length;
              return (
                <Card key={r.codregion}>
                  <CardContent className="p-2.5">
                    <button
                      onClick={() => toggleRegion(r.codregion)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""} ${search ? "opacity-0" : ""}`} />
                        <span className="font-medium text-sm">{r.nombre}</span>
                        <Badge variant="outline" className="text-[10px]">{cs.length} comunas</Badge>
                        {activasEnRegion > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">{activasEnRegion} activas</Badge>
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-1 pl-6">
                        {cs.map(c => (
                          <div key={c.codComuna} className="flex items-center justify-between gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {c.zona?.activa ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              ) : c.zona ? (
                                <Circle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              )}
                              <span className="text-sm">{c.nombre}</span>
                              <span className="text-[10px] text-muted-foreground truncate">{c.provincia}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.zona?.precioPorLitro != null && (
                                <span className="text-xs tabular-nums text-muted-foreground">${c.zona.precioPorLitro}/L</span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => abrirEditar(c)}
                              >
                                {c.zona ? "Editar" : "Activar"}
                              </Button>
                              {c.zona && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-red-600"
                                  onClick={() => desactivar(c)}
                                >
                                  Desactivar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Vista Mapa — lazy-load de Leaflet */}
      {vista === "mapa" && (
        <Card>
          <CardContent className="p-3">
            <div className="h-[600px] rounded-lg overflow-hidden border">
              <MapView comunas={comunasFiltradas} onEdit={abrirEditar} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click en una comuna para editarla. Las comunas verdes están activas, las grises no están configuradas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-bold text-base">{editing.nombre}</h3>
                <p className="text-xs text-muted-foreground">{editing.region} · {editing.provincia}</p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <p className="text-sm font-medium">Zona activa</p>
                  <p className="text-xs text-muted-foreground">Si está activa, los clientes de esta comuna pueden pedir agua.</p>
                </div>
                <button
                  onClick={() => setForm({ ...form, activa: !form.activa })}
                  className={`relative w-11 h-6 rounded-full transition ${form.activa ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.activa ? "translate-x-5" : ""}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Precio por litro (CLP) *</Label>
                  <Input type="number" value={form.precioPorLitro} onChange={(e) => setForm({ ...form, precioPorLitro: e.target.value === "" ? "" : Number(e.target.value) })} className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Litros mínimos</Label>
                  <Input type="number" value={form.litrosMinimos} onChange={(e) => setForm({ ...form, litrosMinimos: e.target.value === "" ? "" : Number(e.target.value) })} className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Precio mín. por litro</Label>
                  <Input type="number" value={form.precioMinimoPorLitro} onChange={(e) => setForm({ ...form, precioMinimoPorLitro: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Opcional" className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Precio mín. total</Label>
                  <Input type="number" value={form.precioMinimoTotal} onChange={(e) => setForm({ ...form, precioMinimoTotal: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Opcional" className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Precio máx. por litro (cap)</Label>
                  <Input type="number" value={form.precioMaximoPorLitro} onChange={(e) => setForm({ ...form, precioMaximoPorLitro: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Opcional" className="h-8" />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button size="sm" onClick={guardar} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {editing.zona ? "Guardar cambios" : "Crear zona"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// === MapView — lazy-load Leaflet ===
function MapView({ comunas, onEdit }: { comunas: Comuna[]; onEdit: (c: Comuna) => void }) {
  const [MapLib, setMapLib] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Cargar CSS de Leaflet primero
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    // Importar react-leaflet dinámicamente
    import("react-leaflet").then(mod => {
      if (cancelled) return;
      // Fix Leaflet default icon paths (issue #4968 — bundlers no resuelven los paths relativos)
      import("leaflet").then((L: any) => {
        if (cancelled) return;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
        setMapLib(mod);
        setReady(true);
      });
    }).catch(e => {
      console.error("[MapView] error loading react-leaflet:", e);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready || !MapLib) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { MapContainer, TileLayer, Marker, Popup, CircleMarker } = MapLib;

  // Chile centroid aproximado
  const chileCenter: [number, number] = [-33.45, -70.66];

  // Filtrar comunas con coordenadas válidas (evita "Cannot read properties of null")
  const comunasValidas = comunas.filter(c =>
    c.centroidLat != null && c.centroidLng != null &&
    !isNaN(c.centroidLat) && !isNaN(c.centroidLng)
  );

  return (
    <MapContainer center={chileCenter} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      {comunasValidas.slice(0, 200).map(c => {
        // Usar CircleMarker (no necesita icono externo — más confiable que Marker)
        const center: [number, number] = [c.centroidLat, c.centroidLng];
        const isActive = c.zona?.activa;
        return (
          <CircleMarker
            key={c.codComuna}
            center={center}
            radius={isActive ? 8 : 5}
            pathOptions={{
              color: isActive ? "#059669" : "#9ca3af",
              fillColor: isActive ? "#10b981" : "#d1d5db",
              fillOpacity: isActive ? 0.8 : 0.4,
            }}
            eventHandlers={{ click: () => onEdit(c) }}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{c.nombre}</p>
                <p style={{ fontSize: 11, color: "#666", margin: "2px 0" }}>{c.region}</p>
                {c.zona?.activa ? (
                  <p style={{ fontSize: 11, color: "#059669", margin: "4px 0 0" }}>✓ Activa · ${c.zona.precioPorLitro}/L</p>
                ) : c.zona ? (
                  <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 0" }}>○ Inactiva</p>
                ) : (
                  <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>No configurada — click para activar</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
