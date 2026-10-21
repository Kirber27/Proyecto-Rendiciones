/** Tipos de documento (enum `tipo_documento` de la base). */
export const TIPOS_DOCUMENTO = ['Factura', 'Boleta', 'Boleta de honorarios', 'Transferencia'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

/** Un monto puede venir como texto mientras se edita ("70.389") o como número desde la base. */
export type Monto = number | string | null | undefined

/** Montos de una línea de gasto. Total = neto + iva + exento + otros. */
export interface MontosLinea {
  neto?: Monto
  iva?: Monto
  exento?: Monto
  otros?: Monto
}

/** Lo mínimo para sumar una rendición: total guardado o sus líneas. */
export interface ConLineas {
  total?: number | null
  lineas?: readonly MontosLinea[] | null
}
