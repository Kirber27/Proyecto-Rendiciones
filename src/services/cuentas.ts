// Cuentas con contraseña (spec 10): Edge Function `cuentas`, solo para el administrador.
// Devuelve la contraseña temporal para entregársela a la persona (la app no envía correos).
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

async function pedir(accion: 'crear' | 'restablecer', personaId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('cuentas', {
    body: { accion, personaId },
  })
  if (error) {
    // La función responde { message } en español; si no llega, es un problema de conexión.
    let mensaje = 'No se pudo completar. Revisa tu conexión e intenta de nuevo.'
    if (error instanceof FunctionsHttpError) {
      const j = await (error.context as Response).json().catch(() => null)
      if (typeof j?.message === 'string') mensaje = j.message
    }
    throw new Error(mensaje)
  }
  const clave = (data as { clave?: unknown } | null)?.clave
  if (typeof clave !== 'string') throw new Error('Respuesta inesperada del servidor.')
  return clave
}

/** Crea la cuenta de la persona (con su correo registrado) y devuelve la contraseña temporal. */
export const crearCuenta = (personaId: string) => pedir('crear', personaId)

/** Asigna una contraseña temporal nueva a la cuenta de la persona (recuperar contraseña). */
export const nuevaClave = (personaId: string) => pedir('restablecer', personaId)
