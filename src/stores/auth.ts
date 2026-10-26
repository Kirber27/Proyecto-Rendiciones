// Sesión del usuario: cuenta de Supabase Auth + persona vinculada (personas.user_id) y su función.
import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { tr } from '@/domain/formato'
import { supabase } from '@/lib/supabase'
import { useCatalogosStore } from './catalogos'
import { TESORERIA, type Rol } from '@/types/roles'

export interface PersonaSesion {
  id: string
  nombre: string
  codigo: string
  rol: Rol
}

/** Mensaje en español para los errores de ingreso. */
export function mensajeErrorIngreso(
  e: { message?: string; status?: number; code?: string } | null,
): string {
  const m = e?.message ?? ''
  if (/habilitado/i.test(m)) return m // viene del hook: "Tu correo no está habilitado…"
  if (e?.status === 429 || /rate limit|too many|security purposes/i.test(m))
    return 'Se pidieron demasiados códigos. Espera un minuto e intenta de nuevo.'
  if (/expired|invalid|otp/i.test(m) || e?.code === 'otp_expired')
    return 'El código no es válido o ya venció. Pide uno nuevo.'
  if (/email.*invalid|invalid.*email/i.test(m)) return 'Ese correo no tiene un formato válido.'
  return 'No se pudo completar el ingreso. Revisa tu conexión e intenta de nuevo.'
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

  /** Envía el código (y enlace) de acceso al correo. Lanza Error con mensaje en español. */
  async function pedirCodigo(correo: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    if (error) throw new Error(mensajeErrorIngreso(error))
  }

  /** Verifica el código recibido por correo e inicia la sesión. */
  async function verificarCodigo(correo: string, codigo: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: correo.trim().toLowerCase(),
      token: codigo.replace(/\D/g, ''),
      type: 'email',
    })
    if (error) throw new Error(mensajeErrorIngreso(error))
    session.value = data.session
    await cargarPersona()
  }

  async function salir() {
    await supabase.auth.signOut()
    session.value = null
    persona.value = null
    useCatalogosStore().limpiar()
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
    init,
    cargarPersona,
    pedirCodigo,
    verificarCodigo,
    salir,
  }
})
