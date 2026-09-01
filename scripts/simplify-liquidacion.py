#!/usr/bin/env python3
"""Reemplaza el return principal de liquidacion-tab.tsx con una version simplificada."""

path = "/home/z/my-project/src/components/app/liquidacion-tab.tsx"
with open(path, "r") as f:
    lines = f.readlines()

# El return empieza en línea 232 (índice 231) y termina en línea 763 (índice 762)
# Vamos a reemplazar líneas 232-763 (índices 231-762 inclusive)

new_return = '''  return (
    <div className="space-y-5">
      {/* Selector de período */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => setPeriodoOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <div className="text-center min-w-[180px]">
              <p className="text-xs text-muted-foreground">
                {periodoData?.config?.periodoLiquidacion === "semanal" ? "Semana" : "Mes"}
              </p>
              <p className="text-sm font-semibold">
                {periodoData?.periodo?.label || "Cargando..."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPeriodoOffset(o => Math.min(0, o + 1))}
              disabled={periodoOffset >= 0}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {periodoOffset !== 0 && (
            <div className="mt-2 text-center">
              <Button size="sm" variant="ghost" onClick={() => setPeriodoOffset(0)}>
                Volver al período actual
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {periodoLoading || !periodoData ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          {/* Resumen de vueltas y pago al chofer */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Liquidación del chofer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Vueltas válidas */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Vueltas del período</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Vueltas válidas</p>
                    <p className="text-lg font-bold text-emerald-600">{periodoData.resumen.vueltasCompletadas}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Total vueltas</p>
                    <p className="text-lg font-bold">{periodoData.resumen.vueltasTotal}</p>
                  </div>
                </div>
              </div>

              {/* Pago al chofer según modo */}
              {periodoData.config.modoLiquidacion === "vuelta" ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Pago por vueltas válidas</p>
                  <div className="rounded border p-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Pago al chofer ({periodoData.resumen.vueltasCompletadas} vueltas)</span>
                      <strong>{formatCurrency(periodoData.resumen.pagoChofer)}</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Gastos reembolsables (chofer)</span>
                      <span>{formatCurrency(periodoData.resumen.gastosChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Descuentos chofer</span>
                      <span>{formatCurrency(periodoData.resumen.descuentosChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Impuesto</span>
                      <span>{formatCurrency(periodoData.resumen.impuesto)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                      <span>Líquido chofer</span>
                      <span>{formatCurrency(periodoData.resumen.liquidoChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Efectivo recibido en ruta</span>
                      <span>{formatCurrency(periodoData.resumen.totalEfectivo)}</span>
                    </div>
                    <div className={`flex justify-between font-bold text-base ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      <span>{periodoData.resumen.saldoChofer >= 0 ? "Te deben" : "Debés"}</span>
                      <span>{formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Pago por porcentaje</p>
                  <div className="rounded border p-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Ventas</span>
                      <span>{formatCurrency(periodoData.resumen.totalVentas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>- Gastos</span>
                      <span>{formatCurrency(periodoData.resumen.totalGastos)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Utilidad bruta</span>
                      <span>{formatCurrency(periodoData.resumen.utilidadBruta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pago chofer ({periodoData.config.porcentajeComisionChofer}%)</span>
                      <strong>{formatCurrency(periodoData.resumen.pagoChofer)}</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Gastos reembolsables</span>
                      <span>{formatCurrency(periodoData.resumen.gastosChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Impuesto</span>
                      <span>{formatCurrency(periodoData.resumen.impuesto)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                      <span>Líquido chofer</span>
                      <span>{formatCurrency(periodoData.resumen.liquidoChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Efectivo recibido</span>
                      <span>{formatCurrency(periodoData.resumen.totalEfectivo)}</span>
                    </div>
                    <div className={`flex justify-between font-bold text-base ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      <span>{periodoData.resumen.saldoChofer >= 0 ? "Te deben" : "Debés"}</span>
                      <span>{formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen financiero */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen financiero del período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Ventas</p>
                  <p className="font-bold">{formatCurrency(periodoData.resumen.totalVentas)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Litros</p>
                  <p className="font-bold">{formatNumber(periodoData.resumen.totalLitros, 0)} L</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="font-bold">{formatCurrency(periodoData.resumen.totalEfectivo)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Transferencia</p>
                  <p className="font-bold">{formatCurrency(periodoData.resumen.totalTransferencia)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vueltas del período */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Vueltas ({periodoData.vueltas?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {periodoData.vueltas && periodoData.vueltas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">#</th>
                        <th className="p-2">Inicio</th>
                        <th className="p-2">Cierre</th>
                        <th className="p-2">Camión</th>
                        <th className="p-2">Entregas</th>
                        <th className="p-2">Litros</th>
                        <th className="p-2">Ventas</th>
                        <th className="p-2">¿Válida?</th>
                        <th className="p-2">Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodoData.vueltas.map((v: any) => (
                        <tr key={v.id} className="border-b last:border-0">
                          <td className="p-2">{v.numero}</td>
                          <td className="p-2 whitespace-nowrap">{formatDateTime(v.iniciadaEn)}</td>
                          <td className="p-2 whitespace-nowrap">{v.cerradaEn ? formatDateTime(v.cerradaEn) : "En curso"}</td>
                          <td className="p-2">{v.camion}</td>
                          <td className="p-2">{v.cantidadEntregas}</td>
                          <td className="p-2">{formatNumber(v.litros, 0)} L</td>
                          <td className="p-2">{formatCurrency(v.ventas)}</td>
                          <td className="p-2">
                            {v.completada
                              ? <span className="text-emerald-600 font-medium">Sí</span>
                              : <span className="text-amber-600">No</span>}
                          </td>
                          <td className="p-2 font-medium">{formatCurrency(v.pagoVuelta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin vueltas en este período.</p>
              )}
            </CardContent>
          </Card>

          {/* Gastos del período */}
          {periodoData.gastos && periodoData.gastos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Gastos del período ({periodoData.gastos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Descripción</th>
                        <th className="p-2">Monto</th>
                        <th className="p-2">Pagado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodoData.gastos.map((g: any) => (
                        <tr key={g.id} className="border-b last:border-0">
                          <td className="p-2 whitespace-nowrap">{formatDateTime(g.fecha)}</td>
                          <td className="p-2">{labelTipoGasto(g.tipo)}</td>
                          <td className="p-2">{g.descripcion || "—"}</td>
                          <td className="p-2">{formatCurrency(g.monto)}</td>
                          <td className="p-2">{g.pagadoPor === "chofer" ? "Chofer" : "Dueño"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

'''

# Reemplazar líneas 232-763 (índices 231-762)
new_lines = lines[:231] + [new_return] + lines[763:]

with open(path, "w") as f:
    f.writelines(new_lines)

print("OK - return simplificado")
