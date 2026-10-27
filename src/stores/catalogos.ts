// Catálogos (empresas, cuentas, subcuentas, C.C., medios de pago) y personas activas.
// Se cargan una vez por sesión; `recargar()` después de editar personas en Perfiles.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { leerCatalogos } from '@/services/catalogos'
import type { Catalogos } from '@/types/catalogos'

const VACIOS: Catalogos = {
  personas: [],
  empresas: [],
  cuentas: [],
  subcuentas: [],
  centrosCosto: [],
  mediosPago: [],
}

export const useCatalogosStore = defineStore('catalogos', () => {
  const catalogos = ref<Catalogos>(VACIOS)
  const cargando = ref(false)
  const listo = ref(false)
  const error = ref('')
  let pendiente: Promise<void> | null = null

  /** Carga los catálogos si aún no están (varias llamadas comparten la misma carga). */
  function cargar(): Promise<void> {
    if (listo.value) return Promise.resolve()
    pendiente ??= (async () => {
      cargando.value = true
      error.value = ''
      try {
        catalogos.value = await leerCatalogos()
        listo.value = true
      } catch (e) {
        error.value = (e as Error).message
      } finally {
        cargando.value = false
        pendiente = null
      }
    })()
    return pendiente
  }

  function recargar() {
    listo.value = false
    return cargar()
  }

  /** Al cerrar sesión: olvidar todo. */
  function limpiar() {
    catalogos.value = VACIOS
    listo.value = false
    error.value = ''
  }

  const personasActivas = computed(() => catalogos.value.personas.map((p) => p.id))

  return { catalogos, cargando, listo, error, cargar, recargar, limpiar, personasActivas }
})
