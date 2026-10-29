<script setup lang="ts">
// Rendiciones (spec 04): libro oficial con estado de pago FIFO, filtros, detalle editable,
// anular / eliminar / restaurar, PDF y exportación a Excel (porta vLibro() del prototipo).
// El detalle tiene su propia dirección /libro/<id> y reemplaza a la tabla (spec 12, R5): la vista se
// reutiliza al ir y volver, así conserva búsqueda, filtro, orden y página.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetalleLibro from '@/components/libro/DetalleLibro.vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiTile from '@/components/ui/KpiTile.vue'
import TablaPaginacion from '@/components/ui/TablaPaginacion.vue'
import ThOrden from '@/components/ui/ThOrden.vue'
import { clp, fdate, tr } from '@/domain/formato'
import {
  FILTROS_LIBRO,
  filtrarLibro,
  kpisLibro,
  ordenarLibro,
  pagoDe,
  paginar,
  siguienteOrden,
  TAMANOS_PAGINA_LIBRO,
  type ColumnaLibro,
  type FiltroLibro,
  type OrdenLibro,
} from '@/domain/libro'
import { useLibroStore } from '@/stores/libro'

const libro = useLibroStore()

/** Encabezados de la tabla, todos ordenables (spec 12, R3). */
const COLUMNAS: { columna: ColumnaLibro; titulo: string; numero?: boolean }[] = [
  { columna: 'folio', titulo: 'Folio' },
  { columna: 'fecha', titulo: 'Fecha' },
  { columna: 'persona', titulo: 'Solicitante' },
  { columna: 'nro', titulo: 'Nº' },
  { columna: 'total', titulo: 'Total', numero: true },
  { columna: 'pagado', titulo: 'Pagado', numero: true },
  { columna: 'saldo', titulo: 'Por pagar', numero: true },
  { columna: 'estado', titulo: 'Estado' },
  { columna: 'origen', titulo: 'Origen' },
]

const filtro = ref<FiltroLibro>('Todas')
const buscar = ref('')
const pagina = ref(1)
const orden = ref<OrdenLibro>(null)

// Tamaño de página recordado en este navegador (spec 12, R4.3); sin localStorage, 15.
const CLAVE_TAMANO = 'libro:tamano'
function leerTamano(): number {
  try {
    const n = Number(localStorage.getItem(CLAVE_TAMANO))
    return (TAMANOS_PAGINA_LIBRO as readonly number[]).includes(n) ? n : TAMANOS_PAGINA_LIBRO[0]
  } catch {
    return TAMANOS_PAGINA_LIBRO[0]
  }
}
const tamano = ref(leerTamano())
function cambiarTamano(n: number) {
  tamano.value = n
  pagina.value = 1
  try {
    localStorage.setItem(CLAVE_TAMANO, String(n))
  } catch {
    // Sin almacenamiento (ventana privada): vale solo para esta visita.
  }
}
const route = useRoute()
const router = useRouter()
const seleccionId = computed(() =>
  typeof route.params.id === 'string' && route.params.id ? route.params.id : null,
)
/** Última rendición abierta: queda marcada y a la vista al volver a la tabla. */
const ultimaAbierta = ref<string | null>(null)
/** Se abrió desde la tabla (el "atrás" vuelve a ella); si no, se llegó por la dirección. */
let desdeTabla = false
const mensaje = ref<{ tipo: 'success' | 'danger' | 'info'; texto: string } | null>(null)
const exportando = ref(false)

onMounted(libro.cargar)

const porRendicion = computed(() => libro.asignacion.porRendicion)
const lista = computed(() =>
  ordenarLibro(
    filtrarLibro(libro.filas, porRendicion.value, filtro.value, buscar.value),
    porRendicion.value,
    orden.value,
  ),
)
/** Hay búsqueda o filtro: las tarjetas muestran lo que está en la tabla (spec 11, R7). */
const filtrando = computed(() => !!buscar.value.trim() || filtro.value !== 'Todas')
const kpisCompletos = computed(() => kpisLibro(libro.filas, porRendicion.value))
const kpis = computed(() =>
  filtrando.value ? kpisLibro(lista.value, porRendicion.value) : kpisCompletos.value,
)
const vista = computed(() => paginar(lista.value, pagina.value, tamano.value))
const seleccion = computed(() => libro.filas.find((f) => f.id === seleccionId.value) ?? null)
/** Excel (búsqueda): solo con búsqueda o filtro y alguna aprobada en la tabla. */
const puedeExportarBusqueda = computed(
  () => filtrando.value && lista.value.some((f) => f.estado === 'aprobada'),
)
const filtros = computed(() =>
  FILTROS_LIBRO.filter((f) => f !== 'Eliminadas' || kpisCompletos.value.eliminadas),
)

