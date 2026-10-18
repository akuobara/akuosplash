"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, RefreshCw, Search, Crown, Pause, Play, Ban, CheckCircle2, AlertTriangle, XCircle, Users, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";

interface Subscription {
  id: string;
  email: string;
  nombre: string;
  plan: string;
  planActivoDesde: string | null;
  planActivoHasta: string | null;
  mpSubPreapprovalId: string | null;
  mpSubPlanSolicitado: string | null;
  mpSubCiclo: string | null;
  mpSubStatus: string | null;
  mpSubIniciadoEn: string | null;
  mpSubAutorizadoEn: string | null;
  mpSubAmount: number | null;
  mpSubSuspended: boolean;
  mpSubSuspendedEn: string | null;
  mpSubSuspendedRazon: string | null;
  suscripcionActiva: boolean;
}

interface Stats {
  premiumCount: number;
  proCount: number;
  gratisCount: number;
  authorizedCount: number;
  pendingCount: number;
  pausedCount: number;
  cancelledCount: number;
  paymentFailedCount: number;
  suspendedCount: number;
  expiredCount: number;
  activePlansCount: number;
  totalMRR: number;
}

export function SubscriptionsTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showActionDialog, setShowActionDialog] = useState<{ sub: Subscription; action: string } | null>(null);
  const [actionRazon, setActionRazon] = useState("");
  const [actionExtenderDias, setActionExtenderDias] = useState<number | "">("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("estado", filter);
      if (planFilter !== "all") params.set("plan", planFilter);
      const d = await akuoGet<{ subscriptions: Subscription[]; stats: Stats }>(`/api/akuosplash/admin/subscriptions?${params.toString()}`);
      setSubs(d.subscriptions || []);
      setStats(d.stats);
    } catch (e: any) {
      toast.error("No se pudo cargar: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [filter, planFilter]);

  useEffect(() => { cargar(); }, [cargar]);

  async function ejecutarAccion(subId: string, action: string, razon?: string, extenderDias?: number) {
    setActionLoading(`${subId}_${action}`);
    try {
      await akuoApi(`/api/akuosplash/admin/subscriptions/${subId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, razon, extenderDias }),
      });
      toast.success(`Acción "${action}" ejecutada`);
      setShowActionDialog(null);
      setActionRazon("");
      setActionExtenderDias("");
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo ejecutar");
    } finally {
      setActionLoading(null);
    }
  }

  const filteredSubs = subs.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      return s.email?.toLowerCase().includes(q) || s.nombre?.toLowerCase().includes(q);
    }
    return true;
  });

  function statusBadge(status: string | null, suspended: boolean) {
    if (suspended) return <Badge className="bg-red-100 text-red-800">SUSPENDIDO</Badge>;
    switch (status) {
      case "authorized": return <Badge className="bg-emerald-100 text-emerald-800">AUTH</Badge>;
      case "pending": return <Badge className="bg-amber-100 text-amber-800">PEND</Badge>;
      case "paused": return <Badge className="bg-yellow-100 text-yellow-800">PAUSED</Badge>;
      case "cancelled": return <Badge className="bg-gray-200 text-gray-800">CANCELLED</Badge>;
      case "payment_failed": return <Badge className="bg-red-100 text-red-800">FAILED</Badge>;
      default: return <Badge variant="outline">—</Badge>;
    }
  }

  function isPlanActive(sub: Subscription): boolean {
    if (!sub.planActivoHasta) return false;
    return new Date(sub.planActivoHasta) > new Date() && sub.plan !== "gratis";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Subscripciones</h3>
        <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats principales */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Activas" value={stats.activePlansCount} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
          <StatCard label="Suspendidas" value={stats.suspendedCount} icon={<Ban className="h-4 w-4 text-red-600" />} />
          <StatCard label="Con pagos fallidos" value={stats.paymentFailedCount} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} />
          <StatCard label="Vencidas" value={stats.expiredCount} icon={<XCircle className="h-4 w-4 text-gray-500" />} />
          <StatCard label="Premium" value={stats.premiumCount} icon={<Crown className="h-4 w-4 text-blue-600" />} />
          <StatCard label="Pro" value={stats.proCount} icon={<Crown className="h-4 w-4 text-violet-600" />} />
          <StatCard label="Gratis" value={stats.gratisCount} icon={<Users className="h-4 w-4 text-amber-600" />} />
          <StatCard label="MRR (CLP)" value={formatCLP(stats.totalMRR)} icon={<DollarSign className="h-4 w-4 text-emerald-600" />} />
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">Estado</Label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="all">Todos</option>
                <option value="active">Activas</option>
                <option value="authorized">Authorized</option>
                <option value="pending">Pending</option>
                <option value="paused">Paused</option>
                <option value="payment_failed">Con pagos fallidos</option>
                <option value="cancelled">Cancelled</option>
                <option value="suspended">Suspendidas</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Plan</Label>
              <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="all">Todos</option>
                <option value="gratis">Gratis</option>
                <option value="premium">Premium</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="email o nombre..." className="h-8 pl-7 text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filteredSubs.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay subscripciones con estos filtros</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredSubs.map(s => {
            const vencimiento = s.planActivoHasta ? new Date(s.planActivoHasta) : null;
            const diasRestantes = vencimiento ? Math.ceil((vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const isSuspended = s.mpSubSuspended;
            const isExpired = s.plan !== "gratis" && (!vencimiento || vencimiento < new Date());
            return (
              <Card key={s.id} className={isSuspended ? "border-red-300" : isExpired ? "border-amber-300" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{s.nombre}</p>
                        {statusBadge(s.mpSubStatus, isSuspended)}
                        {s.plan && <Badge variant="outline" className="text-[10px] uppercase">{s.plan}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                      <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                        <p>📅 Plan: <strong className="uppercase">{s.plan}</strong>
                          {s.mpSubCiclo && ` · ${s.mpSubCiclo}`}
                          {s.mpSubAmount != null && ` · ${formatCLP(s.mpSubAmount)}`}
                        </p>
                        {vencimiento && (
                          <p>⏳ Vence: {vencimiento.toLocaleDateString("es-CL")}
                            {diasRestantes !== null && !isExpired && ` (${diasRestantes} días)`}
                            {isExpired && <span className="text-red-600"> (vencido)</span>}
                          </p>
                        )}
                        {s.mpSubSuspendedEn && (
                          <p className="text-red-700">⏸ Suspendido: {new Date(s.mpSubSuspendedEn).toLocaleString("es-CL")}
                            {s.mpSubSuspendedRazon && ` — ${s.mpSubSuspendedRazon}`}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {/* Activar */}
                      {!isPlanActive(s) && !isSuspended && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-emerald-50 hover:bg-emerald-100 border-emerald-300"
                          disabled={actionLoading === `${s.id}_activate`}
                          onClick={() => setShowActionDialog({ sub: s, action: "activate" })}
                        >
                          {actionLoading === `${s.id}_activate` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Activar
                        </Button>
                      )}
                      {/* Suspender */}
                      {!isSuspended && s.plan !== "gratis" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                          disabled={actionLoading === `${s.id}_suspend`}
                          onClick={() => setShowActionDialog({ sub: s, action: "suspend" })}
                        >
                          {actionLoading === `${s.id}_suspend` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3 mr-1" />}
                          Suspender
                        </Button>
                      )}
                      {/* Reactivar */}
                      {isSuspended && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-emerald-50 hover:bg-emerald-100 border-emerald-300"
                          disabled={actionLoading === `${s.id}_reactivate`}
                          onClick={() => ejecutarAccion(s.id, "reactivate")}
                        >
                          {actionLoading === `${s.id}_reactivate` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                          Reactivar
                        </Button>
                      )}
                      {/* Pausar MP */}
                      {s.mpSubPreapprovalId && s.mpSubStatus === "authorized" && !isSuspended && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={actionLoading === `${s.id}_pause`}
                          onClick={() => ejecutarAccion(s.id, "pause", "Pausado por superadmin")}
                        >
                          {actionLoading === `${s.id}_pause` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3 mr-1" />}
                          Pausar MP
                        </Button>
                      )}
                      {/* Cancelar MP */}
                      {s.mpSubPreapprovalId && s.mpSubStatus !== "cancelled" && !isSuspended && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                          disabled={actionLoading === `${s.id}_cancel`}
                          onClick={() => {
                            if (confirm("¿Cancelar la subscripción en MP? El plan seguirá activo hasta el vencimiento.")) {
                              ejecutarAccion(s.id, "cancel", "Cancelado por superadmin");
                            }
                          }}
                        >
                          {actionLoading === `${s.id}_cancel` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                          Cancelar MP
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diálogo de acción (activate / suspend) */}
      {showActionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowActionDialog(null)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">
                {showActionDialog.action === "activate" ? "✅ Activar plan" : "⏸ Suspender plan"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                <strong>{showActionDialog.sub.nombre}</strong> ({showActionDialog.sub.email})
              </p>
              <p className="text-xs text-muted-foreground">
                Plan actual: <strong className="uppercase">{showActionDialog.sub.plan}</strong>
              </p>
              {showActionDialog.action === "activate" && (
                <div>
                  <Label className="text-xs">Extender días (opcional)</Label>
                  <Input
                    type="number"
                    value={actionExtenderDias}
                    onChange={(e) => setActionExtenderDias(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="0"
                    className="h-8"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sumar días extra al periodo normal (1 mes/1 año).</p>
                </div>
              )}
              <div>
                <Label className="text-xs">Razón (opcional)</Label>
                <Input
                  value={actionRazon}
                  onChange={(e) => setActionRazon(e.target.value)}
                  placeholder="Ej: cortesía por problema técnico, etc."
                  className="h-8"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowActionDialog(null)}>Cancelar</Button>
                <Button
                  size="sm"
                  variant={showActionDialog.action === "activate" ? "default" : "destructive"}
                  onClick={() => ejecutarAccion(
                    showActionDialog.sub.id,
                    showActionDialog.action,
                    actionRazon || undefined,
                    typeof actionExtenderDias === "number" ? actionExtenderDias : undefined
                  )}
                >
                  Confirmar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-2.5 flex items-center gap-2">
        <div className="rounded-md bg-muted/30 p-1.5">{icon}</div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-bold tabular-nums text-sm">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
