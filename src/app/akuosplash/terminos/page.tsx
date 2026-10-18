"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Printer, ChevronRight } from "lucide-react";
import Link from "next/link";

// Términos y Condiciones de AkuoSplash
// Operador: Akuologistic SpA
// Marca/Product: AkuoSplash

export default function TerminosPage() {
  const [expandedSection, setExpandedSection] = useState<number | null>(1);
  const hoy = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  function toggleSection(n: number) {
    setExpandedSection(expandedSection === n ? null : n);
  }

  const sections = [
    {
      n: 1,
      title: "Aspectos Generales y Definición de Roles",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">1.1. Identificación del Operador</h3>
          <p>La plataforma AkuoSplash es operada por <strong>Akuologistic SpA</strong>, Sociedad por Acciones constituida en Chile. AkuoSplash es la marca y producto comercial de Akuologistic SpA. Toda referencia a "la Plataforma", "nosotros" o "AkuoSplash" se refiere a Akuologistic SpA.</p>
          <p>Contacto: <a href="mailto:contacto@akuosplash.cl" className="text-blue-600 underline">contacto@akuosplash.cl</a></p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">1.2. Definiciones</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>Plataforma / AkuoSplash</strong>: aplicación operada por Akuologistic SpA que combina un marketplace de agua potable y una herramienta de productividad para transportistas.</li>
            <li><strong>Marketplace</strong>: servicio donde los clientes piden agua y los transportistas ofrecen servicios de reparto.</li>
            <li><strong>Herramienta de Productividad</strong>: funciones de gestión de negocio para transportistas (clientes, vueltas, entregas, gastos, liquidación, vehículos, choferes).</li>
            <li><strong>Transportista / Vendedor</strong>: empresa de reparto de agua con camión aljibe registrada en AkuoSplash.</li>
            <li><strong>Cliente / Comprador</strong>: persona natural o jurídica que pide agua vía marketplace.</li>
            <li><strong>Chofer</strong>: persona natural contratada por el transportista para conducir y entregar.</li>
            <li><strong>Plan</strong>: tipo de subscripción (Gratis, Premium o Pro).</li>
            <li><strong>Cupón</strong>: código de descuento aplicable a ventas o subscripciones.</li>
            <li><strong>Precio Dinámico</strong>: motor que calcula el precio según factores en tiempo real.</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">1.3. Naturaleza del Servicio</h3>
          <p>AkuoSplash combina:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Marketplace intermediario</strong>: facilita la conexión entre transportistas y clientes. <strong>El contrato de compraventa se celebra directamente entre el transportista y el cliente</strong>. Akuologistic SpA no es vendedor del agua; provee tecnología, gestiona el pago vía MercadoPago y retiene la comisión.</li>
            <li><strong>Herramienta de productividad</strong>: permite a los transportistas gestionar su negocio (clientes propios, vueltas, entregas, gastos, vehículos, choferes, facturación).</li>
          </ol>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">1.4. Elegibilidad</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Mayor de 18 años.</li>
            <li>Clientes: persona natural o jurídica con RUT chileno, dentro de zona de cobertura.</li>
            <li>Transportistas: persona jurídica con RUT y razón social, registrar chofer y vehículo.</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">1.5. Aceptación</h3>
          <p>Al registrarse, el usuario acepta íntegramente estos Términos. El uso continuado después de modificaciones constituye aceptación de los términos actualizados.</p>
        </>
      ),
    },
    {
      n: 2,
      title: "Para los Vendedores (Transportistas)",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.1. Planes y Comisiones</h3>
          <p>AkuoSplash ofrece planes de subscripción (Gratis, Premium, Pro) que determinan el nivel de acceso a funciones de productividad, la comisión por venta, la modalidad de cobro y funcionalidades adicionales como facturación electrónica vía Wasabil.</p>
          <p><strong>Los precios, comisiones y modalidades específicas son definidos por Akuologistic SpA y pueden modificarse en cualquier momento.</strong> Los valores vigentes se publican en la aplicación. La subscripción es recurrente vía MercadoPago.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.2. Proceso de Pago</h3>
          <p>El cliente paga con tarjeta vía MercadoPago. MP ejecuta el split: envía al transportista el monto neto y retiene la comisión a la Plataforma. El tiempo de liberación depende del plan (inmediato, diferido, o sin split con subida manual de facturas).</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.3. Herramienta de Productividad</h3>
          <p>Funciones disponibles según el plan:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Clientes propios, vueltas, entregas con lectura de medidor</li>
            <li>Gastos operativos, liquidación de pagos</li>
            <li>Pedidos recurrentes, vehículos, choferes, equipo</li>
            <li>Historial y métricas de productividad</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.4. Obligaciones Tributarias</h3>
          <p>El transportista es responsable de emitir documentos tributarios ante el SII. El Plan Pro incluye Wasabil para facturación automática.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.5. Productos Prohibidos</h3>
          <p>Solo agua potable para consumo humano, piscina, riego u otros usos legítimos. Prohibido vender agua contaminada o usar el marketplace para otros servicios.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.6. Vehículos y Choferes</h3>
          <p>Debe registrar vehículo (patente, capacidad, fotos, documentos) y chofer (RUT, licencia). Responsable de la vigencia de todos los documentos.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">2.7. Suspensión y Cancelación</h3>
          <p>Akuologistic puede suspender cuentas por incumplimiento. El transportista puede cancelar su subscripción en cualquier momento; el plan sigue activo hasta el vencimiento.</p>
        </>
      ),
    },
    {
      n: 3,
      title: "Para los Compradores (Clientes)",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">3.1. Proceso de Compra</h3>
          <p>El cliente selecciona litros, dirección y paga con tarjeta vía MercadoPago. El precio se calcula con el motor de precio dinámico (sección 5) e incluye IVA (19%). Una vez pagado, no hay modificaciones retroactivas.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">3.2. Código de Confirmación</h3>
          <p>El cliente recibe un código de 4 dígitos que debe entregar al chofer para validar la entrega.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">3.3. Cancelaciones y Reembolsos</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Antes de la entrega: cancelación con reembolso del 100%.</li>
            <li>Después de la entrega: derecho de retracto según Ley 21.398 Ómnibus (10 días).</li>
            <li>Si el transportista no entrega: reembolso completo + disputa.</li>
            <li>Si el agua no es potable: reembolso + disputa.</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">3.4. Datos de Pago</h3>
          <p>El cliente ingresa su tarjeta en MercadoPago (tokenizada). Akuologistic no almacena datos de tarjetas.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">3.5. Cupones</h3>
          <p>El cliente puede usar cupones válidos con restricciones (vigencia, monto mínimo, uso único).</p>
        </>
      ),
    },
    {
      n: 4,
      title: "Resolución de Disputas",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">4.1. Garantía de AkuoSplash</h3>
          <p>Si el transportista no entrega o el agua no es potable, Akuologistic reembolsa al cliente y luego cobra al transportista.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">4.2. Canal de Disputas</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Cliente contacta al transportista vía chat de la app.</li>
            <li>Si no se resuelve en 48 horas, abre un ticket de disputa.</li>
            <li>Akuologistic media y resuelve en hasta 7 días hábiles.</li>
            <li>Si no satisface, escalable a SERNAC o tribunales.</li>
          </ol>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">4.3. Jurisdicción</h3>
          <p>Tribunales de Santiago de Chile, legislación chilena.</p>
        </>
      ),
    },
    {
      n: 5,
      title: "Precio Dinámico",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">5.1. Definición</h3>
          <p>El precio del agua se calcula automáticamente según factores en tiempo real. El precio mostrado al confirmar es el resultado del motor en ese momento.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">5.2. Factores</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Zona geográfica (precio base por litro)</li>
            <li>Volumen (descuentos por cantidad)</li>
            <li>Método de pago, urgencia, horario, día de la semana</li>
            <li>Distancia al depot (opcional), historial de pago, frecuencia</li>
            <li>Disponibilidad de repartidores, demanda/oferta (surge pricing)</li>
            <li>Clima (opcional), capacidad del camión</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">5.3. Snapshot del Precio</h3>
          <p>El precio mostrado es válido por un tiempo limitado. Si el cliente no paga a tiempo, debe volver a consultar.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">5.4. Ajustabilidad</h3>
          <p>Akuologistic puede modificar las reglas y parámetros del motor en cualquier momento. El cliente acepta que el precio puede variar entre consultas.</p>
        </>
      ),
    },
    {
      n: 6,
      title: "Limitación de Responsabilidad",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">6.1. Exclusión de Garantías</h3>
          <p>Akuologistic SpA no se hace responsable por:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Fallas técnicas intermitentes de la plataforma o MercadoPago.</li>
            <li>Stock desactualizado de los transportistas.</li>
            <li>Descripciones engañosas de los transportistas.</li>
            <li>Calidad del agua (responsabilidad del transportista según MINSAL).</li>
            <li>Accidentes o daños causados por el chofer.</li>
            <li>Errores en el cálculo del precio dinámico por datos incorrectos.</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">6.2. Modificación de los T&C</h3>
          <p>Akuologistic puede modificar estos Términos en cualquier momento, notificando vía email y aviso al iniciar sesión. El uso continuado implica aceptación.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">6.3. Suspensión de Cuentas</h3>
          <p>Akuologistic puede suspender o cerrar cuentas por incumplimiento de los T&C, fraude, pedidos falsos, documentos vencidos o falsos, múltiples quejas, o uso para actividades ilegales.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">6.4. Protección de Datos</h3>
          <p>Akuologistic cumple con la Ley 19.628. Los datos se usan para operar el servicio y mejorar el servicio. No se venden a terceros, excepto cuando sea necesario para operar (MercadoPago, Wasabil) o por requerimiento legal.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">6.5. Propiedad Intelectual</h3>
          <p>AkuoSplash, su código, diseño, logos y marcas son propiedad de Akuologistic SpA. Prohibido copiar, modificar o usar sin autorización.</p>
        </>
      ),
    },
    {
      n: 7,
      title: "Disposiciones Finales",
      content: (
        <>
          <h3 className="font-semibold text-gray-900 mt-3 mb-1">7.1. Leyes Aplicables</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Ley 19.496 (SERNAC) y Ley 21.398 (Ómnibus)</li>
            <li>Normativa SII (IVA 19%, facturación electrónica)</li>
            <li>Código de Comercio de Chile</li>
            <li>Ley 19.628 (Protección de Datos Personales)</li>
            <li>Normativa MINSAL (potabilidad del agua)</li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">7.2. Jurisdicción</h3>
          <p>Tribunales de Santiago de Chile.</p>

          <h3 className="font-semibold text-gray-900 mt-3 mb-1">7.3. Contacto</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Email: <a href="mailto:contacto@akuosplash.cl" className="text-blue-600 underline">contacto@akuosplash.cl</a></li>
            <li>Sitio: <a href="https://akuosplash.cl" className="text-blue-600 underline">https://akuosplash.cl</a></li>
            <li>Razón social: Akuologistic SpA</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        {/* Header */}
        <div className="text-center mb-8 print:mb-4">
          <h1 className="text-3xl font-bold text-gray-900 print:text-2xl">Términos y Condiciones de AkuoSplash</h1>
          <p className="text-sm text-gray-600 mt-2">
            Operado por <strong>Akuologistic SpA</strong> · Última actualización: {hoy} · Versión 1.0
          </p>
        </div>

        {/* Botones — no visibles en print */}
        <div className="flex gap-2 justify-center mb-6 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-1" /> Descargar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Link href="/akuosplash">
            <Button variant="ghost" size="sm">
              Volver a AkuoSplash
            </Button>
          </Link>
        </div>

        {/* Intro */}
        <Card className="mb-6 print:shadow-none print:border-0">
          <CardContent className="p-4 text-sm text-gray-700">
            <p>Bienvenido a <strong>AkuoSplash</strong>, operado por <strong>Akuologistic SpA</strong>. Combina un marketplace de reparto de agua potable y una herramienta de productividad para gestión de negocios de reparto en Chile.</p>
            <p className="mt-2">Al registrarse y usar AkuoSplash, usted acepta íntegramente estos Términos y Condiciones.</p>
          </CardContent>
        </Card>

        {/* Tabla de contenidos */}
        <Card className="mb-6 print:shadow-none">
          <CardContent className="p-4">
            <p className="font-semibold text-sm mb-2">Tabla de contenidos</p>
            <ol className="space-y-1 text-sm">
              {sections.map(s => (
                <li key={s.n}>
                  <button onClick={() => toggleSection(s.n)} className="text-blue-600 hover:underline text-left flex items-center gap-1">
                    <ChevronRight className={`h-3 w-3 transition-transform ${expandedSection === s.n ? "rotate-90" : ""} print:hidden`} />
                    {s.n}. {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Secciones */}
        {sections.map(s => (
          <Card key={s.n} className={`mb-4 print:shadow-none print:border print:break-inside-avoid ${expandedSection === s.n ? "" : "hidden print:block"}`}>
            <CardContent className="p-4">
              <button onClick={() => toggleSection(s.n)} className="w-full text-left font-bold text-lg text-gray-900 flex items-center justify-between">
                <span>{s.n}. {s.title}</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${expandedSection === s.n ? "rotate-90" : ""} print:hidden`} />
              </button>
              <div className={`mt-3 text-sm leading-relaxed text-gray-700 space-y-2 ${expandedSection === s.n ? "block" : "hidden print:block"}`}>
                {s.content}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Aceptación */}
        <Card className="mb-6 print:shadow-none print:break-inside-avoid">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold mb-2">Aceptación de los Términos</p>
            <p>Al registrarme en AkuoSplash, declaro haber leído y aceptado íntegramente estos Términos y Condiciones, entiendo la naturaleza del servicio, y acepto que el contrato de compraventa de agua se celebra directamente con el transportista, no con Akuologistic SpA.</p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-gray-500">Nombre del usuario:</p>
                <p className="border-b border-gray-400 mt-1 h-5"></p>
              </div>
              <div>
                <p className="text-gray-500">Fecha de aceptación:</p>
                <p className="border-b border-gray-400 mt-1 h-5">{hoy}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Akuologistic SpA. Todos los derechos reservados.</p>
          <p className="mt-1">AkuoSplash es una marca de Akuologistic SpA.</p>
        </div>
      </div>
    </div>
  );
}
