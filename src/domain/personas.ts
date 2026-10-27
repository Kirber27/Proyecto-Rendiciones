// Reglas de la gestión de personas (porta sugerirCodigo, okMail, el alta de vConfig y setFuncionPersona).
import type { Rol } from '@/types/roles'
import { norm, tr } from './formato'

export interface PersonaGestion {
  id: string
  /** Grafía exacta ("David Herce "). */
  nombre: string
  codigo: string
  correo: string | null
  rol: Rol
  eliminada: boolean
}

export const PATRON_CODIGO = /^[A-Z]{2,4}$/
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Correo vacío es válido (se completa después); si viene, debe tener forma usuario@dominio.tld. */
export const correoValido = (s: string | null | undefined) =>
  !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

/**
 * Código sugerido: inicial del nombre + 2 primeras letras del apellido ("Juana Pérez" → "JPE").
 * Si ya está usado, prueba cambiando la tercera letra (JPA, JPB, …).
 */
export function sugerirCodigo(nombre: string, usados: Iterable<string>): string {
  const partes = tr(nombre).split(' ')
  const base = norm((partes[0] ?? '').slice(0, 1) + (partes[1] ?? partes[0] ?? '').slice(0, 2))
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  const ocupados = new Set(usados)
  if (!ocupados.has(base)) return base
  for (const c of LETRAS) {
    const k = base.slice(0, 2) + c
    if (!ocupados.has(k)) return k
  }
  return base
}

export interface PersonaNueva {
  nombre: string
  correo: string
  codigo: string
}

/** Problemas del formulario "Agregar persona nueva" (lista vacía = se puede guardar). */
export function validarPersonaNueva(
  p: PersonaNueva,
  personas: readonly PersonaGestion[],
): string[] {
  const problemas: string[] = []
  const nombre = tr(p.nombre)
  const codigo = p.codigo.trim().toUpperCase()
  const correo = p.correo.trim()

  if (nombre.split(' ').length < 2) problemas.push('Escribe nombre y apellido.')
  else {
    const misma = personas.find((x) => norm(x.nombre) === norm(nombre))
    if (misma?.eliminada)
      problemas.push('Esa persona está eliminada: restáurala desde "Personas eliminadas".')
    else if (misma) problemas.push('Esa persona ya está en la lista.')
  }

  if (!correoValido(correo)) problemas.push('Ese correo no tiene un formato válido.')
  else if (correo && personas.some((x) => x.correo && norm(x.correo) === norm(correo)))
    problemas.push('Ese correo ya lo usa otra persona.')

  if (!PATRON_CODIGO.test(codigo)) problemas.push('El código debe tener entre 2 y 4 letras.')
  else if (personas.some((x) => x.codigo === codigo))
    problemas.push(`El código ${codigo} ya lo usa otra persona.`)

  return problemas
}

/** Problema al cambiar el correo de una persona existente, o null si está bien. */
export function validarCorreo(
  personaId: string,
  correo: string,
  personas: readonly PersonaGestion[],
): string | null {
  if (!correoValido(correo)) return 'Ese correo no tiene un formato válido.'
  const c = correo.trim()
  if (c && personas.some((x) => x.id !== personaId && x.correo && norm(x.correo) === norm(c)))
    return 'Ese correo ya lo usa otra persona.'
  return null
}

const adminsActivos = (personas: readonly PersonaGestion[], salvo: string) =>
  personas.filter((x) => !x.eliminada && x.rol === 'administrador' && x.id !== salvo).length

export type ResultadoCambio =
  | { ok: true; /** Tesorero anterior que pasa a Solicitante. */ degradar: string | null }
  | { ok: false; error: string }

/** Cambio de función: un solo Tesorero activo y al menos un Administrador. */
export function cambiarFuncion(
  personaId: string,
  nueva: Rol,
  personas: readonly PersonaGestion[],
): ResultadoCambio {
  const p = personas.find((x) => x.id === personaId)
  if (!p) return { ok: false, error: 'La persona no existe.' }
  if (p.rol === 'administrador' && nueva !== 'administrador' && adminsActivos(personas, p.id) === 0)
    return { ok: false, error: 'Debe quedar al menos un Administrador.' }
  const degradar =
    nueva === 'tesorero'
      ? (personas.find((x) => !x.eliminada && x.rol === 'tesorero' && x.id !== p.id)?.id ?? null)
      : null
  return { ok: true, degradar }
}

/** Si se puede eliminar a la persona (no al último Administrador). */
export function puedeEliminar(
  personaId: string,
  personas: readonly PersonaGestion[],
): string | null {
  const p = personas.find((x) => x.id === personaId)
  if (!p) return 'La persona no existe.'
  if (p.rol === 'administrador' && adminsActivos(personas, p.id) === 0)
    return 'Debe quedar al menos un Administrador.'
  return null
}
