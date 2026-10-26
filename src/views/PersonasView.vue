<script setup lang="ts">
// Personas (spec 06): cuenta corriente por persona, detalle con saldo acumulado y pagos manuales
// (porta vPersonas() del prototipo). Los datos salen del libro (useLibroStore).
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import DetallePersona from '@/components/personas/DetallePersona.vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiTile from '@/components/ui/KpiTile.vue'
import {
  movimientosPersona,
  ordenarPorSaldo,
  pendientesDePago,
  resumenPersonas,
  situacionPersona,
  type PagoCC,
  type RendicionCC,
} from '@/domain/cuentaCorriente'
import { clp, norm, tr } from '@/domain/formato'
import { porAprobarPorPersona } from '@/services/aprobacion'
import { useCatalogosStore } from '@/stores/catalogos'
import { useLibroStore } from '@/stores/libro'
import { usePorAprobarStore } from '@/stores/porAprobar'
import type { CuentaPersona } from '@/types/pagos'

const libro = useLibroStore()
const cat = useCatalogosStore()
const porAprobar = usePorAprobarStore()

const buscar = ref('')
const seleccionId = ref<string | null>(null)
const enRevision = ref(new Map<string, number>())
const mensaje = ref<{ tipo: 'success' | 'danger'; texto: string } | null>(null)
/** Sube después de cada cambio: el detalle se vuelve a montar con los datos nuevos. */
const version = ref(0)

async function cargarEnRevision() {
  try {
    enRevision.value = await porAprobarPorPersona()
  } catch {
    /* la columna queda vacía; se reintenta con el próximo cambio */
  }
}

onMounted(() => {
  void libro.cargar()
  void cargarEnRevision()
})
watch(() => porAprobar.cambios, cargarEnRevision)

const rendiciones = computed<RendicionCC[]>(() =>
  libro.filas
    .filter((f) => f.estado === 'aprobada')
    .map((f) => ({
      id: f.id,
      folio: f.folio,
      personaId: f.personaId,
      nro: f.nro,
      fecha: f.fecha,
      total: f.total,
    })),
)
const pagos = computed<PagoCC[]>(() =>
  libro.pagos.map((p) => ({
    ...p,
    medioPago: cat.catalogos.mediosPago.find((m) => m.id === p.medioPagoId)?.nombre ?? '',
  })),
)
const asignacion = computed(() => libro.asignacion)

/** Nombre por persona: las activas del catálogo y, si se eliminó, el que trae el libro. */
const nombres = computed(() => {
  const m = new Map<string, string>()
  for (const f of libro.filas) m.set(f.personaId, f.personaNombre)
  for (const p of cat.catalogos.personas) m.set(p.id, p.nombre)
  return m
})

const vacia = (personaId: string): CuentaPersona => ({
  personaId,
  rendido: 0,
  pagado: 0,
  saldo: 0,
  anticipos: 0,
  n: 0,
  max: 0,
  faltantes: [],
})

/** Todas las personas con movimientos y las activas (para registrar un anticipo a alguien nuevo). */
const cuentas = computed(() => {
  const ids = new Set([
    ...asignacion.value.porPersona.keys(),
    ...cat.catalogos.personas.map((p) => p.id),
  ])
  return ordenarPorSaldo(
    [...ids].map((id) => ({
      ...(asignacion.value.porPersona.get(id) ?? vacia(id)),
      nombre: nombres.value.get(id) ?? '',
    })),
  )
})
const resumen = computed(() => resumenPersonas(cuentas.value))
const visibles = computed(() => {
  const q = norm(buscar.value)
  return q ? cuentas.value.filter((c) => norm(c.nombre).includes(q)) : cuentas.value
})
const situacion = (c: CuentaPersona) => situacionPersona(c, rendiciones.value, asignacion.value)
const TONO_SITUACION = { 'por-pagar': 'warn', 'por-rendir': 'bad', 'al-dia': 'ok' } as const

