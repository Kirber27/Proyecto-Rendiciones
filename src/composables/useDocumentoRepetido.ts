// Nº de documento único por proveedor (spec 11, R3): mientras se escribe, consulta a la base si el
// documento (RUT + tipo + Nº) de cada línea ya está en otra rendición y marca `numeroRepetido`.
// Dentro del mismo formulario se revisa sin red (`repetidosEnFormulario`). La base vuelve a revisar
// todo al guardar.
import { computed, onBeforeUnmount, watch, type Ref } from 'vue'
import { claveDocumento, repetidosEnFormulario } from '@/domain/rendicion'
import { documentoRepetido } from '@/services/rendiciones'
import type { LineaBorrador } from '@/types/rendicion'

/** Espera antes de consultar mientras se escribe el Nº. */
export const ESPERA_CONSULTA_MS = 400

export function useDocumentoRepetido(
  lineas: Ref<LineaBorrador[]>,
  rendicionId: () => string | undefined,
) {
  const claves = computed(() => lineas.value.map(claveDocumento))
  const enFormulario = computed(() => repetidosEnFormulario(lineas.value))
  const esperas = new Map<number, ReturnType<typeof setTimeout>>()

  function consultar(i: number) {
    clearTimeout(esperas.get(i))
    esperas.set(
      i,
      setTimeout(async () => {
        esperas.delete(i)
        const l = lineas.value[i]
        const clave = l && claveDocumento(l)
        if (!l || !clave) return
        try {
          const repetido = await documentoRepetido(l.rut, l.tipo, l.numero, rendicionId())
          // Solo si la línea sigue con el mismo documento que se consultó.
          if (lineas.value[i] === l && claveDocumento(l) === clave) l.numeroRepetido = repetido
        } catch {
          // Sin respuesta no se marca: la base lo revisa al guardar.
        }
      }, ESPERA_CONSULTA_MS),
    )
  }

  // Al abrir: un formulario nuevo (o un borrador recuperado) se revisa entero. Una rendición guardada
  // no, porque lo que ya tenía no se vuelve a revisar (el historial puede traer repetidos).
  // Después, cada línea cuyo documento cambia se vuelve a consultar.
  watch(
    claves,
    (nuevas, antes) => {
      nuevas.forEach((clave, i) => {
        if (antes === undefined) {
          if (clave && !rendicionId()) consultar(i)
          return
        }
        if (clave === antes[i]) return
        const l = lineas.value[i]!
        l.numeroRepetido = false
        if (clave) consultar(i)
      })
    },
    { immediate: true },
  )
  onBeforeUnmount(() => esperas.forEach((t) => clearTimeout(t)))

  /** Mensaje de error del Nº doc. de la línea, o null. */
  function errorDocumento(i: number): string | null {
    const anterior = enFormulario.value.get(i)
    if (anterior !== undefined) return `Repite el Nº del gasto ${anterior + 1}.`
    if (lineas.value[i]?.numeroRepetido) return 'Este Nº de documento ya está cargado para este proveedor.'
    return null
  }

  return { errorDocumento }
}
