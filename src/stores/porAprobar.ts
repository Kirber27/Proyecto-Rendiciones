// Contador de "Por aprobar" (spec 03, R1.4): se actualiza solo con Realtime mientras haya sesión de tesorería.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { contarPorAprobar } from '@/services/aprobacion'
import { useAuthStore } from './auth'

export const usePorAprobarStore = defineStore('porAprobar', () => {
  const auth = useAuthStore()
  const cantidad = ref(0)
  /** Sube con cada cambio en rendiciones: las pantallas lo miran para recargar sus listas. */
  const cambios = ref(0)
  let canal: RealtimeChannel | null = null
  let espera: ReturnType<typeof setTimeout> | null = null

  async function actualizar() {
    try {
      cantidad.value = await contarPorAprobar()
    } catch {
      /* sin conexión: se reintenta con el próximo cambio */
    }
  }

  /** Agrupa ráfagas de cambios (un envío toca varias filas) en una sola recarga. */
  function alCambiar() {
    if (espera) clearTimeout(espera)
    espera = setTimeout(() => {
      cambios.value++
      void actualizar()
    }, 400)
  }

  function iniciar() {
    if (canal) return
    void actualizar()
    canal = supabase
      // Nombre único: supabase.channel() reutiliza un canal existente y no se puede volver a suscribir
      // (pasaba al salir y entrar de nuevo antes de que se cerrara el anterior).
      .channel(`por-aprobar-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rendiciones' }, alCambiar)
      .subscribe()
  }

  function detener() {
    if (canal) void supabase.removeChannel(canal)
    canal = null
    cantidad.value = 0
  }

  // Activo solo para tesorería con sesión.
  watch(
    () => auth.conSesion && auth.esTesoreria,
    (activo) => (activo ? iniciar() : detener()),
    { immediate: true },
  )

  return { cantidad, cambios, actualizar }
})
