/** Tipos de pago (enum `tipo_pago` de la base). */
export const TIPOS_PAGO = [
  'Pago',
  'Anticipo',
  'No genera pago',
  'Devolución de la persona',
] as const
export type TipoPago = (typeof TIPOS_PAGO)[number]

/** Lo que el cálculo de pagos necesita de una rendición aprobada del libro. */
export interface RendicionParaPago {
  id: string
  /** Clave de la persona (persona_id en la base). */
  personaId: string
  nro: number
  fecha: string
  total: number
}

/** Lo que el cálculo de pagos necesita de un pago. */
export interface PagoParaAsignar {
  id: string
  personaId: string
  /** YYYY-MM-DD; puede venir vacío en el historial. */
  fecha: string
  /** Negativo en devoluciones de la persona. */
  monto: number
  tipo: TipoPago
  /** Rendiciones a las que se vinculó explícitamente (pago_rendiciones). */
  rendicionIds: readonly string[]
}

export type EstadoPago = 'Sin monto' | 'Pagada' | 'Pago parcial' | 'Pendiente de pago'

export interface EstadoPagoRendicion {
  pagado: number
  saldo: number
  estado: EstadoPago
  /** Fecha del último pago que le aportó (YYYY-MM-DD) o "" si no se conoce. */
  ultimo: string
}

export interface CuentaPersona {
  personaId: string
  /** Total de sus rendiciones aprobadas. */
  rendido: number
  /** Suma de todos sus pagos (anticipos incluidos; devoluciones restan). */
  pagado: number
  /** rendido − pagado. Positivo: la empresa le debe. Negativo: tiene fondos por rendir. */
  saldo: number
  anticipos: number
  /** Cantidad de rendiciones. */
  n: number
  /** Nº de rendición más alto. */
  max: number
  /** Números de 1..max que no aparecen en sus rendiciones. */
  faltantes: number[]
}
