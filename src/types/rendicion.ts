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
  /** Proveedor elegido de la lista (null en líneas del historial o aún sin elegir). */
  proveedorId: string | null
  /** Nombre y RUT como se rindieron (al elegir, los del proveedor). */
  proveedor: string
  rut: string
  numero: string
  /**
   * El Nº de documento ya está cargado para este proveedor en otra rendición (lo marca la consulta a
   * la base mientras se escribe; no se guarda).
   */
  numeroRepetido?: boolean
  detalle: string
  subcuentaId: number | null
  cuentaId: number | null
  centroCostoId: number | null
}

/** Rendición mientras se edita: la completa la persona y la corrige tesorería. */
export interface BorradorRendicion {
  /** Id de la rendición si ya existe (reenvío, aprobación o edición en el libro). */
  id?: string
  personaId: string | null
  nro: string
  /** El Nº es un faltante del correlativo elegido en el formulario (no el Nº por defecto). */
  nroFaltante?: boolean
  fecha: string
  empresaId: number | null
  fondo: string
  totalFormulario: string
  lineas: LineaBorrador[]
  /** Rutas en Storage de los respaldos ya guardados. */
  respaldos: string[]
}

/** Línea lista para la base (columnas de `rendicion_lineas`). */
export interface LineaPayload {
  orden: number
  fecha: string
  tipo: TipoDocumento
  proveedor_id: string | null
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
  /** Faltante del correlativo elegido: el servidor lo usa si sigue libre (si no, asigna el Nº). */
  nro_faltante?: number
  fecha: string
  empresa_id: number | null
  fondo: string
  total_formulario: number | null
  lineas: LineaPayload[]
}

/** Modo del editor: persona (Rendir gastos), aprobar (Por aprobar), libro (edición en el libro). */
export type ModoEditor = 'persona' | 'aprobar' | 'libro'

/** Un respaldo es una foto o un PDF. */
export type TipoRespaldo = 'imagen' | 'pdf'

/** Respaldo para mostrar: URL local (blob:) o firmada de Storage. */
export interface Respaldo {
  url: string
  tipo: TipoRespaldo
  /** Nombre del archivo (se muestra en la ficha de los PDF). */
  nombre?: string
  /** Si se puede quitar (adjuntos aún no enviados). */
  quitable?: boolean
}

/** Respaldo guardado en Storage, con su URL firmada. */
export interface RespaldoGuardado {
  path: string
  url: string
  tipo: TipoRespaldo
}
