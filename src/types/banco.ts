/** Movimiento de una cartola bancaria (fila de `cartola_movimientos`). */
export interface MovimientoCartola {
  /** YYYY-MM-DD */
  fecha: string
  /** Glosa del banco (máx. 140 caracteres). */
  descripcion: string
  /** Nº de operación o documento (máx. 40 caracteres). */
  referencia: string
  /** Cargo (salida de dinero), siempre positivo. */
  cargo: number
  /** Abono (entrada de dinero), siempre positivo. */
  abono: number
}

/** Columnas que se mapean desde el archivo del banco. */
export const CAMPOS_CARTOLA = [
  'fecha',
  'descripcion',
  'cargo',
  'abono',
  'monto',
  'referencia',
] as const
export type CampoCartola = (typeof CAMPOS_CARTOLA)[number]

/** Índice de columna por campo; -1 = el archivo no la tiene. */
export type MapeoCartola = Record<CampoCartola, number>

/** Movimiento ya guardado en la base. */
export interface MovimientoGuardado extends MovimientoCartola {
  id: string
  cartolaId: string
  /** Posición en el archivo. */
  idx: number
  /** "No es de rendiciones". */
  ignorado: boolean
}

export interface CartolaGuardada {
  id: string
  nombreArchivo: string
  medioPagoId: number | null
  creadoEn: string
}

/** Una asignación de un cargo (payload de `confirmar_conciliacion`). */
export type AsignacionCargo =
  | { movimientoId: string; tipo: 'pago'; pagoId: string }
  | { movimientoId: string; tipo: 'rendiciones'; rendicionIds: string[] }
  | { movimientoId: string; tipo: 'anticipo'; personaId: string }
