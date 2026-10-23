"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronRight, Map as MapIcon, List, CheckCircle2, Circle, MapPin, Plus } from "lucide-react";
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

interface SubZona {
  id: string;
  nombre: string;
  sector: string;
  tipoSector: string;
  activa: boolean;
  centroLat: number | null;
  centroLng: number | null;
  radioKm: number | null;
  precioPorLitro: number;
  litrosMinimos: number;
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
  subZonas: SubZona[];
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
  // Sub-zona creation
  const [creatingSubZona, setCreatingSubZona] = useState<Comuna | null>(null);
  const [subForm, setSubForm] = useState({
    sector: "",
    tipoSector: "urbano" as "urbano" | "rural",
    centroLat: "" as number | "",
    centroLng: "" as number | "",
    radioKm: 5 as number | "",
    precioPorLitro: "" as number | "",
    litrosMinimos: "" as number | "",
  });
  const [savingSub, setSavingSub] = useState(false);
  // Map click mode — user clicks on map to set sub-zona centroid
  const [mapCreateMode, setMapCreateMode] = useState(false);
  // Recordar la comuna cuando el usuario cierra el modal para seleccionar en el mapa
  const [pendingSubZonaComuna, setPendingSubZonaComuna] = useState<Comuna | null>(null);
  // Búsqueda OSM de localidades
  const [osmSearch, setOsmSearch] = useState("");
  const [osmResults, setOsmResults] = useState<any[]>([]);
  const [osmSearching, setOsmSearching] = useState(false);
  // Edición de sub-zona existente
  const [editingSubZona, setEditingSubZona] = useState<any>(null);

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

  function abrirCrearSubZona(c: Comuna) {
    setCreatingSubZona(c);
    setSubForm({
      sector: "",
      tipoSector: "urbano",
      centroLat: c.centroidLat,
      centroLng: c.centroidLng,
      radioKm: 5,
      precioPorLitro: c.zona?.precioPorLitro ?? "",
      litrosMinimos: c.zona?.litrosMinimos ?? "",
    });
    setMapCreateMode(false);
  }

