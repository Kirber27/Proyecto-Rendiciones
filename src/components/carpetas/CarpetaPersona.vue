<script setup lang="ts">
// Carpeta de una persona (porta carpeta() del prototipo): filtros por casillas, tarjetas, devueltas y pagos.
import { computed, ref } from 'vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { filtrarCarpeta, gruposDeCarpeta, itemsCarpeta, type GrupoCarpeta } from '@/domain/carpeta'
import { clp, fdate, tr } from '@/domain/formato'
import type { DatosCarpeta } from '@/services/carpetas'
import type { OpcionCatalogo } from '@/types/catalogos'
import RendicionCard from './RendicionCard.vue'

const props = defineProps<{
  datos: DatosCarpeta
  mediosPago: OpcionCatalogo[]
  /** La persona dueña puede corregir y reenviar sus observadas. */
  puedeCorregir: boolean
}>()
const emit = defineEmits<{ corregir: [id: string] }>()

const seleccion = ref(new Set<GrupoCarpeta>())
const items = computed(() =>
  itemsCarpeta(props.datos.rendiciones, props.datos.asignacion.porRendicion),
)
const grupos = computed(() => gruposDeCarpeta(items.value))
const visibles = computed(() => filtrarCarpeta(items.value, seleccion.value))
const devueltas = computed(() => items.value.filter((i) => i.puedeCorregir))
const pagos = computed(() =>
  props.datos.pagos.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
)
const medio = (id: number | null) => tr(props.mediosPago.find((m) => m.id === id)?.nombre ?? '')

function alternar(g: GrupoCarpeta) {
  const s = new Set(seleccion.value)
  if (s.has(g)) s.delete(g)
  else s.add(g)
  seleccion.value = s
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <section v-if="devueltas.length && puedeCorregir" class="card border-danger-subtle">
      <div class="card-body d-flex flex-column gap-2">
        <h2 class="mb-0">Devueltas para corregir</h2>
        <div
          v-for="d in devueltas"
          :key="d.id"
          class="d-flex flex-wrap justify-content-between align-items-center gap-2"
        >
          <span>Nº {{ d.nro }}: {{ d.notaTesoreria || 'Revisar con tesorería' }}</span>
          <button type="button" class="btn btn-sm btn-primary" @click="emit('corregir', d.id)">
            Corregir y reenviar
          </button>
        </div>
      </div>
    </section>

    <div class="kpis" role="group" aria-label="Filtrar por estado">
      <label
        v-for="g in grupos"
        :key="g.grupo"
        class="kpi d-flex gap-2 align-items-start filtro"
        :class="{ activo: seleccion.has(g.grupo) }"
      >
        <input
          type="checkbox"
          class="form-check-input mt-1"
          :checked="seleccion.has(g.grupo)"
          @change="alternar(g.grupo)"
        />
        <span>
          <small>{{ g.grupo }}</small>
          <b>{{ g.cantidad }}</b>
        </span>
      </label>
    </div>
    <div class="d-flex align-items-center gap-2 small text-body-secondary">
      <span v-if="seleccion.size"
        >Mostrando {{ visibles.length }} de {{ items.length }} rendiciones</span
      >
      <span v-else
        >Todas las rendiciones ({{ items.length }}). Marca uno o más estados para filtrar.</span
      >
      <button
        v-if="seleccion.size"
        type="button"
        class="btn btn-sm btn-outline-secondary"
        @click="seleccion = new Set()"
      >
        Quitar filtros
      </button>
    </div>

    <div v-if="visibles.length" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
      <div v-for="it in visibles" :key="it.id" class="col">
        <RendicionCard
          :item="it"
          :puede-corregir="puedeCorregir"
          @corregir="emit('corregir', $event)"
        />
      </div>
    </div>
    <EmptyState v-else>
      {{
        items.length ? 'Ninguna rendición con los estados marcados.' : 'Sin rendiciones todavía.'
      }}
    </EmptyState>

    <details v-if="pagos.length" class="card">
      <summary class="card-body py-2 small text-body-secondary">
        Pagos y anticipos recibidos ({{ pagos.length }})
      </summary>
      <div class="card-body pt-0">
        <div class="table-wrap">
          <table class="table table-sm mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Pagado por</th>
                <th class="n">Monto</th>
                <th>Rendición</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pagos" :key="p.id">
                <td class="mono">{{ p.fecha ? fdate(p.fecha) : '—' }}</td>
                <td><AppChip :estado="p.tipo" /></td>
                <td>{{ medio(p.medioPagoId) }}</td>
                <td class="n">{{ clp(p.monto) }}</td>
                <td class="mono small">
                  {{
                    p.rendicionIds
                      .map((id) => datos.folios.get(id) ?? '')
                      .filter(Boolean)
                      .join(', ')
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped lang="scss">
.filtro {
  cursor: pointer;
  &.activo {
    border: 2px solid var(--bs-primary);
  }
}
</style>
