<script setup lang="ts">
// Banco (spec 07): carga de cartolas, propuestas de conciliación, asignación manual, deshacer y
// cartolas cargadas (porta vBanco() y conciliacion() del prototipo).
import { computed, onMounted, ref } from 'vue'
import CargarCartola from '@/components/banco/CargarCartola.vue'
import CargosSinAsignar from '@/components/banco/CargosSinAsignar.vue'
import PropuestasConciliacion from '@/components/banco/PropuestasConciliacion.vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import { asignacionDePropuesta, cargosResueltos, leerEleccionManual } from '@/domain/banco'
import type { Propuesta } from '@/domain/conciliacion'
import { clp, fdate, tr } from '@/domain/formato'
import {
  confirmarConciliacion,
  deshacerAsignacion,
  eliminarCartola,
  ignorarMovimiento,
} from '@/services/banco'
import { useBancoStore } from '@/stores/banco'
import { useCatalogosStore } from '@/stores/catalogos'
import { useLibroStore } from '@/stores/libro'

const banco = useBancoStore()
const libro = useLibroStore()
const cat = useCatalogosStore()

const mensaje = ref<{ tipo: 'success' | 'danger'; texto: string } | null>(null)
const ocupado = ref(false)
const confirmarCartola = ref<string | null>(null)

onMounted(banco.cargar)

const medio = (id: number | null) =>
  tr(cat.catalogos.mediosPago.find((m) => m.id === id)?.nombre ?? '')
const cartolaPorMovimiento = computed(
  () => new Map(banco.guardados.map((m) => [m.id, m.cartolaId])),
)
const medioPorCartola = computed(
  () => new Map(banco.cartolas.map((c) => [c.id, medio(c.medioPagoId)])),
)
const bancoDe = (movimientoId: string) =>
  medioPorCartola.value.get(cartolaPorMovimiento.value.get(movimientoId) ?? '') ?? ''
const personaDeRendicion = computed(() => new Map(libro.filas.map((f) => [f.id, f.personaId])))

const resueltos = computed(() => cargosResueltos(banco.movimientos))
const pagoDeMovimiento = computed(
  () => new Map(libro.pagos.filter((p) => p.movimientoId).map((p) => [p.movimientoId!, p])),
)
function describirResuelto(movimientoId: string, ignorado: boolean) {
  if (ignorado) return 'No es de rendiciones'
  const p = pagoDeMovimiento.value.get(movimientoId)
  if (!p) return ''
  const folios = p.rendicionIds.map((id) => banco.folios.get(id)).filter(Boolean)
  return [p.tipo, tr(banco.nombres.get(p.personaId) ?? ''), folios.join(', ')]
    .filter(Boolean)
    .join(' · ')
}

async function ejecutar(fn: () => Promise<string>) {
  ocupado.value = true
  mensaje.value = null
  try {
    const texto = await fn()
    await banco.cargar()
    mensaje.value = { tipo: 'success', texto }
  } catch (e) {
    mensaje.value = { tipo: 'danger', texto: (e as Error).message }
    await banco.cargar()
  } finally {
    ocupado.value = false
  }
}

function confirmar(propuestas: Propuesta[]) {
  void ejecutar(async () => {
    const n = await confirmarConciliacion(propuestas.map(asignacionDePropuesta))
    return `${n} movimiento(s) conciliado(s).`
  })
}

function aplicar(movimientoId: string, valor: string) {
  const a = leerEleccionManual(movimientoId, valor)
  if (!a) return
  void ejecutar(async () => {
    if (a === 'ignorar') {
      await ignorarMovimiento(movimientoId, true)
      return 'Cargo marcado como "No es de rendiciones".'
    }
    await confirmarConciliacion([a])
    return a.tipo === 'anticipo' ? 'Anticipo registrado.' : 'Pago registrado.'
  })
}

function deshacer(movimientoId: string) {
  void ejecutar(async () => {
    await deshacerAsignacion(movimientoId)
    return 'Asignación deshecha: el cargo volvió a quedar sin asignar.'
  })
}

function eliminar(id: string) {
  void ejecutar(async () => {
    const n = await eliminarCartola(id)
    confirmarCartola.value = null
    return n ? `Cartola eliminada junto con ${n} pago(s) creados desde ella.` : 'Cartola eliminada.'
  })
}

