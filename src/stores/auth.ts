// Sesión del usuario: cuenta de Supabase Auth + persona vinculada (personas.user_id) y su función.
// Ingreso con correo y contraseña (spec 10): la app no envía correos.
import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LARGO_MINIMO_CLAVE } from '@/domain/acceso'
import { tr } from '@/domain/formato'
import { supabase } from '@/lib/supabase'
import { useCatalogosStore } from './catalogos'
import { useProveedoresStore } from './proveedores'
import { TESORERIA, type Rol } from '@/types/roles'

export interface PersonaSesion {
  id: string
  nombre: string
  codigo: string
  rol: Rol
}

type ErrorAuth = { message?: string; status?: number; code?: string } | null

const DEMASIADOS = 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
const esLimite = (e: ErrorAuth) =>
  e?.status === 429 || /rate limit|too many|security purposes/i.test(e?.message ?? '')
const esCredencialInvalida = (e: ErrorAuth) =>
  e?.code === 'invalid_credentials' || /invalid login credentials/i.test(e?.message ?? '')

/** Mensaje en español para los errores de ingreso (no dice si falló el correo o la contraseña). */
export function mensajeErrorIngreso(e: ErrorAuth): string {
  if (esCredencialInvalida(e)) return 'Correo o contraseña incorrectos.'
  if (esLimite(e)) return DEMASIADOS
  if (e?.code === 'email_not_confirmed' || /not confirmed/i.test(e?.message ?? ''))
    return 'Tu cuenta aún no está activa. Pide al administrador que te asigne una contraseña nueva.'
  return 'No se pudo completar el ingreso. Revisa tu conexión e intenta de nuevo.'
}

/** Mensaje en español para los errores al cambiar la contraseña. */
export function mensajeErrorClave(e: ErrorAuth): string {
  const m = e?.message ?? ''
  if (e?.code === 'same_password' || /different from the old/i.test(m))
    return 'La contraseña nueva debe ser distinta de la actual.'
  if (e?.code === 'weak_password' || /weak|at least|characters/i.test(m))
    return `La contraseña nueva es muy débil: usa al menos ${LARGO_MINIMO_CLAVE} caracteres.`
  if (esLimite(e)) return DEMASIADOS
  return 'No se pudo cambiar la contraseña. Revisa tu conexión e intenta de nuevo.'
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const persona = ref<PersonaSesion | null>(null)
  /** true cuando ya se revisó si hay sesión guardada (el router espera esto). */
  const listo = ref(false)
  let iniciando: Promise<void> | null = null

  const conSesion = computed(() => !!session.value)
  /** Sin persona vinculada = solicitante sin datos (RLS no le muestra nada). */
  const rol = computed<Rol>(() => persona.value?.rol ?? 'solicitante')
  const esTesoreria = computed(() => TESORERIA.includes(rol.value))
  const esAdmin = computed(() => rol.value === 'administrador')
  const nombre = computed(() =>
    persona.value ? tr(persona.value.nombre) : (session.value?.user.email ?? ''),
  )
  /** Entró con una contraseña temporal (la asignó el administrador): debe elegir una propia. */
  const debeCambiarClave = computed(
    () => session.value?.user.user_metadata?.debe_cambiar_clave === true,
  )

  async function cargarPersona() {
    const uid = session.value?.user.id
    if (!uid) {
      persona.value = null
      return
    }
    const { data } = await supabase
      .from('personas')
      .select('id, nombre, codigo, rol')
      .eq('user_id', uid)
      .is('eliminada_en', null)
      .maybeSingle()
    persona.value = data
  }

  /** Revisa la sesión guardada y escucha cambios (entrar, salir, renovar). Idempotente. */
  function init(): Promise<void> {
    iniciando ??= (async () => {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      await cargarPersona()
      supabase.auth.onAuthStateChange((evento, s) => {
        const cambioUsuario = s?.user.id !== session.value?.user.id
        session.value = s
        // Fuera del callback para no bloquear el cliente de auth (recomendación de supabase-js).
        if (cambioUsuario || evento === 'SIGNED_IN') setTimeout(() => void cargarPersona(), 0)
      })
      listo.value = true
    })()
    return iniciando
  }

  /** Inicia sesión con correo y contraseña. Lanza Error con mensaje en español. */
  async function entrar(correo: string, clave: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    })
    if (error) throw new Error(mensajeErrorIngreso(error))
    session.value = data.session
    await cargarPersona()
  }

  /**
   * Cambia la contraseña. En el cambio voluntario se pasa la actual y se verifica antes
   * (Supabase no la pide); con contraseña temporal no. Quita la marca de contraseña temporal.
   */
  async function cambiarClave(nueva: string, actual?: string) {
    const email = session.value?.user.email
    if (!email) throw new Error('Tu sesión expiró. Vuelve a ingresar.')
    if (actual !== undefined) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: actual })
      if (error)
        throw new Error(
          esCredencialInvalida(error)
            ? 'La contraseña actual no es correcta.'
            : mensajeErrorIngreso(error),
        )
    }
    const { data, error } = await supabase.auth.updateUser({
      password: nueva,
      data: { debe_cambiar_clave: false },
    })
    if (error) throw new Error(mensajeErrorClave(error))
    if (session.value && data.user) session.value = { ...session.value, user: data.user }
  }

  async function salir() {
    await supabase.auth.signOut()
    session.value = null
    persona.value = null
    useCatalogosStore().limpiar()
    useProveedoresStore().limpiar()
  }

  return {
    session,
    persona,
    listo,
    conSesion,
    rol,
    esTesoreria,
    esAdmin,
    nombre,
    debeCambiarClave,
    init,
    cargarPersona,
    entrar,
    cambiarClave,
    salir,
  }
})
