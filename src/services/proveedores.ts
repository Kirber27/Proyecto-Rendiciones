// Proveedores (spec 11): lista y RPC de la migración 19. La base valida RUT, duplicados y permisos.
import { traerTodo } from '@/lib/paginado'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { Proveedor, ProveedorBase } from '@/types/proveedores'
import { leerFilasHoja } from './excel'

type FilaProveedor = { id: string; nombre: string; rut: string; eliminado_en: string | null }

const aProveedor = (f: FilaProveedor): Proveedor => ({
  id: f.id,
  nombre: f.nombre,
  rut: f.rut,
  eliminado: !!f.eliminado_en,
})

const lanzar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

/** Activos para todos; tesorería recibe también los eliminados (RLS). */
export async function listarProveedores(): Promise<Proveedor[]> {
  const filas = await traerTodo((desde, hasta) =>
    supabase
      .from('proveedores')
      .select('id, nombre, rut, eliminado_en')
      .order('id')
      .range(desde, hasta),
  )
  return filas.map(aProveedor)
}

export async function crearProveedor(p: ProveedorBase): Promise<Proveedor> {
  const { data, error } = await supabase.rpc('crear_proveedor', { p_nombre: p.nombre, p_rut: p.rut })
  lanzar(error)
  return aProveedor(data!)
}

export async function editarProveedor(id: string, p: ProveedorBase): Promise<Proveedor> {
  const { data, error } = await supabase.rpc('editar_proveedor', {
    p_id: id,
    p_nombre: p.nombre,
    p_rut: p.rut,
  })
  lanzar(error)
  return aProveedor(data!)
}

/** Elimina (deja de aparecer para elegir) o, con `eliminar = false`, restaura. */
export async function eliminarProveedor(id: string, eliminar = true): Promise<void> {
  const { error } = await supabase.rpc('eliminar_proveedor', { p_id: id, p_eliminar: eliminar })
  lanzar(error)
}

/** Agrega los nuevos (la base salta los existentes y los inválidos). Devuelve cuántos agregó. */
export async function importarProveedores(filas: readonly ProveedorBase[]): Promise<number> {
  const { data, error } = await supabase.rpc('importar_proveedores', {
    p_filas: filas.map((f) => ({ nombre: f.nombre, rut: f.rut })) as unknown as Json,
  })
  lanzar(error)
  return data ?? 0
}

export const ERROR_LECTURA_PROVEEDORES =
  'No se pudo leer el archivo. Guárdalo como Excel (.xlsx) o CSV e intenta de nuevo.'

/** Primera hoja del Excel de proveedores como filas de celdas. */
export const leerArchivoProveedores = (archivo: File) =>
  leerFilasHoja(archivo, ERROR_LECTURA_PROVEEDORES)
