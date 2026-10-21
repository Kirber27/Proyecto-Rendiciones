import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { TESORERIA, type Rol } from '@/types/roles'

/**
 * Sesión del usuario. Versión mínima: en la tarea 1.8 se conecta a Supabase Auth
 * (sesión, persona vinculada y su función). Por ahora el rol se puede cambiar en desarrollo
 * con el selector temporal del encabezado.
 */
export const useAuthStore = defineStore('auth', () => {
  const rol = ref<Rol>('solicitante')

  const esTesoreria = computed(() => TESORERIA.includes(rol.value))
  const esAdmin = computed(() => rol.value === 'administrador')

  function fijarRol(r: Rol) {
    rol.value = r
  }

  return { rol, esTesoreria, esAdmin, fijarRol }
})