watch([filtro, buscar, orden], () => (pagina.value = 1))

function ordenar(c: ColumnaLibro) {
  orden.value = siguienteOrden(orden.value, c)
}
// Si la rendición de la dirección no está en el libro (otra persona la anuló, o el enlace es viejo),
// volver a la tabla con aviso.
watch(
  () => [seleccionId.value, seleccion.value, libro.cargado, libro.cargando] as const,
  async ([id, s, cargado, cargando]) => {
    if (!id || s || !cargado || cargando) return
    desdeTabla = false
    await router.replace({ name: 'libro' })
    mensaje.value = { tipo: 'info', texto: 'Esa rendición ya no está en el libro.' }
  },
)
// Al volver a la tabla, dejar a la vista la fila que se abrió.
watch(seleccionId, async (id, antes) => {
  if (id || !antes) return
  await nextTick()
  document.querySelector(`tr[data-id="${antes}"]`)?.scrollIntoView({ block: 'center' })
})

async function abrir(id: string) {
  mensaje.value = null
  ultimaAbierta.value = id
  desdeTabla = true
  await router.push({ name: 'libro', params: { id } })
  window.scrollTo({ top: 0 })
}

/** Vuelve a la tabla: con "atrás" si se abrió desde ella (no deja entradas de más en el historial). */
async function volver() {
  if (!desdeTabla) {
    await router.push({ name: 'libro' })
    return
  }
  desdeTabla = false
  // router.back() no espera la navegación: se espera al cambio de ruta.
  await new Promise<void>((listo) => {
    const quitar = router.afterEach(() => {
      quitar()
      listo()
    })
    router.back()
  })
}

