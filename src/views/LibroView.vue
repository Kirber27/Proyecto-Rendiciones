<script setup lang="ts">
// Rendiciones (spec 04): libro oficial con estado de pago FIFO, filtros, detalle editable,
// anular / eliminar / restaurar, PDF y exportación a Excel (porta vLibro() del prototipo).
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import DetalleLibro from '@/components/libro/DetalleLibro.vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiTile from '@/components/ui/KpiTile.vue'
import { clp, fdate, tr } from '@/domain/formato'
import {
  FILTROS_LIBRO,
  filtrarLibro,
  kpisLibro,
  pagoDe,
  paginar,
  type FiltroLibro,
} from '@/domain/libro'
import { useLibroStore } from '@/stores/libro'

const libro = useLibroStore()

const filtro = ref<FiltroLibro>('Todas')
const buscar = ref('')
const pagina = ref(1)
const seleccionId = ref<string | null>(null)
const mensaje = ref<{ tipo: 'success' | 'danger' | 'info'; texto: string } | null>(null)
const exportando = ref(false)

onMounted(libro.cargar)

const porRendicion = computed(() => libro.asignacion.porRendicion)
const kpis = computed(() => kpisLibro(libro.filas, porRendicion.value))
const lista = computed(() =>
  filtrarLibro(libro.filas, porRendicion.value, filtro.value, buscar.value),
)
const vista = computed(() => paginar(lista.value, pagina.value))
const seleccion = computed(() => libro.filas.find((f) => f.id === seleccionId.value) ?? null)
const filtros = computed(() =>
  FILTROS_LIBRO.filter((f) => f !== 'Eliminadas' || kpis.value.eliminadas),
)

watch([filtro, buscar], () => (pagina.value = 1))
// Si la rendición abierta sale del libro (otra persona la anuló, por ejemplo), cerrar el detalle.
watch(seleccion, (s) => {
  if (!s && seleccionId.value && libro.cargado && !libro.cargando) seleccionId.value = null
})

async function abrir(id: string) {
  seleccionId.value = id
  mensaje.value = null
  await nextTick()
  document.getElementById('detalle')?.scrollIntoView({ behavior: 'smooth' })
}

async function alCambiar(texto: string) {
  seleccionId.value = null
  mensaje.value = { tipo: 'success', texto }
  await libro.cargar()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function exportar(soloNuevas: boolean) {
  exportando.value = true
  mensaje.value = null
  try {
    const texto = await libro.exportarExcel(soloNuevas)
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
    <PageTitle
      titulo="Rendiciones"
      lead="Libro de rendiciones aprobadas, con el historial 2026. El estado de pago se calcula con los pagos registrados de cada persona."
    />

    <div class="kpis">
      <KpiTile etiqueta="Rendiciones" :valor="kpis.cantidad" />
      <KpiTile etiqueta="Total rendido" :valor="clp(kpis.rendido)" />
      <KpiTile etiqueta="Pendiente de pago" :valor="clp(kpis.pendiente)" />
      <KpiTile etiqueta="Sin exportar a Excel" :valor="kpis.sinExportar" />
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
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="exportando || !libro.cargado"
          @click="exportar(true)"
        >
          <i class="bi bi-file-earmark-excel" aria-hidden="true" /> Excel (nuevas)
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="exportando || !libro.cargado"
          @click="exportar(false)"
        >
          Excel (todas)
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
        <table class="table table-hover table-click mb-0">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Solicitante</th>
              <th>Nº</th>
              <th class="n">Total</th>
              <th class="n">Pagado</th>
              <th class="n">Por pagar</th>
              <th>Estado</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="f in vista.items"
              :key="f.id"
              tabindex="0"
              :class="{ 'fila-sel': seleccionId === f.id }"
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
      <nav
        v-if="vista.paginas > 1"
        class="d-flex align-items-center gap-2 small"
        aria-label="Páginas del libro"
      >
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="vista.pagina <= 1"
          @click="pagina = vista.pagina - 1"
        >
          ← Anterior
        </button>
        <span class="text-body-secondary">
          Página {{ vista.pagina }} de {{ vista.paginas }} · {{ lista.length }} rendiciones
        </span>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="vista.pagina >= vista.paginas"
          @click="pagina = vista.pagina + 1"
        >
          Siguiente →
        </button>
      </nav>
    </template>

    <div id="detalle">
      <DetalleLibro
        v-if="seleccion"
        :key="seleccion.id"
        :fila="seleccion"
        :estado-pago="pagoDe(porRendicion, seleccion.id)"
        :pagos="libro.pagosDe(seleccion.id)"
        @cerrar="seleccionId = null"
        @cambiado="alCambiar"
      />
    </div>
  </div>
</template>
