// Libro de rendiciones (spec 04): rendiciones del libro, pagos y estado de pago FIFO compartido.
// Se refresca con cada cambio en rendiciones (Realtime de usePorAprobarStore).
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { asignarPagos } from '@/domain/asignacion'
import { filasExcel, nombreArchivoExcel, seleccionarParaExportar } from '@/domain/exportar'
import { hoy } from '@/domain/formato'
import { pagosParaExcel, rendicionesParaExcel, type FilaLibro } from '@/domain/libro'
import { descargarExcel } from '@/services/excel'
import { leerLineas, listarLibro, marcarExportadas } from '@/services/libro'
import { leerPagos, type Pago } from '@/services/pagos'
import { useAuthStore } from './auth'
import { useCatalogosStore } from './catalogos'
import { usePorAprobarStore } from './porAprobar'

export const useLibroStore = defineStore('libro', () => {
  const auth = useAuthStore()
  const cat = useCatalogosStore()
  const porAprobar = usePorAprobarStore()

  const filas = ref<FilaLibro[]>([])
  const pagos = ref<Pago[]>([])
  const cargando = ref(false)
  const cargado = ref(false)
  const error = ref('')

  async function cargar() {
    cargando.value = true
    error.value = ''
    try {
      const [fs, ps] = await Promise.all([listarLibro(), leerPagos(), cat.cargar()])
      filas.value = fs
      pagos.value = ps
      cargado.value = true
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      cargando.value = false
    }
  }

  // Alguien aprobó, anuló o eliminó: refrescar si el libro ya se abrió.
  watch(
    () => porAprobar.cambios,
    () => {
      if (cargado.value) void cargar()
    },
  )

  const asignacion = computed(() =>
    asignarPagos(
      filas.value
        .filter((f) => f.estado === 'aprobada')
        .map((f) => ({
          id: f.id,
          personaId: f.personaId,
          nro: f.nro,
          fecha: f.fecha,
          total: f.total,
        })),
      pagos.value,
    ),
  )

  const pagosDe = (rendicionId: string) =>
    pagos.value.filter((p) => p.rendicionIds.includes(rendicionId))

  /**
   * Descarga el Excel del libro. `soloNuevas` exporta las no exportadas y después las marca.
   * Devuelve el mensaje para la pantalla.
   */
  async function exportarExcel(soloNuevas: boolean): Promise<string> {
    const sel = seleccionarParaExportar(
      filas.value.filter((f) => f.estado === 'aprobada'),
      soloNuevas,
    )
    if (!sel.length)
      return soloNuevas ? 'No hay rendiciones nuevas para exportar.' : 'El libro está vacío.'
    const lineas = await leerLineas(sel.map((f) => f.id))
    const datos = filasExcel(
      rendicionesParaExcel(sel, lineas, cat.catalogos),
      pagosParaExcel(pagos.value, cat.catalogos.mediosPago),
    )
    await descargarExcel(datos, nombreArchivoExcel(hoy()))
    if (soloNuevas) {
      await marcarExportadas(sel.map((f) => f.id))
      const marcadas = new Set(sel.map((f) => f.id))
      filas.value = filas.value.map((f) => (marcadas.has(f.id) ? { ...f, exportada: true } : f))
    }
    return `Excel con ${sel.length} rendición(es) y ${datos.length} línea(s).${soloNuevas ? ' Quedaron marcadas como exportadas.' : ''}`
  }

  function limpiar() {
    filas.value = []
    pagos.value = []
    cargado.value = false
  }

  // Al salir no queda nada del libro en memoria.
  watch(
    () => auth.conSesion,
    (con) => {
      if (!con) limpiar()
    },
  )

  return {
    filas,
    pagos,
    cargando,
    cargado,
    error,
    asignacion,
    cargar,
    pagosDe,
    exportarExcel,
    limpiar,
  }
})