async function alGuardar(texto: string) {
  await banco.cargar()
  mensaje.value = { tipo: 'success', texto }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle
      titulo="Banco"
      lead="Sube la cartola en Excel o CSV tal como la descargas del banco. La página encuentra qué cargos pagan rendiciones, cuáles calzan con pagos ya registrados y cuáles son anticipos."
    />

    <CargarCartola
      :medios-pago="cat.catalogos.mediosPago"
      :existentes="banco.guardados"
      @guardada="alGuardar"
    />

    <div v-if="mensaje" :class="['alert', `alert-${mensaje.tipo}`, 'mb-0']" role="status">
      {{ mensaje.texto }}
    </div>
    <div v-if="banco.error" class="alert alert-danger mb-0">{{ banco.error }}</div>

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <h2>Conciliación</h2>
        <div v-if="banco.cargando && !banco.cartolas.length" class="small text-body-secondary">
          Cargando…
        </div>
        <p v-else-if="!banco.cartolas.length" class="small text-body-secondary mb-0">
          Carga una cartola para buscar los pagos de las rendiciones pendientes.
        </p>
        <template v-else>
          <p v-if="!banco.resultado.propuestas.length" class="small text-body-secondary mb-0">
            No hay coincidencias automáticas nuevas.
          </p>
          <PropuestasConciliacion
            v-else
            :propuestas="banco.resultado.propuestas"
            :asignacion="libro.asignacion"
            :pagos="libro.pagos"
            :nombres="banco.nombres"
            :folios="banco.folios"
            :persona-de-rendicion="personaDeRendicion"
            :banco-de="bancoDe"
            :ocupado="ocupado"
            @confirmar="confirmar"
          />

          <template v-if="banco.resultado.sinAsignar.length">
            <div>
              <h2>Cargos sin asignar ({{ banco.resultado.sinAsignar.length }})</h2>
              <p class="small text-body-secondary mb-0">
                Asigna cada cargo a una rendición, regístralo como anticipo a una persona o márcalo
                como ajeno a rendiciones.
              </p>
            </div>
            <CargosSinAsignar
              :cargos="banco.resultado.sinAsignar"
              :pendientes="banco.resultado.pendientes"
              :asignacion="libro.asignacion"
              :nombres="banco.nombres"
              :folios="banco.folios"
              :personas="cat.catalogos.personas"
              :banco-de="bancoDe"
              :ocupado="ocupado"
              @aplicar="aplicar"
            />
          </template>
        </template>
      </div>
    </section>

    <details v-if="resueltos.length" class="card">
      <summary class="card-body py-2 small text-body-secondary">
        Cargos asignados o ignorados ({{ resueltos.length }})
      </summary>
      <div class="card-body pt-0">
        <div class="table-wrap">
          <table class="table table-sm mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th class="n">Cargo</th>
                <th>Asignado a</th>
                <th><span class="visually-hidden">Deshacer</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in resueltos.slice(0, 200)" :key="m.id">
                <td class="mono">{{ fdate(m.fecha) }}</td>
                <td>{{ m.descripcion }}</td>
                <td class="n">{{ clp(m.cargo) }}</td>
                <td class="small">{{ describirResuelto(m.id, m.ignorado) }}</td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    :disabled="ocupado"
                    @click="deshacer(m.id)"
                  >
                    Deshacer
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="resueltos.length > 200" class="small text-body-secondary mb-0 mt-2">
          Se muestran los 200 más recientes de {{ resueltos.length }}.
        </p>
      </div>
    </details>

    <details v-if="banco.resumen.length" class="card">
      <summary class="card-body py-2 small text-body-secondary">
        Cartolas cargadas ({{ banco.resumen.length }})
      </summary>
      <div class="card-body pt-0">
        <div class="table-wrap">
          <table class="table table-sm mb-0">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Banco</th>
                <th>Cargada</th>
                <th>Movimientos</th>
                <th>Cargos conciliados</th>
                <th><span class="visually-hidden">Eliminar</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in banco.resumen" :key="c.id">
                <td>{{ c.nombreArchivo }}</td>
                <td>{{ medio(c.medioPagoId) }}</td>
                <td class="mono">{{ fdate(c.creadoEn) }}</td>
                <td class="mono">{{ c.movimientos }}</td>
                <td class="mono">{{ c.conciliados }} de {{ c.cargos }}</td>
                <td>
                  <span v-if="confirmarCartola === c.id" class="d-flex align-items-center gap-1">
                    <span class="small text-body-secondary"
                      >Se borran también los pagos creados desde ella.</span
                    >
                    <button
                      type="button"
                      class="btn btn-sm btn-danger"
                      :disabled="ocupado"
                      @click="eliminar(c.id)"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary"
                      @click="confirmarCartola = null"
                    >
                      No
                    </button>
                  </span>
                  <button
                    v-else
                    type="button"
                    class="btn btn-sm btn-outline-danger"
                    @click="confirmarCartola = c.id"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </details>
  </div>
</template>
