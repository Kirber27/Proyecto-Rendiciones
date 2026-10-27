// Por aprobar (spec 03): bandeja de tesorería, carga de una rendición y decisiones (RPC de la migración 12).
import { montoATexto } from '@/domain/formato'
import { limpiarRendicion } from '@/domain/rendicion'
import { tipoRespaldo } from '@/domain/respaldos'
import type { Json, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type {
  BorradorRendicion,
  EventoRendicion,
  RespaldoGuardado,
  TipoDocumento,
} from '@/types/rendicion'
import { BUCKET_RESPALDOS } from './rendiciones'

export interface FilaBandeja {
  id: string
  personaId: string
  personaNombre: string
  personaCodigo: string
  nro: number
  fecha: string
  total: number
  totalFormulario: number | null
  enviadoEn: string | null
  editadoEn: string | null
  nLineas: number
  nRespaldos: number
  /** En revisión · Reenviada · Aprobación anulada */
  marca: 'En revisión' | 'Reenviada' | 'Aprobación anulada'
  /** Folio que tendría al aprobar (para avisar si ya existe). */
  folioPropuesto: string
}

export interface RendicionAbierta {
  borrador: BorradorRendicion
  /** editado_en al abrir: si la persona la reenvía entretanto, la base no deja pisarla. */
  version: string | null
  eventos: EventoRendicion[]
  respaldos: RespaldoGuardado[]
  notaTesoreria: string | null
}

const lanzar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export const folioPropuesto = (codigo: string, nro: number) =>
  `${codigo}-${String(nro).padStart(3, '0')}`

export function marcaBandeja(f: {
  aprobacion_anulada: boolean | null
  ultimo_evento: string | null
}) {
  if (f.aprobacion_anulada) return 'Aprobación anulada' as const
  if (f.ultimo_evento === 'Reenviada') return 'Reenviada' as const
  return 'En revisión' as const
}

/** Rendiciones en revisión, de la más antigua a la más nueva. */
export async function listarPorAprobar(): Promise<FilaBandeja[]> {
  const { data, error } = await supabase
    .from('v_rendiciones')
    .select(
      'id, persona_id, persona_nombre, persona_codigo, nro, fecha, total, total_formulario, enviado_en, editado_en, aprobacion_anulada, ultimo_evento, n_lineas, n_respaldos',
    )
    .eq('estado', 'en_revision')
    .order('enviado_en', { ascending: true })
  lanzar(error)
  return (data ?? []).map((f) => ({
    id: f.id!,
    personaId: f.persona_id!,
    personaNombre: f.persona_nombre ?? '',
    personaCodigo: f.persona_codigo ?? '',
    nro: f.nro ?? 0,
    fecha: f.fecha ?? '',
    total: Number(f.total ?? 0),
    totalFormulario: f.total_formulario == null ? null : Number(f.total_formulario),
    enviadoEn: f.enviado_en,
    editadoEn: f.editado_en,
    nLineas: f.n_lineas ?? 0,
    nRespaldos: f.n_respaldos ?? 0,
    marca: marcaBandeja(f),
    folioPropuesto: folioPropuesto(f.persona_codigo ?? '', f.nro ?? 0),
  }))
}

/** Folios que ya existen en el libro (de una lista de propuestos). */
export async function foliosExistentes(folios: string[]): Promise<Set<string>> {
  if (!folios.length) return new Set()
  const { data, error } = await supabase.from('rendiciones').select('folio').in('folio', folios)
  lanzar(error)
  return new Set((data ?? []).map((r) => r.folio!))
}

/** Cantidad en revisión (para el contador de la pestaña). */
export async function contarPorAprobar(): Promise<number> {
  const { count, error } = await supabase
    .from('rendiciones')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'en_revision')
  lanzar(error)
  return count ?? 0
}

/** Cantidad en revisión por persona (columna "Por aprobar" de Personas). */
export async function porAprobarPorPersona(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('rendiciones')
    .select('persona_id')
    .eq('estado', 'en_revision')
  lanzar(error)
  const mapa = new Map<string, number>()
  for (const r of data ?? []) mapa.set(r.persona_id, (mapa.get(r.persona_id) ?? 0) + 1)
  return mapa
}

