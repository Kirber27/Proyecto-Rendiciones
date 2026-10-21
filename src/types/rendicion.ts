/** Tipos de documento (enum `tipo_documento` de la base). */
export const TIPOS_DOCUMENTO = [
  'Factura',
  'Boleta',
  'Boleta de honorarios',
  'Transferencia',
] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

/** Estado guardado de una rendición (enum `estado_rendicion` de la base). */
export const ESTADOS_RENDICION = [
  'en_revision',
  'observada',
  'rechazada',
  'aprobada',
  'eliminada',
] as const
export type EstadoRendicion = (typeof ESTADOS_RENDICION)[number]

/** Evento de la línea de tiempo (fila de `rendicion_eventos`). */
export interface EventoRendicion {
  /** Enviada, Reenviada, Aprobada, Observada, Rechazada, Aprobación anulada, Eliminada, … */
  evento: string
  nota: string | null
  /** Fecha/hora ISO o YYYY-MM-DD; "" si no se conoce. */
  fecha: string
}

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

/** Línea de gasto mientras se edita (montos como texto; catálogos por id). */
export interface LineaBorrador extends MontosLinea {
  fecha: string
  tipo: TipoDocumento
  proveedor: string
  rut: string
  numero: string
  detalle: string
  subcuentaId: number | null
  cuentaId: number | null
  centroCostoId: number | null
}

/** Rendición mientras se edita: la arma la lectura IA y la corrige la persona o tesorería. */
export interface BorradorRendicion {
  /** Id de la rendición si ya existe (reenvío, aprobación o edición en el libro). */
  id?: string
  personaId: string | null
  nro: string
  fecha: string
  empresaId: number | null
  fondo: string
  totalFormulario: string
  lineas: LineaBorrador[]
  /** Avisos de la lectura IA para que la persona revise. */
  dudas: string[]
  /** Cantidad de documentos que la IA encontró en las fotos. */
  documentosLeidos?: number
  /** Rutas en Storage de los respaldos ya guardados. */
  respaldos: string[]
}

/** Línea lista para la base (columnas de `rendicion_lineas`). */
export interface LineaPayload {
  orden: number
  fecha: string
  tipo: TipoDocumento
  proveedor: string
  rut: string
  numero: string
  neto: number
  iva: number
  exento: number
  otros: number
  detalle: string
  subcuenta_id: number | null
  cuenta_id: number | null
  centro_costo_id: number | null
}

/** Rendición lista para las RPC `enviar_rendicion` / `aprobar_rendicion` / `editar_rendicion`. */
export interface RendicionPayload {
  id?: string
  persona_id: string
  nro: number
  fecha: string
  empresa_id: number | null
  fondo: string
  total_formulario: number | null
  lineas: LineaPayload[]
}

/** Modo del editor: persona (Rendir gastos), aprobar (Por aprobar), libro (edición en el libro). */
export type ModoEditor = 'persona' | 'aprobar' | 'libro'

/** Foto de respaldo para mostrar: URL local (blob:) o firmada de Storage. */
export interface Respaldo {
  url: string
  /** Si se puede quitar (fotos nuevas aún no enviadas). */
  quitable?: boolean
}
