// Gestión de personas (Perfiles): lectura y RPC de administrador (migración 20261026000010).
import { supabase } from '@/lib/supabase'
import type { Rol } from '@/types/roles'

export interface PersonaPerfil {
  id: string
  /** Grafía exacta ("David Herce "). */
  nombre: string
  codigo: string
  correo: string | null
  rol: Rol
  /** Tiene cuenta de usuario vinculada. */
  vinculada: boolean
  /** Creada en la app (no viene del historial). */
  esNueva: boolean
  eliminadaEn: string | null
  rendiciones: number
}

export interface CuentaUsuario {
  userId: string
  email: string
  ultimoIngreso: string | null
  personaId: string | null
  personaNombre: string | null
}

const lanzar = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

/** Todas las personas (activas y eliminadas) con su cantidad de rendiciones. */
export async function listarPersonasPerfil(): Promise<PersonaPerfil[]> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, nombre, codigo, correo, rol, user_id, es_nueva, eliminada_en, rendiciones(count)')
    .order('nombre_norm')
  lanzar(error)
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
    correo: p.correo,
    rol: p.rol,
    vinculada: !!p.user_id,
    esNueva: p.es_nueva,
    eliminadaEn: p.eliminada_en,
    rendiciones: p.rendiciones[0]?.count ?? 0,
  }))
}

/** Alta (sin id) o edición. Devuelve el id. */
export async function guardarPersona(p: {
  id?: string
  nombre: string
  codigo: string
  correo: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('guardar_persona', { p })
  lanzar(error)
  return data as string
}

/** Cambia la función; devuelve el id del tesorero anterior si pasó a Solicitante. */
export async function asignarRol(personaId: string, rol: Rol): Promise<string | null> {
  const { data, error } = await supabase.rpc('asignar_rol', { p_persona_id: personaId, p_rol: rol })
  lanzar(error)
  return (data as string | null) ?? null
}

export async function eliminarPersona(personaId: string) {
  const { error } = await supabase.rpc('eliminar_persona', { p_persona_id: personaId })
  lanzar(error)
}

export async function restaurarPersona(personaId: string) {
  const { error } = await supabase.rpc('restaurar_persona', { p_persona_id: personaId })
  lanzar(error)
}

export async function listarCuentas(): Promise<CuentaUsuario[]> {
  const { data, error } = await supabase.rpc('listar_cuentas')
  lanzar(error)
  return (data ?? []).map((c) => ({
    userId: c.user_id,
    email: c.email,
    ultimoIngreso: c.ultimo_ingreso,
    personaId: c.persona_id,
    personaNombre: c.persona_nombre,
  }))
}

export async function vincularCuenta(userId: string, personaId: string | null) {
  const { error } = await supabase.rpc('vincular_cuenta', {
    p_user_id: userId,
    p_persona_id: personaId as string,
  })
  lanzar(error)
}