async function alCambiar(texto: string) {
  await volver()
  mensaje.value = { tipo: 'success', texto }
  await libro.cargar()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function exportar(modo: 'nuevas' | 'todas' | 'busqueda') {
  exportando.value = true
  mensaje.value = null
  try {
    const texto =
      modo === 'busqueda'
        ? await libro.exportarBusqueda(lista.value)
        : await libro.exportarExcel(modo === 'nuevas')
    mensaje.value = { tipo: texto.startsWith('Excel') ? 'success' : 'info', texto }
  } catch (e) {
    mensaje.value = { tipo: 'danger', texto: `No se pudo exportar: ${(e as Error).message}` }
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div v-if="mensaje" :class="['alert', `alert-${mensaje.tipo}`, 'mb-0']" role="status">
      {{ mensaje.texto }}
    </div>
    <div v-if="libro.error" class="alert alert-danger mb-0">{{ libro.error }}</div>

    <!-- Detalle: reemplaza a la tabla (spec 12, R5) -->
    <template v-if="seleccionId">
      <div>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="volver">
          <i class="bi bi-arrow-left" aria-hidden="true" /> Volver al libro
        </button>
      </div>
      <div v-if="!seleccion" class="small text-body-secondary">Cargando…</div>
      <DetalleLibro
        v-else
        :key="seleccion.id"
        :fila="seleccion"
        :estado-pago="pagoDe(porRendicion, seleccion.id)"
        :pagos="libro.pagosDe(seleccion.id)"
        @cerrar="volver"
        @cambiado="alCambiar"
      />
    </template>

    <template v-else>
      <PageTitle
        titulo="Rendiciones"
        lead="Libro de rendiciones aprobadas, con el historial 2026. El estado de pago se calcula con los pagos registrados de cada persona."
      />

      <div class="d-flex flex-column gap-1">
        <div class="kpis" data-test="kpis">
          <KpiTile etiqueta="Rendiciones" :valor="kpis.cantidad" />
          <KpiTile etiqueta="Total rendido" :valor="clp(kpis.rendido)" />
          <KpiTile etiqueta="Pendiente de pago" :valor="clp(kpis.pendiente)" />
          <KpiTile etiqueta="Sin exportar a Excel" :valor="kpis.sinExportar" />
        </div>
        <p v-if="filtrando" class="small text-body-secondary mb-0" data-test="kpis-busqueda">
          <i class="bi bi-funnel" aria-hidden="true" /> Según la búsqueda y el filtro: solo las
          rendiciones de la tabla.
        </p>
      </div>

      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <div class="btn-group btn-group-sm flex-wrap" role="group" aria-label="Filtrar por estado">
            <button
              v-for="f in filtros"
              :key="f"
              type="button"
              :class="['btn', filtro === f ? 'btn-primary' : 'btn-outline-secondary']"
              :aria-pressed="filtro === f"
              @click="filtro = f"
            >
              {{ f }}
            </button>
          </div>
          <input
            v-model="buscar"
            type="search"
            class="form-control form-control-sm"
            style="width: 220px"
            placeholder="Buscar persona, folio o Nº"
            aria-label="Buscar persona, folio o Nº"
          />
        </div>
        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            :disabled="exportando || !libro.cargado"
            @click="exportar('nuevas')"
          >
            <i class="bi bi-file-earmark-excel" aria-hidden="true" /> Excel (nuevas)
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="exportando || !libro.cargado"
            @click="exportar('todas')"
          >
            Excel (todas)
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="exportando || !puedeExportarBusqueda"
            :title="
              puedeExportarBusqueda
                ? 'Exporta lo que muestra la tabla (no las marca como exportadas)'
                : 'Busca o filtra para exportar solo esas rendiciones'
            "
            @click="exportar('busqueda')"
          >
            <i class="bi bi-funnel" aria-hidden="true" /> Excel (búsqueda)
          </button>
        </div>
      </div>

      <div v-if="mensaje" :class="['alert', `alert-${mensaje.tipo}`, 'mb-0']" role="status">
        {{ mensaje.texto }}
      </div>
      <div v-if="libro.error" class="alert alert-danger mb-0">{{ libro.error }}</div>

      <div v-if="libro.cargando && !libro.cargado" class="small text-body-secondary">Cargando…</div>
      <EmptyState v-else-if="!lista.length" icono="bi-journal-text">
        {{
          buscar || filtro !== 'Todas'
            ? 'Ninguna rendición con ese filtro o búsqueda.'
            : 'El libro está vacío.'
        }}
      </EmptyState>
      <template v-else>
        <div class="table-wrap">
          <table class="table table-hover table-click table-cols mb-0">
            <thead>
              <tr>
                <ThOrden
                  v-for="c in COLUMNAS"
                  :key="c.columna"
                  :columna="c.columna"
                  :orden="orden"
                  :numero="c.numero"
                  @ordenar="ordenar"
                >
                  {{ c.titulo }}
                </ThOrden>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="f in vista.items"
                :key="f.id"
                tabindex="0"
                :data-id="f.id"
                :class="{ 'fila-sel': ultimaAbierta === f.id }"
                @click="abrir(f.id)"
                @keydown.enter="abrir(f.id)"
              >
                <td class="mono">{{ f.folio }}</td>
                <td class="mono">{{ fdate(f.fecha) }}</td>
                <td>{{ tr(f.personaNombre) }}</td>
                <td class="mono">{{ f.nro }}</td>
                <td class="n">{{ clp(f.total) }}</td>
                <template v-if="f.estado === 'aprobada'">
                  <td class="n">{{ clp(pagoDe(porRendicion, f.id).pagado) }}</td>
                  <td class="n" :class="{ pos: pagoDe(porRendicion, f.id).saldo > 1 }">
                    {{
                      pagoDe(porRendicion, f.id).saldo > 1
                        ? clp(pagoDe(porRendicion, f.id).saldo)
                        : '—'
                    }}
                  </td>
                  <td><AppChip :estado="pagoDe(porRendicion, f.id).estado" /></td>
                </template>
                <template v-else>
                  <td class="n">—</td>
                  <td class="n">—</td>
                  <td><AppChip estado="Eliminada" /></td>
                </template>
                <td class="small text-body-secondary">{{ f.origen }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <TablaPaginacion
          v-if="lista.length > TAMANOS_PAGINA_LIBRO[0]"
          :pagina="vista.pagina"
          :paginas="vista.paginas"
          :total="lista.length"
          :desde="vista.desde"
          :hasta="vista.hasta"
          :tamano="tamano"
          :tamanos="TAMANOS_PAGINA_LIBRO"
          etiqueta="rendiciones"
          @update:pagina="pagina = $event"
          @update:tamano="cambiarTamano"
        />
      </template>
    </template>
  </div>
</template>
