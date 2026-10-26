// Lectura de catálogos y personas activas desde Supabase (RLS: cualquier usuario con sesión).
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { Catalogos } from '@/types/catalogos'

export interface FilasCatalogos {
  personas: Pick<Tables<'personas'>, 'id' | 'nombre' | 'codigo'>[]
  empresas: Pick<Tables<'empresas'>, 'id' | 'nombre' | 'rut' | 'centro_costo_id'>[]
  cuentas: Pick<Tables<'cuentas'>, 'id' | 'nombre'>[]
  subcuentas: Pick<Tables<'subcuentas'>, 'id' | 'nombre' | 'cuenta_sugerida_id'>[]
  centrosCosto: Pick<Tables<'centros_costo'>, 'id' | 'codigo'>[]
  mediosPago: Pick<Tables<'medios_pago'>, 'id' | 'nombre'>[]
}

/** Filas de la base → tipos de dominio (nombres con su grafía exacta). */
export function aCatalogos(f: FilasCatalogos): Catalogos {
  return {
    personas: f.personas.map((p) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo })),
    empresas: f.empresas.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      rut: e.rut ?? '',
      centroCostoId: e.centro_costo_id,
    })),
    cuentas: f.cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
    subcuentas: f.subcuentas.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      cuentaSugeridaId: s.cuenta_sugerida_id,
    })),
    centrosCosto: f.centrosCosto.map((c) => ({ id: c.id, nombre: c.codigo })),
    mediosPago: f.mediosPago.map((m) => ({ id: m.id, nombre: m.nombre })),
  }
}

function datos<T>(r: { data: T[] | null; error: { message: string } | null }, tabla: string): T[] {
  if (r.error) throw new Error(`No se pudo leer ${tabla}: ${r.error.message}`)
  return r.data ?? []
}

/** Carga todos los catálogos en paralelo. */
export async function leerCatalogos(): Promise<Catalogos> {
  const [personas, empresas, cuentas, subcuentas, centrosCosto, mediosPago] = await Promise.all([
    supabase
      .from('personas')
      .select('id, nombre, codigo')
      .is('eliminada_en', null)
      .order('nombre_norm'),
    supabase.from('empresas').select('id, nombre, rut, centro_costo_id').order('id'),
    supabase.from('cuentas').select('id, nombre').order('orden'),
    supabase
      .from('subcuentas')
      .select('id, nombre, cuenta_sugerida_id')
      .eq('activa', true)
      .order('orden'),
    supabase.from('centros_costo').select('id, codigo').order('orden'),
    supabase.from('medios_pago').select('id, nombre').order('orden'),
  ])
  return aCatalogos({
    personas: datos(personas, 'personas'),
    empresas: datos(empresas, 'empresas'),
    cuentas: datos(cuentas, 'cuentas'),
    subcuentas: datos(subcuentas, 'subcuentas'),
    centrosCosto: datos(centrosCosto, 'centros de costo'),
    mediosPago: datos(mediosPago, 'medios de pago'),
  })
}
