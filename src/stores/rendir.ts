// Flujo de "Rendir gastos" (spec 02): la persona completa el formulario, adjunta los respaldos y envía.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { clp, hoy } from '@/domain/formato'
import { borradorNuevo, tieneDatos } from '@/domain/rendicion'
import { tipoRespaldo } from '@/domain/respaldos'
import { enviarRendicion } from '@/services/rendiciones'
import { abrirRendicion, respaldosGuardados, urlsFirmadas } from '@/services/aprobacion'
import type { BorradorRendicion, RespaldoGuardado, TipoRespaldo } from '@/types/rendicion'
import { useAuthStore } from './auth'
import { useCatalogosStore } from './catalogos'

/** Archivo adjunto que todavía no se sube. */
export interface ArchivoLocal {
  id: string
  file: File
  url: string
  tipo: TipoRespaldo
}

export interface Aviso {
  tipo: 'success' | 'info' | 'warning' | 'danger'
  texto: string
}

const CLAVE = (userId: string) => `rendir:borrador:${userId}`

export const useRendirStore = defineStore('rendir', () => {
  const auth = useAuthStore()
  const catalogos = useCatalogosStore()

  const archivos = ref<ArchivoLocal[]>([])
  /** Respaldos ya guardados en Storage (al corregir una rendición observada). */
  const guardados = ref<RespaldoGuardado[]>([])
  const borrador = ref<BorradorRendicion | null>(null)
  /** Aviso sobre el formulario: borrador recuperado o motivo de tesorería. */
  const aviso = ref<Aviso | null>(null)
  const avisoEnvio = ref<Aviso | null>(null)
  const enviando = ref(false)
  const progresoEnvio = ref('')
  /** Id de una rendición nueva: se genera una vez para que los reintentos usen la misma carpeta. */
  let idEnvio: string | null = null
  /** Archivos ya subidos a Storage en intentos anteriores (id local → ruta). */
  const subidas = new Map<string, string>()

  /** El solicitante queda fijo en su persona si no es tesorería (R1.3). */
  const personaFija = computed(() => (auth.esTesoreria ? null : (auth.persona?.id ?? null)))

  function nuevo(): BorradorRendicion {
    return borradorNuevo({
      catalogos: catalogos.catalogos,
      personaFija: personaFija.value,
      hoy: hoy(),
    })
  }

  // ---------- Borrador guardado en el navegador (R3.5) ----------
  let silencio = false // al limpiar por cambio de usuario no se toca lo guardado
  function guardarLocal() {
    const uid = auth.session?.user.id
    if (!uid || silencio) return
    try {
      if (borrador.value && tieneDatos(borrador.value))
        localStorage.setItem(CLAVE(uid), JSON.stringify(borrador.value))
      else localStorage.removeItem(CLAVE(uid))
    } catch {
      // Sin almacenamiento (modo privado): el borrador vive solo en esta pestaña.
    }
  }
  // 'sync': se guarda en el momento (y el silencio de abajo funciona sin carreras).
  watch(borrador, guardarLocal, { deep: true, flush: 'sync' })

  /** Recupera el borrador que quedó al cerrar la pestaña (sin adjuntos: no se guardan en el navegador). */
  function recuperar(): boolean {
    const uid = auth.session?.user.id
    if (!uid) return false
    try {
      const guardado = localStorage.getItem(CLAVE(uid))
      if (!guardado) return false
      borrador.value = JSON.parse(guardado) as BorradorRendicion
      void mostrarGuardados(borrador.value.respaldos)
      aviso.value = {
        tipo: 'info',
        texto:
          'Recuperamos la rendición que estabas completando. Si habías adjuntado archivos, vuelve a adjuntarlos.',
      }
      return true
    } catch {
      return false // borrador ilegible: se ignora
    }
  }

  async function mostrarGuardados(paths: string[]) {
    if (!paths.length) return
    try {
      guardados.value = respaldosGuardados(paths, await urlsFirmadas(paths))
    } catch {
      /* sin conexión: se ven al volver a abrir */
    }
  }

  /** Al entrar a la pantalla: el borrador en curso, el guardado en el navegador o uno nuevo (R1.1). */
  async function iniciar() {
    if (borrador.value) return
    await catalogos.cargar()
    // Sin catálogos no hay formulario (la pantalla muestra el error); o se abrió una para corregir.
    if (!catalogos.listo || borrador.value) return
    if (!recuperar()) borrador.value = nuevo()
  }

  // ---------- Corregir y reenviar (R4.1) ----------
  /** Abre una rendición observada (o en revisión) para corregirla y reenviarla. */
  async function cargarParaCorregir(id: string) {
    limpiar()
    avisoEnvio.value = null
    const r = await abrirRendicion(id)
    borrador.value = r.borrador
    guardados.value = r.respaldos
    aviso.value = r.notaTesoreria
      ? {
          tipo: 'warning',
          texto: `Tesorería pidió: «${r.notaTesoreria}». Corrige y vuelve a enviar.`,
        }
      : { tipo: 'info', texto: 'Corrige lo necesario y vuelve a enviar.' }
  }

  // ---------- Adjuntos ----------
  function agregarArchivos(lista: File[]) {
    for (const file of lista) {
      archivos.value.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        tipo: tipoRespaldo(file.type || file.name),
      })
    }
    avisoEnvio.value = null
  }

  function quitarArchivo(indice: number) {
    const [a] = archivos.value.splice(indice, 1)
    if (a) URL.revokeObjectURL(a.url)
  }

  /** Olvida adjuntos y avisos de la rendición en curso (no toca el borrador). */
  function limpiar() {
    archivos.value.forEach((a) => URL.revokeObjectURL(a.url))
    archivos.value = []
    guardados.value = []
    aviso.value = null
    idEnvio = null
    subidas.clear()
  }

  /** Al salir o cambiar de usuario: olvidar lo que hay en memoria (lo guardado en el navegador queda). */
  watch(
    () => auth.session?.user.id,
    (actual, anterior) => {
      if (anterior && actual !== anterior) {
        limpiar()
        silencio = true
        borrador.value = null
        silencio = false
        avisoEnvio.value = null
      }
    },
  )

  /** Borra todo (también lo guardado en el navegador) y deja el formulario vacío (R3.6). */
  function descartar() {
    limpiar()
    avisoEnvio.value = null
    borrador.value = nuevo()
  }

  // ---------- Envío (R3) ----------
  /** Sube los adjuntos y envía. La validación la hace la pantalla antes de llamar. Devuelve true si se envió. */
  async function enviar(): Promise<boolean> {
    if (!borrador.value || enviando.value) return false
    enviando.value = true
    avisoEnvio.value = null
    idEnvio ??= borrador.value.id ?? crypto.randomUUID()
    try {
      const r = await enviarRendicion(
        borrador.value,
        archivos.value.map((a) => ({ id: a.id, file: a.file })),
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
    archivos,
    guardados,
    borrador,
    aviso,
    avisoEnvio,
    enviando,
    progresoEnvio,
    personaFija,
    iniciar,
    cargarParaCorregir,
    agregarArchivos,
    quitarArchivo,
    descartar,
    enviar,
  }
})