type Linea = Tables<'rendicion_lineas'>
type Cabecera = Tables<'rendiciones'>

/** Filas de la base → borrador editable (montos como texto "70.389"). */
export function aBorradorDesdeBase(
  r: Cabecera,
  lineas: Linea[],
  respaldos: string[],
): BorradorRendicion {
  return {
    id: r.id,
    personaId: r.persona_id,
    nro: String(r.nro),
    fecha: r.fecha,
    empresaId: r.empresa_id,
    fondo: r.fondo,
    totalFormulario: r.total_formulario == null ? '' : montoATexto(Number(r.total_formulario)),
    lineas: lineas
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((l) => ({
        fecha: l.fecha ?? '',
        tipo: l.tipo as TipoDocumento,
        proveedor: l.proveedor,
        rut: l.rut,
        numero: l.numero,
        neto: montoATexto(Number(l.neto)),
        iva: montoATexto(Number(l.iva)),
        exento: montoATexto(Number(l.exento)),
        otros: montoATexto(Number(l.otros)),
        detalle: l.detalle,
        subcuentaId: l.subcuenta_id,
        cuentaId: l.cuenta_id,
        centroCostoId: l.centro_costo_id,
      })),
    respaldos,
  }
}

/** Respaldos con URL firmada (los que no la obtuvieron se omiten), en el orden de `paths`. */
export function respaldosGuardados(paths: string[], urls: Map<string, string>): RespaldoGuardado[] {
  return paths
    .filter((p) => urls.has(p))
    .map((p) => ({ path: p, url: urls.get(p)!, tipo: tipoRespaldo(p) }))
}

/** URLs firmadas (1 hora) para mostrar los respaldos del bucket privado. */
export async function urlsFirmadas(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map()
  const { data, error } = await supabase.storage
    .from(BUCKET_RESPALDOS)
    .createSignedUrls(paths, 3600)
  lanzar(error)
  const mapa = new Map<string, string>()
  for (const d of data ?? []) if (d.path && d.signedUrl) mapa.set(d.path, d.signedUrl)
  return mapa
}

/** Carga completa de una rendición para revisarla. */
export async function abrirRendicion(id: string): Promise<RendicionAbierta> {
  const [cab, lin, res, eve] = await Promise.all([
    supabase.from('rendiciones').select('*').eq('id', id).single(),
    supabase.from('rendicion_lineas').select('*').eq('rendicion_id', id),
    supabase.from('respaldos').select('storage_path, orden').eq('rendicion_id', id).order('orden'),
    supabase
      .from('rendicion_eventos')
      .select('evento, nota, creado_en')
      .eq('rendicion_id', id)
      .order('creado_en'),
  ])
  lanzar(cab.error ?? lin.error ?? res.error ?? eve.error)
  const paths = (res.data ?? []).map((r) => r.storage_path)
  const urls = await urlsFirmadas(paths)
  return {
    borrador: aBorradorDesdeBase(cab.data!, lin.data ?? [], paths),
    version: cab.data!.editado_en,
    eventos: (eve.data ?? []).map((e) => ({ evento: e.evento, nota: e.nota, fecha: e.creado_en })),
    respaldos: respaldosGuardados(paths, urls),
    notaTesoreria: cab.data!.nota_tesoreria,
  }
}

const sinRespaldos = (b: BorradorRendicion) => {
  const p = limpiarRendicion(b)
  return { ...p, id: undefined } as unknown as Json
}

/** Aprueba con las correcciones y devuelve el folio asignado. */
export async function aprobarRendicion(id: string, b: BorradorRendicion, version: string | null) {
  const { data, error } = await supabase.rpc('aprobar_rendicion', {
    p_id: id,
    p: sinRespaldos(b),
    p_version: version as string,
  })
  lanzar(error)
  return data as string
}

export async function observarRendicion(id: string, nota: string, version: string | null) {
  const { error } = await supabase.rpc('observar_rendicion', {
    p_id: id,
    p_nota: nota,
    p_version: version as string,
  })
  lanzar(error)
}

export async function rechazarRendicion(id: string, nota: string, version: string | null) {
  const { error } = await supabase.rpc('rechazar_rendicion', {
    p_id: id,
    p_nota: nota,
    p_version: version as string,
  })
  lanzar(error)
}
