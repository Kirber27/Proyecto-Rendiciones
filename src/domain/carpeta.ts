// Carpetas por persona (porta carpetaItems, itemCard, carpeta y vMias del prototipo).
// Diferencia con el prototipo: el estado actual sale del estado guardado de la rendición y del
// cálculo de pagos (no de recorrer eventos), y los eventos se ordenan por fecha.
import type { EstadoPagoRendicion } from '@/types/pagos'
import type { EstadoRendicion, EventoRendicion } from '@/types/rendicion'
import { clp, norm } from './formato'

export interface RendicionCarpeta {
  id: string
  /** Folio del libro (DHE-042); null mientras no se aprueba. */
  folio: string | null
  nro: number
  fecha: string
  total: number
  estado: EstadoRendicion
  aprobacionAnulada: boolean
  origen: 'App' | 'Histórico'
  respaldos: number
  /** Motivo de observación o rechazo (lo ve la persona). */
  notaTesoreria: string | null
  eventos: readonly EventoRendicion[]
}

export const GRUPOS_CARPETA = [
  'En revisión',
  'Observadas o rechazadas',
  'Por pagar',
  'Pagadas',
  'Eliminadas',
  'Otras',
] as const
export type GrupoCarpeta = (typeof GRUPOS_CARPETA)[number]

export interface ItemCarpeta {
  id: string
  /** Folio o "Envío 042" si aún no tiene folio. */
  etiqueta: string
  nro: number
  fecha: string
  total: number
  respaldos: number
  /** Estado que se muestra en el chip. */
  actual: string
  grupo: GrupoCarpeta
  /** Línea de tiempo: eventos guardados + estado de pago calculado. */
  eventos: EventoRendicion[]
  /** Observada: la persona puede corregir y reenviar. */
  puedeCorregir: boolean
  notaTesoreria: string | null
}

/** Estado que se muestra (chip) según el estado guardado y el pago. */
export function estadoActual(
  r: Pick<RendicionCarpeta, 'estado' | 'aprobacionAnulada' | 'origen' | 'eventos'>,
  pago?: EstadoPagoRendicion,
): string {
  switch (r.estado) {
    case 'eliminada':
      return 'Eliminada'
    case 'rechazada':
      return 'Rechazada'
    case 'observada':
      return 'Observada'
    case 'en_revision': {
      if (r.aprobacionAnulada) return 'Aprobación anulada'
      const ultimo = ordenarEventos(r.eventos).at(-1)
      return ultimo?.evento === 'Reenviada' ? 'Reenviada' : 'En revisión'
    }
    case 'aprobada':
      if (!pago || pago.estado === 'Sin monto')
        return r.origen === 'Histórico' ? 'Ingresada (historial)' : 'Aprobada'
      return pago.estado
  }
}

const GRUPO: Record<string, GrupoCarpeta> = {
  'En revisión': 'En revisión',
  Reenviada: 'En revisión',
  'Aprobación anulada': 'En revisión',
  Observada: 'Observadas o rechazadas',
  Rechazada: 'Observadas o rechazadas',
  'Pendiente de pago': 'Por pagar',
  'Pago parcial': 'Por pagar',
  Pagada: 'Pagadas',
  Eliminada: 'Eliminadas',
}

export const grupoDe = (actual: string): GrupoCarpeta => GRUPO[actual] ?? 'Otras'

/** Eventos por fecha (los sin fecha al final, en su orden original). */
export function ordenarEventos(eventos: readonly EventoRendicion[]): EventoRendicion[] {
  return eventos
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (!a.e.fecha !== !b.e.fecha) return a.e.fecha ? -1 : 1
      return a.e.fecha.localeCompare(b.e.fecha) || a.i - b.i
    })
    .map(({ e }) => e)
}

/** Evento de pago calculado para la línea de tiempo de una rendición aprobada. */
export function eventoDePago(pago: EstadoPagoRendicion): EventoRendicion | null {
  switch (pago.estado) {
    case 'Pagada':
      return { evento: 'Pagada', fecha: pago.ultimo, nota: `Pagado ${clp(pago.pagado)}` }
    case 'Pago parcial':
      return {
        evento: 'Pago parcial',
        fecha: pago.ultimo,
        nota: `Pagado ${clp(pago.pagado)} · falta ${clp(pago.saldo)}`,
      }
    case 'Pendiente de pago':
      return { evento: 'Pendiente de pago', fecha: '', nota: `Falta ${clp(pago.saldo)}` }
    default:
      return null
  }
}

/** Ítems de una carpeta, de la rendición más reciente a la más antigua. */
export function itemsCarpeta(
  rendiciones: readonly RendicionCarpeta[],
  pagos: ReadonlyMap<string, EstadoPagoRendicion>,
): ItemCarpeta[] {
  return rendiciones
    .map((r) => {
      const pago = r.estado === 'aprobada' ? pagos.get(r.id) : undefined
      const eventos = ordenarEventos(r.eventos)
      const ePago = pago && eventoDePago(pago)
      if (ePago) eventos.push(ePago)
      const actual = estadoActual(r, pago)
      return {
        id: r.id,
        etiqueta: r.folio ?? `Envío ${String(r.nro).padStart(3, '0')}`,
        nro: r.nro,
        fecha: r.fecha,
        total: r.total,
        respaldos: r.respaldos,
        actual,
        grupo: grupoDe(actual),
        eventos,
        puedeCorregir: r.estado === 'observada',
        notaTesoreria: r.notaTesoreria,
      }
    })
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.nro - a.nro)
}

/** Cantidad por grupo y grupos a mostrar como filtros (Eliminadas y Otras solo si hay). */
export function gruposDeCarpeta(items: readonly ItemCarpeta[]) {
  const conteo = new Map<GrupoCarpeta, number>(GRUPOS_CARPETA.map((g) => [g, 0]))
  for (const it of items) conteo.set(it.grupo, conteo.get(it.grupo)! + 1)
  const visibles = GRUPOS_CARPETA.filter(
    (g) => (g !== 'Eliminadas' && g !== 'Otras') || conteo.get(g)! > 0,
  )
  return visibles.map((g) => ({ grupo: g, cantidad: conteo.get(g)! }))
}

/** Filtro por casillas: sin selección = todas. */
export function filtrarCarpeta(
  items: readonly ItemCarpeta[],
  seleccion: ReadonlySet<GrupoCarpeta>,
) {
  return seleccion.size ? items.filter((it) => seleccion.has(it.grupo)) : items.slice()
}

// ---------- Índice de carpetas (tesorería) ----------

export interface CarpetaPersona {
  personaId: string
  nombre: string
  rendiciones: number
  porAprobar: number
  saldo: number
}

/** Orden del índice: más por aprobar, luego más rendiciones, luego nombre. Filtra por búsqueda. */
export function ordenarCarpetas(
  carpetas: readonly CarpetaPersona[],
  busqueda = '',
): CarpetaPersona[] {
  const q = norm(busqueda)
  return carpetas
    .filter((c) => !q || norm(c.nombre).includes(q))
    .sort(
      (a, b) =>
        b.porAprobar - a.porAprobar ||
        b.rendiciones - a.rendiciones ||
        norm(a.nombre).localeCompare(norm(b.nombre)),
    )
}