const seleccion = computed(() => cuentas.value.find((c) => c.personaId === seleccionId.value))
const movimientos = computed(() =>
  seleccionId.value
    ? movimientosPersona(seleccionId.value, rendiciones.value, pagos.value, asignacion.value)
    : [],
)
const pendientes = computed(() =>
  seleccionId.value ? pendientesDePago(seleccionId.value, rendiciones.value, asignacion.value) : [],
)

async function abrir(id: string) {
  seleccionId.value = id
  mensaje.value = null
  await nextTick()
  document.getElementById('detalle-persona')?.scrollIntoView({ behavior: 'smooth' })
}

async function alCambiar(texto: string) {
  mensaje.value = { tipo: 'success', texto }
  await libro.cargar()
  version.value++
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle
      titulo="Personas"
      lead="Cuenta corriente de cada persona: lo que rindió, lo que se le pagó (incluidos anticipos) y el saldo. Saldo positivo: la empresa le debe. Negativo: tiene fondos por rendir."
    />

    <div class="kpis">
      <KpiTile etiqueta="Empresa debe (total)" :valor="clp(resumen.empresaDebe)" />
      <KpiTile etiqueta="Fondos por rendir (total)" :valor="clp(resumen.fondosPorRendir)" />
      <KpiTile etiqueta="Personas con saldo" :valor="resumen.conSaldo" />
    </div>

    <div class="d-flex align-items-center gap-2">
      <input
        v-model="buscar"
        type="search"
        class="form-control"
        style="max-width: 280px"
        placeholder="Buscar persona"
        aria-label="Buscar persona"
      />
      <span v-if="buscar.trim()" class="small text-body-secondary">
        {{ visibles.length }} de {{ cuentas.length }} personas
      </span>
    </div>

    <div v-if="mensaje" :class="['alert', `alert-${mensaje.tipo}`, 'mb-0']" role="status">
      {{ mensaje.texto }}
    </div>
    <div v-if="libro.error" class="alert alert-danger mb-0">{{ libro.error }}</div>

    <div v-if="libro.cargando && !libro.cargado" class="small text-body-secondary">Cargando…</div>
    <EmptyState v-else-if="!visibles.length">Ninguna persona coincide con la búsqueda.</EmptyState>
    <div v-else class="table-wrap">
      <table class="table table-hover table-click mb-0">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Rendiciones</th>
            <th>Último Nº</th>
            <th>Nº faltantes</th>
            <th class="n">Rendido</th>
            <th class="n">Pagado</th>
            <th class="n">Saldo</th>
            <th>Situación</th>
            <th>Por aprobar</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in visibles"
            :key="c.personaId"
            tabindex="0"
            :class="{ 'fila-sel': seleccionId === c.personaId }"
            @click="abrir(c.personaId)"
            @keydown.enter="abrir(c.personaId)"
          >
            <td>{{ tr(c.nombre) }}</td>
            <td class="mono">{{ c.n }}</td>
            <td class="mono">{{ c.max || '' }}</td>
            <td class="mono small">{{ c.faltantes.join(', ') }}</td>
            <td class="n">{{ clp(c.rendido) }}</td>
            <td class="n">{{ clp(c.pagado) }}</td>
            <td class="n" :class="{ pos: c.saldo > 1, neg: c.saldo < -1 }">{{ clp(c.saldo) }}</td>
            <td>
              <AppChip :tono="TONO_SITUACION[situacion(c).tipo]">{{ situacion(c).texto }}</AppChip>
            </td>
            <td class="mono">{{ enRevision.get(c.personaId) || '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div id="detalle-persona">
      <DetallePersona
        v-if="seleccion"
        :key="`${seleccion.personaId}-${version}`"
        :persona-id="seleccion.personaId"
        :nombre="seleccion.nombre"
        :cuenta="seleccion"
        :movimientos="movimientos"
        :pendientes="pendientes"
        :medios-pago="cat.catalogos.mediosPago"
        @cerrar="seleccionId = null"
        @cambiado="alCambiar"
      />
    </div>
  </div>
</template>
