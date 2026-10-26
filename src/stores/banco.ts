// Banco (spec 07): cartolas guardadas y propuestas de conciliación sobre el libro (useLibroStore).
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { movimientosParaConciliar, resumenCartolas } from '@/domain/banco'
import { proponer } from '@/domain/conciliacion'
import { leerCartolas } from '@/services/banco'
import type { CartolaGuardada, MovimientoGuardado } from '@/types/banco'
import type { RendicionParaPago } from '@/types/pagos'
import { useAuthStore } from './auth'
import { useCatalogosStore } from './catalogos'
import { useLibroStore } from './libro'

export const useBancoStore = defineStore('banco', () => {
  const auth = useAuthStore()
  const cat = useCatalogosStore()
  const libro = useLibroStore()

  const cartolas = ref<CartolaGuardada[]>([])
  const guardados = ref<MovimientoGuardado[]>([])
  const cargando = ref(false)
  const error = ref('')

  /** Cartolas y libro (rendiciones y pagos) en paralelo. */
  async function cargar() {
    cargando.value = true
    error.value = ''
    try {
      const [c] = await Promise.all([leerCartolas(), libro.cargar()])
      cartolas.value = c.cartolas
      guardados.value = c.movimientos
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      cargando.value = false
    }
  }

  const movimientos = computed(() => movimientosParaConciliar(guardados.value, libro.pagos))

  /** Nombre por persona para buscarlo en la glosa del banco (activas y las del libro). */
  const nombres = computed(() => {
    const m = new Map<string, string>()
    for (const f of libro.filas) m.set(f.personaId, f.personaNombre)
    for (const p of cat.catalogos.personas) m.set(p.id, p.nombre)
    return m
  })

  const rendiciones = computed<RendicionParaPago[]>(() =>
    libro.filas
      .filter((f) => f.estado === 'aprobada')
      .map((f) => ({
        id: f.id,
        personaId: f.personaId,
        nro: f.nro,
        fecha: f.fecha,
        total: f.total,
      })),
  )
  const folios = computed(() => new Map(libro.filas.map((f) => [f.id, f.folio])))

  const resultado = computed(() =>
    proponer({
      movimientos: movimientos.value,
      rendiciones: rendiciones.value,
      pagos: libro.pagos,
      asignacion: libro.asignacion,
      nombres: nombres.value,
    }),
  )

  const resumen = computed(() => resumenCartolas(cartolas.value, movimientos.value))

  function limpiar() {
    cartolas.value = []
    guardados.value = []
  }
  watch(
    () => auth.conSesion,
    (con) => {
      if (!con) limpiar()
    },
  )

  return {
    cartolas,
    guardados,
    cargando,
    error,
    cargar,
    movimientos,
    nombres,
    rendiciones,
    folios,
    resultado,
    resumen,
  }
})