  // Cuando el usuario hace click en el mapa en modo "crear", setear lat/lng del form
  function handleMapClick(lat: number, lng: number) {
    setSubForm(prev => ({ ...prev, centroLat: lat, centroLng: lng }));
    setMapCreateMode(false);
    // Reabrir el modal si había una creación pendiente
    if (pendingSubZonaComuna) {
      setCreatingSubZona(pendingSubZonaComuna);
      setPendingSubZonaComuna(null);
    }
    toast.success(`Ubicación seleccionada: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  }

  // Buscar localidades en OpenStreetMap (Nominatim)
  async function buscarOSM() {
    if (!osmSearch.trim() || !creatingSubZona) return;
    setOsmSearching(true);
    setOsmResults([]);
    try {
      const q = encodeURIComponent(`${osmSearch}, ${creatingSubZona.nombre}, Chile`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=cl`);
      const data = await res.json();
      setOsmResults(data || []);
      if (data.length === 0) {
        toast.info("No se encontraron resultados. Probá con otro nombre.");
      }
    } catch (e: any) {
      toast.error("Error buscando: " + (e?.message || ""));
    } finally {
      setOsmSearching(false);
    }
  }

  // Seleccionar un resultado de OSM
  function seleccionarOSM(resultado: any) {
    setSubForm(prev => ({
      ...prev,
      sector: resultado.name || osmSearch,
      centroLat: parseFloat(resultado.lat),
      centroLng: parseFloat(resultado.lon),
    }));
    setOsmResults([]);
    setOsmSearch("");
    toast.success(`Ubicación seleccionada: ${resultado.name}`);
  }

  // Abrir edición de sub-zona existente
  function abrirEditarSubZona(sz: any, comuna: Comuna) {
    setEditingSubZona({ ...sz, comunaNombre: comuna.nombre, comunaCode: comuna.codComuna });
    setSubForm({
      sector: sz.sector || sz.nombre,
      tipoSector: sz.tipoSector || "urbano",
      centroLat: sz.centroLat ?? "",
      centroLng: sz.centroLng ?? "",
      radioKm: sz.radioKm ?? 5,
      precioPorLitro: sz.precioPorLitro ?? "",
      litrosMinimos: sz.litrosMinimos ?? "",
    });
  }

  // Guardar edición de sub-zona existente
  async function guardarEdicionSubZona() {
    if (!editingSubZona) return;
    setSavingSub(true);
    try {
      // Usar el endpoint PATCH de la comuna para actualizar
      await akuoApi(`/api/akuosplash/admin/regiones-comunas/${editingSubZona.comunaCode}/sub-zonas`, {
        method: "POST",
        body: JSON.stringify({
          sector: subForm.sector.trim(),
          tipoSector: subForm.tipoSector,
          centroLat: Number(subForm.centroLat),
          centroLng: Number(subForm.centroLng),
          radioKm: Number(subForm.radioKm) || 5,
          precioPorLitro: subForm.precioPorLitro === "" ? undefined : Number(subForm.precioPorLitro),
          litrosMinimos: subForm.litrosMinimos === "" ? undefined : Number(subForm.litrosMinimos),
        }),
      });
      toast.success(`Sub-zona "${subForm.sector}" actualizada`);
      setEditingSubZona(null);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar");
    } finally {
      setSavingSub(false);
    }
  }

  async function crearSubZona() {
    if (!creatingSubZona) return;
    if (!subForm.sector.trim()) { toast.error("Nombre del sector obligatorio"); return; }
    if (subForm.centroLat === "" || subForm.centroLng === "") { toast.error("Centroide obligatorio"); return; }
    setSavingSub(true);
    try {
      await akuoApi(`/api/akuosplash/admin/regiones-comunas/${creatingSubZona.codComuna}/sub-zonas`, {
        method: "POST",
        body: JSON.stringify({
          sector: subForm.sector.trim(),
          tipoSector: subForm.tipoSector,
          centroLat: Number(subForm.centroLat),
          centroLng: Number(subForm.centroLng),
          radioKm: Number(subForm.radioKm) || 5,
          precioPorLitro: subForm.precioPorLitro === "" ? undefined : Number(subForm.precioPorLitro),
          litrosMinimos: subForm.litrosMinimos === "" ? undefined : Number(subForm.litrosMinimos),
        }),
      });
      toast.success(`Sub-zona "${subForm.sector}" creada en ${creatingSubZona.nombre}`);
      setCreatingSubZona(null);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear");
    } finally {
      setSavingSub(false);
    }
  }

  // Auto-cargar localidades predefinidas de GeoNames
  async function cargarLocalidades(c: Comuna, soloTipo?: "urbano" | "rural") {
    try {
      const res = await akuoApi(`/api/akuosplash/admin/regiones-comunas/${c.codComuna}/auto-popular`, {
        method: "POST",
        body: JSON.stringify({ soloTipo }),
      });
      toast.success(res.message || `${res.creadas} localidades cargadas`);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar las localidades");
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
                          <div key={c.codComuna} className="rounded-md hover:bg-muted/50 px-2 py-1.5">
                            {/* Fila principal de la comuna */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                                {c.zona?.activa ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                ) : c.zona ? (
                                  <Circle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                )}
                                <span className="text-sm">{c.nombre}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{c.provincia}</span>
                                {c.subZonas && c.subZonas.length > 0 && (
                                  <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700">
                                    {c.subZonas.length} sub-zonas
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                {c.zona?.precioPorLitro != null && (
                                  <span className="text-xs tabular-nums text-muted-foreground mr-1">${c.zona.precioPorLitro}/L</span>
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
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => cargarLocalidades(c)}
                                      title="Cargar localidades predefinidas de GeoNames"
                                    >
                                      📍 Cargar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => abrirCrearSubZona(c)}
                                    >
                                      <Plus className="h-3 w-3" /> Manual
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-red-600"
                                      onClick={() => desactivar(c)}
                                    >
                                      Desactivar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* Sub-zonas de esta comuna (lista expandible) */}
                            {c.subZonas && c.subZonas.length > 0 && (
                              <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-3 space-y-1">
                                {c.subZonas.map(sz => (
                                  <div key={sz.id} className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-gray-50">
                                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${sz.activa ? "bg-emerald-500" : "bg-gray-300"}`} />
                                    <span className="font-medium">{sz.sector || sz.nombre}</span>
                                    <Badge variant="outline" className={`text-[9px] shrink-0 ${sz.tipoSector === "urbano" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                                      {sz.tipoSector === "urbano" ? "🏙️" : "🌾"} {sz.tipoSector}
                                    </Badge>
                                    {sz.precioPorLitro != null && (
                                      <span className="text-[10px] text-muted-foreground">${sz.precioPorLitro}/L</span>
                                    )}
                                    {sz.radioKm && (
                                      <span className="text-[10px] text-muted-foreground">{sz.radioKm}km</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
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
            {/* Barra de acciones del mapa */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex gap-2 items-center">
                {mapCreateMode ? (
                  <span className="text-xs text-blue-700 flex items-center gap-1 bg-blue-50 border border-blue-300 rounded px-2 py-1">
                    <MapPin className="h-3.5 w-3.5 animate-pulse" />
                    Hacé click en el mapa para ubicar: "{subForm.sector || "(sin nombre)"}"
                    <button onClick={() => setMapCreateMode(false)} className="ml-1 text-red-600 font-bold">✕</button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => {
                    // Buscar comunas activas para crear sub-zona
                    const activas = comunasFiltradas.filter(c => c.zona?.activa);
                    if (activas.length === 0) {
                      toast.info("Primero activá una comuna. Cambiá a vista Lista y click en 'Activar' en la comuna que quieras.");
                      return;
                    }
                    if (activas.length === 1) {
                      abrirCrearSubZona(activas[0]);
                    } else {
                      // Si hay varias activas, abrir un selector rápido
                      const nombres = activas.map(c => `${c.nombre} (${c.codComuna})`).join("\n");
                      // Usar la primera como default
                      abrirCrearSubZona(activas[0]);
                      toast.info(`Hay ${activas.length} comunas activas. Se abrió el form para ${activas[0].nombre}. Cambiá de comuna en la vista Lista si querés otra.`);
                    }
                  }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Crear sub-zona
                  </Button>
                )}
              </div>
              {creatingSubZona && !mapCreateMode && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMapCreateMode(true)}>
                  <MapPin className="h-3 w-3 mr-1" /> 📍 Seleccionar ubicación en mapa
                </Button>
              )}
            </div>
            <div className="h-[600px] rounded-lg overflow-hidden border">
              <MapView comunas={comunasFiltradas} onEdit={abrirEditar} mapCreateMode={mapCreateMode} onMapClick={handleMapClick} onEditSubZona={abrirEditarSubZona} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click en una comuna (polígono) para editarla. Verde = activa, gris = no configurada.
              Para crear una sub-zona: click en "Crear sub-zona" → completar nombre → click en "📍 Seleccionar ubicación" → click en el mapa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => setEditing(null)}>
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

      {/* Modal crear sub-zona */}
      {creatingSubZona && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => setCreatingSubZona(null)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-bold text-base">Nueva sub-zona en {creatingSubZona.nombre}</h3>
                <p className="text-xs text-muted-foreground">{creatingSubZona.region} · {creatingSubZona.provincia}</p>
              </div>
              <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
                Las sub-zonas son sectores dentro de una comuna (urbanos o rurales) con su propio precio y cobertura. Ejemplos: "Pan de Azúcar" (urbano), "Cruz de Caña" (rural).
              </p>

              {/* Búsqueda OSM */}
              <div className="space-y-1">
                <Label className="text-xs">🔎 Buscar localidad por nombre (OpenStreetMap)</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={osmSearch}
                    onChange={(e) => setOsmSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && osmSearch.trim()) buscarOSM(); }}
                    placeholder="Ej: Pan de Azúcar"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" className="h-8" onClick={buscarOSM} disabled={osmSearching || !osmSearch.trim()}>
                    {osmSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {osmResults.length > 0 && (
                  <div className="space-y-0.5 mt-1 border rounded p-1.5 bg-gray-50">
                    {osmResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => seleccionarOSM(r)}
                        className="w-full text-left text-xs hover:bg-blue-50 rounded px-2 py-1"
                      >
                        📍 {r.name || r.display_name?.split(",")[0]} ({r.lat?.slice(0,7)}, {r.lon?.slice(0,7)})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Nombre del sector *</Label>
                  <Input value={subForm.sector} onChange={(e) => setSubForm({ ...subForm, sector: e.target.value })} placeholder="Ej: Pan de Azúcar" className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de sector</Label>
                  <select
                    value={subForm.tipoSector}
                    onChange={(e) => setSubForm({ ...subForm, tipoSector: e.target.value as any })}
                    className="w-full h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="urbano">🏙️ Urbano (zona de vivienda/pueblo)</option>
                    <option value="rural">🌾 Rural (campo, sectores alejados)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Latitud</Label>
                    <Input type="number" step="any" value={subForm.centroLat} onChange={(e) => setSubForm({ ...subForm, centroLat: e.target.value === "" ? "" : Number(e.target.value) })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Longitud</Label>
                    <Input type="number" step="any" value={subForm.centroLng} onChange={(e) => setSubForm({ ...subForm, centroLng: e.target.value === "" ? "" : Number(e.target.value) })} className="h-8" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => {
                    // Cerrar el modal temporalmente, cambiar a vista mapa, activar modo click
                    setPendingSubZonaComuna(creatingSubZona);
                    setCreatingSubZona(null);
                    setVista("mapa");
                    setMapCreateMode(true);
                  }}>
                    <MapPin className="h-3 w-3 mr-1" /> Seleccionar en mapa
                  </Button>
                </div>
                {subForm.centroLat !== "" && subForm.centroLng !== "" && (
                  <p className="text-[10px] text-emerald-600">✓ Ubicación: {Number(subForm.centroLat).toFixed(4)}, {Number(subForm.centroLng).toFixed(4)}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Radio (km)</Label>
                    <Input type="number" step="any" value={subForm.radioKm} onChange={(e) => setSubForm({ ...subForm, radioKm: e.target.value === "" ? "" : Number(e.target.value) })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Precio/L (override)</Label>
                    <Input type="number" value={subForm.precioPorLitro} onChange={(e) => setSubForm({ ...subForm, precioPorLitro: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Hereda" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Litros mín.</Label>
                    <Input type="number" value={subForm.litrosMinimos} onChange={(e) => setSubForm({ ...subForm, litrosMinimos: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Hereda" className="h-8" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setCreatingSubZona(null)}>Cancelar</Button>
                <Button size="sm" onClick={crearSubZona} disabled={savingSub}>
                  {savingSub ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Crear sub-zona
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// === MapView — lazy-load Leaflet con polígonos de comunas + sub-zonas ===
function MapView({ comunas, onEdit, mapCreateMode, onMapClick, onEditSubZona }: {
  comunas: Comuna[];
  onEdit: (c: Comuna) => void;
  mapCreateMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onEditSubZona?: (sz: any, comuna: Comuna) => void;
}) {
  const [MapLib, setMapLib] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [geoData, setGeoData] = useState<Record<number, any>>({});
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    import("react-leaflet").then(mod => {
      if (cancelled) return;
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
    }).catch(e => console.error("[MapView] error:", e));
    return () => { cancelled = true; };
  }, []);

  // Cargar GeoJSON de regiones que tienen comunas activas o visibles
  useEffect(() => {
    if (!ready) return;
    const regionsNeeded = new Set<number>();
    for (const c of comunas) {
      if (c.centroidLat != null) regionsNeeded.add(c.codRegion);
    }
    // Solo cargar regiones que no están ya cargadas
    const toLoad = [...regionsNeeded].filter(r => !geoData[r]);
    if (toLoad.length === 0) return;
    setLoadingGeo(true);
    Promise.all(toLoad.map(async (regionNum) => {
      try {
        const res = await fetch(`/chile-geojson/${regionNum}.geojson`);
        if (res.ok) {
          const data = await res.json();
          return { regionNum, data };
        }
      } catch (e) { console.error("[MapView] error loading region", regionNum, e); }
      return null;
    })).then(results => {
      setGeoData(prev => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.regionNum] = r.data;
        }
        return next;
      });
      setLoadingGeo(false);
    });
  }, [ready, comunas, geoData]);

  // Registrar click handler cuando cambia mapCreateMode
  // Debe estar ANTES del early return (Rules of Hooks)
  useEffect(() => {
    if (!mapInstance) return;
    const handler = (e: any) => {
      if (mapCreateMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };
    mapInstance.on("click", handler);
    mapInstance.getContainer().style.cursor = mapCreateMode ? "crosshair" : "";
    return () => {
      mapInstance.off("click", handler);
    };
  }, [mapInstance, mapCreateMode, onMapClick]);

  if (!ready || !MapLib) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { MapContainer, TileLayer, GeoJSON, Circle, Popup, Tooltip } = MapLib;

  const chileCenter: [number, number] = [-33.45, -70.66];

  // Indexar comunas por código para buscar rápido al renderizar polígonos
  const comunasByCode: Record<string, Comuna> = {};
  for (const c of comunas) {
    comunasByCode[String(c.codComuna)] = c;
  }

  // Filtrar comunas con coordenadas válidas
  const comunasValidas = comunas.filter(c =>
    c.centroidLat != null && c.centroidLng != null &&
    !isNaN(c.centroidLat) && !isNaN(c.centroidLng)
  );

  return (
    <>
      <MapContainer ref={setMapInstance} center={chileCenter} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        {/* Polígonos de comunas (con delimitación visible) */}
        {Object.entries(geoData).map(([regionNumStr, geoJson]) => {
          const regionNum = parseInt(regionNumStr);
          const features = (geoJson as any).features || [];
          const filteredFeatures = features.filter((f: any) => {
            const codComuna = String(f.properties?.cod_comuna || "");
            return comunasByCode[codComuna];
          });
          if (filteredFeatures.length === 0) return null;
          const filteredGeo = { type: "FeatureCollection", features: filteredFeatures };
          return (
            <GeoJSON
              key={`region-${regionNum}`}
              data={filteredGeo}
              style={(feature: any) => {
                const codComuna = String(feature?.properties?.cod_comuna || "");
                const comuna = comunasByCode[codComuna];
                const isActive = comuna?.zona?.activa;
                const isConfigured = !!comuna?.zona;
                return {
                  color: isActive ? "#059669" : isConfigured ? "#f59e0b" : "#6b7280",
                  weight: isActive ? 3 : 2,
                  fillColor: isActive ? "#10b981" : isConfigured ? "#fbbf24" : "#d1d5db",
                  fillOpacity: isActive ? 0.4 : isConfigured ? 0.3 : 0.15,
                };
              }}
              eventHandlers={{
                click: (e: any) => {
                  const layer = e.layer || e.target;
                  const feature = layer?.feature;
                  if (feature) {
                    const codComuna = String(feature.properties?.cod_comuna || "");
                    const comuna = comunasByCode[codComuna];
                    if (comuna) onEdit(comuna);
                  }
                }
              }}
            >
              {filteredFeatures.map((f: any) => {
                const codComuna = String(f.properties?.cod_comuna || "");
                const comuna = comunasByCode[codComuna];
                if (!comuna) return null;
                return (
                  <Popup key={codComuna}>
                    <div style={{ minWidth: 160 }}>
                      <p style={{ fontWeight: 700, margin: 0, fontSize: 13 }}>{comuna.nombre}</p>
                      <p style={{ fontSize: 10, color: "#666", margin: "2px 0" }}>{comuna.region}</p>
                      {comuna.zona?.activa ? (
                        <p style={{ fontSize: 11, color: "#059669", margin: "4px 0 0" }}>✓ Activa · ${comuna.zona.precioPorLitro}/L</p>
                      ) : comuna.zona ? (
                        <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 0" }}>○ Configurada (inactiva)</p>
                      ) : (
                        <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>No configurada — click para activar</p>
                      )}
                      {comuna.subZonas && comuna.subZonas.length > 0 && (
                        <p style={{ fontSize: 10, color: "#3b82f6", margin: "2px 0 0" }}>📍 {comuna.subZonas.length} sub-zonas</p>
                      )}
                    </div>
                  </Popup>
                );
              })}
            </GeoJSON>
          );
        })}

        {/* Círculos de sub-zonas (cobertura visible + click para editar) */}
        {comunasValidas.flatMap(c =>
          (c.subZonas || []).filter(sz =>
            sz.centroLat != null && sz.centroLng != null &&
            !isNaN(sz.centroLat) && !isNaN(sz.centroLng)
          ).map(sz => {
            const center: [number, number] = [sz.centroLat!, sz.centroLng!];
            const radiusM = (sz.radioKm || 5) * 1000;
            const isActive = sz.activa;
            const isUrbano = sz.tipoSector === "urbano";
            return (
              <Circle
                key={sz.id}
                center={center}
                radius={radiusM}
                pathOptions={{
                  color: isActive ? (isUrbano ? "#2563eb" : "#d97706") : "#94a3b8",
                  weight: isActive ? 2 : 1,
                  fillColor: isActive ? (isUrbano ? "#3b82f6" : "#f59e0b") : "#cbd5e1",
                  fillOpacity: isActive ? 0.35 : 0.12,
                  dashArray: isActive ? undefined : "4 4",
                }}
                eventHandlers={{
                  click: () => onEditSubZona?.(sz, c),
                }}
              >
                <Tooltip sticky>
                  <span style={{ fontSize: 11, cursor: "pointer" }}>
                    📍 {sz.sector || sz.nombre} ({isUrbano ? "🏙️ urbano" : "🌾 rural"})
                    {sz.activa ? " ✓" : ""}
                    {sz.precioPorLitro != null && ` · $${sz.precioPorLitro}/L`}
                    {sz.radioKm && ` · ${sz.radioKm}km`}
                    <br />
                    <em style={{ color: "#3b82f6" }}>Click para editar</em>
                  </span>
                </Tooltip>
              </Circle>
            );
          })
        )}

        {/* Círculos de cobertura de comunas (fallback cuando no hay polígonos) */}
        {comunasValidas.filter(c => !geoData[c.codRegion]).map(c => {
          const center: [number, number] = [c.centroidLat, c.centroidLng];
          const radiusM = (c.zona?.radioKm || 15) * 1000;
          const isActive = c.zona?.activa;
          return (
            <Circle
              key={`comuna-circle-${c.codComuna}`}
              center={center}
              radius={radiusM}
              pathOptions={{
                color: isActive ? "#059669" : "#9ca3af",
                weight: isActive ? 2 : 1,
                fillColor: isActive ? "#10b981" : "#e5e7eb",
                fillOpacity: isActive ? 0.2 : 0.08,
              }}
              eventHandlers={{ click: () => onEdit(c) }}
            />
          );
        })}
      </MapContainer>

      {/* Leyenda (fuera del mapa) */}
      <div className="absolute bottom-2 right-2 bg-white rounded-md shadow-md border p-2 text-[10px] z-[1000]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-500 border border-emerald-700" />
          <span>Activa</span>
        </div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="inline-block w-3 h-3 rounded bg-amber-400 border border-amber-600" />
          <span>Configurada (inactiva)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="inline-block w-3 h-3 rounded bg-gray-300 border border-gray-500" />
          <span>No configurada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border border-blue-500 border-dashed" style={{ background: "rgba(59,130,246,0.2)" }} />
          <span>Sub-zona activa</span>
        </div>
      </div>

      {loadingGeo && (
        <div className="absolute top-2 right-2 bg-white rounded-md shadow-md border p-1.5 text-[10px] z-[1000] flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando polígonos...
        </div>
      )}
    </>
  );
}
