// De la respuesta de la IA a un borrador editable (porta el mapeo de leer() del prototipo).
// El prompt y la forma de la respuesta están en supabase/functions/_shared/lectura.ts.
import type { CodigoErrorLectura, RespuestaLectura } from '@shared/lectura'
import type { Catalogos } from '@/types/catalogos'
import { TIPOS_DOCUMENTO, type BorradorRendicion, type Monto } from '@/types/rendicion'
import { cuentaSugerida } from './catalogos'
import { miles, norm, num, parseDate, tr } from './formato'
import { lineaVacia } from './rendicion'

/** Empresa por defecto si la lectura no reconoce ninguna (como el prototipo: EMP[1]). */
export const EMPRESA_POR_DEFECTO = 'Hecaglobal Instruments SPA'

export interface ContextoLectura {
  catalogos: Catalogos
  /** Persona vinculada que no es tesorería: el solicitante queda fijo en ella. */
  personaFija?: string | null
  /** Fecha a usar si la lectura no trae una (YYYY-MM-DD). */
  hoy: string
  /** Id de la rendición, si se está volviendo a leer un borrador existente. */
  id?: string
  /** Respaldos ya guardados (reenvío). */
  respaldos?: string[]
}

/** Monto leído → texto para el editor ("70.389"); 0 o vacío → "". */
export function montoATexto(v: Monto): string {
  const n = num(v)
  if (!n) return ''
  return Number.isInteger(n) ? (n < 0 ? '-' : '') + miles(n) : String(n).replace('.', ',')
}

function porNombre<T extends { nombre: string }>(lista: readonly T[], v: string): T | undefined {
  const k = norm(v)
  return k ? lista.find((x) => norm(x.nombre) === k) : undefined
}

export function aBorrador(j: RespuestaLectura, ctx: ContextoLectura): BorradorRendicion {
  const { catalogos } = ctx
  const empresa =
    porNombre(catalogos.empresas, j.empresa) ??
    porNombre(catalogos.empresas, EMPRESA_POR_DEFECTO) ??
    catalogos.empresas[0]
  const persona = porNombre(catalogos.personas, j.solicitante)
  const personaId = ctx.personaFija ?? persona?.id ?? null
  const fechaForm = parseDate(j.fecha) || ctx.hoy

  const dudas = [...j.dudas]
  if (!personaId) {
    const leido = tr(j.solicitante)
    dudas.push(
      leido
        ? `El solicitante leído ("${leido}") no está en la lista: elígelo antes de enviar.`
        : 'No se pudo leer el solicitante: elígelo antes de enviar.',
    )
  }

  const lineas = j.lineas.map((l) => {
    const sub = porNombre(catalogos.subcuentas, l.subcuenta)
    return lineaVacia({
      fecha: parseDate(l.fecha) || parseDate(j.fecha) || '',
      tipo: TIPOS_DOCUMENTO.find((t) => norm(t) === norm(l.tipo)) ?? 'Boleta',
      proveedor: tr(l.proveedor),
      rut: tr(l.rut),
      numero: tr(l.numero).replace(/[^\w\-/]/g, ''),
      neto: montoATexto(l.neto),
      iva: montoATexto(l.iva),
      exento: montoATexto(l.exento),
      detalle: tr(l.detalle),
      subcuentaId: sub?.id ?? null,
      cuentaId: cuentaSugerida(sub?.id ?? null, catalogos.subcuentas),
      centroCostoId: empresa?.centroCostoId ?? null,
    })
  })

  return {
    ...(ctx.id ? { id: ctx.id } : {}),
    personaId,
    nro: j.nro != null ? String(j.nro).replace(/\D/g, '') : '',
    fecha: fechaForm,
    empresaId: empresa?.id ?? null,
    fondo: tr(j.fondo),
    totalFormulario: j.totalFormulario != null ? montoATexto(j.totalFormulario) : '',
    lineas: lineas.length
      ? lineas
      : [lineaVacia({ fecha: fechaForm, centroCostoId: empresa?.centroCostoId ?? null })],
    dudas,
    documentosLeidos: j.documentos ? j.documentos.length : undefined,
    respaldos: ctx.respaldos ?? [],
  }
}

/** Mensaje para la persona según el código de error de la lectura. */
export function mensajeErrorLectura(codigo: CodigoErrorLectura | string): {
  tipo: 'info' | 'warning' | 'danger'
  texto: string
} {
  switch (codigo) {
    case 'cancelled':
      return { tipo: 'info', texto: 'Lectura detenida.' }
    case 'rate_limited':
      return {
        tipo: 'warning',
        texto: 'Se alcanzó el límite de lecturas por ahora. Intenta de nuevo más tarde.',
      }
    case 'image_rejected':
      return {
        tipo: 'danger',
        texto: 'Una de las fotos no se pudo abrir. Prueba con otra foto en JPG.',
      }
    case 'invalid_json':
      return {
        tipo: 'danger',
        texto:
          'No se pudieron ordenar los datos de estas fotos. Saca fotos más nítidas, con el formulario completo, e intenta de nuevo.',
      }
    case 'unauthorized':
      return { tipo: 'warning', texto: 'Tu sesión expiró. Vuelve a ingresar e intenta de nuevo.' }
    default:
      return { tipo: 'danger', texto: 'No se pudo leer la rendición. Intenta de nuevo.' }
  }
}
