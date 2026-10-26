// Flujo de "Rendir gastos" (spec 02, 2.6): fotos → lectura automática con IA → borrador editable.
// El envío (subir fotos a Storage + RPC) se agrega en 2.7.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { ErrorLectura } from '@shared/lectura'
import { hoy } from '@/domain/formato'
import { aBorrador, mensajeErrorLectura } from '@/domain/lectura'
import { centroCostoDeEmpresa } from '@/domain/catalogos'
import { lineaVacia } from '@/domain/rendicion'
import { prepararImagenes } from '@/lib/imagenes'
import { leerFotos, MAX_IMAGENES_LECTURA } from '@/services/lectura'
import { enviarRendicion } from '@/services/rendiciones'
import { clp } from '@/domain/formato'
import type { BorradorRendicion } from '@/types/rendicion'
import { useAuthStore } from './auth'
import { useCatalogosStore } from './catalogos'

export interface FotoLocal {
  id: string
  file: File
  url: string
}

export interface Aviso {
  tipo: 'success' | 'info' | 'warning' | 'danger'
  texto: string
}

const CLAVE = (userId: string) => `rendir:borrador:${userId}`

export const useRendirStore = defineStore('rendir', () => {
  const auth = useAuthStore()
  const catalogos = useCatalogosStore()

  const fotos = ref<FotoLocal[]>([])
  const borrador = ref<BorradorRendicion | null>(null)
  const leyendo = ref(false)
  const avisoLectura = ref<Aviso | null>(null)
  const avisoEnvio = ref<Aviso | null>(null)
  /** Cantidad de fotos que tenía la última lectura (para ofrecer "Volver a leer"). */
  const fotosLeidas = ref(0)
  const enviando = ref(false)
  const progresoEnvio = ref('')
  let control: AbortController | null = null
  /** Id de una rendición nueva: se genera una vez para que los reintentos usen la misma carpeta. */
  let idEnvio: string | null = null
  /** Fotos ya subidas a Storage en intentos anteriores (id local → ruta). */
  const subidas = new Map<string, string>()

  /** El solicitante queda fijo en su persona si no es tesorería (R2.6). */
  const personaFija = computed(() => (auth.esTesoreria ? null : (auth.persona?.id ?? null)))
  const hayFotosNuevas = computed(
    () => fotos.value.length > 0 && fotos.value.length !== fotosLeidas.value,
  )

  // ---------- Borrador guardado en el navegador (R4.5) ----------
  let silencio = false // al limpiar por cambio de usuario no se toca lo guardado
  function guardarLocal() {
    const uid = auth.session?.user.id
    if (!uid || silencio) return
    try {
      if (borrador.value) localStorage.setItem(CLAVE(uid), JSON.stringify(borrador.value))
      else localStorage.removeItem(CLAVE(uid))
    } catch {
      // Sin almacenamiento (modo privado): el borrador vive solo en esta pestaña.
    }
  }
  // 'sync': se guarda en el momento (y el silencio de abajo funciona sin carreras).
  watch(borrador, guardarLocal, { deep: true, flush: 'sync' })

  /** Recupera el borrador que quedó al cerrar la pestaña (sin fotos: no se guardan en el navegador). */
  function recuperar() {
    const uid = auth.session?.user.id
    if (!uid || borrador.value) return
    try {
      const guardado = localStorage.getItem(CLAVE(uid))
      if (!guardado) return
      borrador.value = JSON.parse(guardado) as BorradorRendicion
      avisoLectura.value = {
        tipo: 'info',
        texto:
          'Recuperamos la rendición que estabas completando. Si tenías fotos, vuelve a agregarlas para adjuntarlas.',
      }
    } catch {
      /* borrador ilegible: se ignora */
    }
  }

  // ---------- Fotos ----------
  function agregarFotos(archivos: File[]) {
    for (const file of archivos) {
      fotos.value.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })
    }
    avisoEnvio.value = null
    // Lectura automática al subir (R2.1), solo si todavía no hay borrador.
    if (!borrador.value && fotos.value.length) void leer()
  }

  function quitarFoto(indice: number) {
    const [f] = fotos.value.splice(indice, 1)
    if (f) URL.revokeObjectURL(f.url)
    if (!fotos.value.length && !borrador.value) avisoLectura.value = null
  }

  // ---------- Lectura ----------
  async function leer() {
    if (!fotos.value.length || leyendo.value) return
    leyendo.value = true // de inmediato: la persona ve "Leyendo…" aunque falten los catálogos
    avisoLectura.value = null
    control = new AbortController()
    const anterior = borrador.value
    try {
      await catalogos.cargar()
      const { imagenes, nota } = await prepararImagenes(
        fotos.value.map((f) => f.file),
        MAX_IMAGENES_LECTURA,
      )
      const respuesta = await leerFotos(imagenes, nota, control.signal)
      const nuevo = aBorrador(respuesta, {
        catalogos: catalogos.catalogos,
        personaFija: personaFija.value,
        hoy: hoy(),
        id: anterior?.id,
        respaldos: anterior?.respaldos,
      })
      if (fotos.value.length > MAX_IMAGENES_LECTURA)
        nuevo.dudas.push(
          `Se leyeron las primeras ${MAX_IMAGENES_LECTURA} fotos; las demás se guardan como respaldo.`,
        )
      borrador.value = nuevo
      fotosLeidas.value = fotos.value.length
    } catch (e) {
      const m = mensajeErrorLectura(e instanceof ErrorLectura ? e.codigo : 'error')
      avisoLectura.value = { tipo: m.tipo, texto: m.texto }
    } finally {
      leyendo.value = false
      control = null
    }
  }

  function cancelarLectura() {
    control?.abort()
  }

  /** Si la lectura no funciona, permite completar a mano (no es el camino principal). */
  function completarAMano() {
    const empresa = catalogos.catalogos.empresas.find(
      (e) => e.nombre === 'Hecaglobal Instruments SPA',
    )
    const fecha = hoy()
    borrador.value = {
      personaId: personaFija.value,
      nro: '',
      fecha,
      empresaId: empresa?.id ?? null,
      fondo: '',
      totalFormulario: '',
      lineas: [
        lineaVacia({
          fecha,
          centroCostoId: centroCostoDeEmpresa(empresa?.id ?? null, catalogos.catalogos.empresas),
        }),
      ],
      dudas: [],
      respaldos: [],
    }
    avisoLectura.value = null
  }

  /** Al salir o cambiar de usuario: olvidar lo que hay en memoria (lo guardado en el navegador queda). */
  watch(
    () => auth.session?.user.id,
    (nuevo, anterior) => {
      if (anterior && nuevo !== anterior) {
        cancelarLectura()
        fotos.value.forEach((f) => URL.revokeObjectURL(f.url))
        fotos.value = []
        silencio = true
        borrador.value = null
        silencio = false
        fotosLeidas.value = 0
        avisoLectura.value = null
        avisoEnvio.value = null
      }
    },
  )

  /** Borra todo: fotos, borrador y lo guardado en el navegador. */
  function descartar() {
    cancelarLectura()
    fotos.value.forEach((f) => URL.revokeObjectURL(f.url))
    fotos.value = []
    borrador.value = null
    fotosLeidas.value = 0
    avisoLectura.value = null
    avisoEnvio.value = null
    idEnvio = null
    subidas.clear()
  }

  // ---------- Envío (2.7) ----------
  /** Sube las fotos y envía. La validación la hace la pantalla antes de llamar. Devuelve true si se envió. */
  async function enviar(): Promise<boolean> {
    if (!borrador.value || enviando.value) return false
    enviando.value = true
    avisoEnvio.value = null
    idEnvio ??= borrador.value.id ?? crypto.randomUUID()
    try {
      const r = await enviarRendicion(
        borrador.value,
        fotos.value.map((f) => ({ id: f.id, file: f.file })),
        { rendicionId: idEnvio, subidas, onProgreso: (t) => (progresoEnvio.value = t) },
      )
      descartar()
      avisoEnvio.value = {
        tipo: 'success',
        texto: `Rendición Nº ${r.nro} ${r.reenvio ? 'reenviada' : 'enviada'} por ${clp(r.total)}. Tesorería la revisará; sigue su estado en Mis rendiciones.`,
      }
      return true
    } catch (e) {
      avisoEnvio.value = { tipo: 'danger', texto: (e as Error).message }
      return false
    } finally {
      enviando.value = false
      progresoEnvio.value = ''
    }
  }

  return {
    fotos,
    borrador,
    leyendo,
    enviando,
    progresoEnvio,
    enviar,
    avisoLectura,
    avisoEnvio,
    personaFija,
    hayFotosNuevas,
    recuperar,
    agregarFotos,
    quitarFoto,
    leer,
    cancelarLectura,
    completarAMano,
    descartar,
  }
})
