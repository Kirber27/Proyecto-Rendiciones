<script setup lang="ts">
// Cuenta corriente de una persona: movimientos con saldo acumulado, eliminar pagos manuales y
// registrar pagos o anticipos (porta el detalle de vPersonas() del prototipo).
import { ref } from 'vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { MovimientoCC, PendienteDePago } from '@/domain/cuentaCorriente'
import { clp, fdate, tr } from '@/domain/formato'
import { eliminarPago } from '@/services/pagos'
import type { OpcionCatalogo } from '@/types/catalogos'
import type { CuentaPersona } from '@/types/pagos'
import FormPago from './FormPago.vue'

defineProps<{
  personaId: string
  nombre: string
  cuenta: CuentaPersona | undefined
  movimientos: MovimientoCC[]
  pendientes: PendienteDePago[]
  mediosPago: OpcionCatalogo[]
}>()
const emit = defineEmits<{ cerrar: []; cambiado: [mensaje: string] }>()

const confirmarId = ref<string | null>(null)
const ocupado = ref(false)
const error = ref('')

async function eliminar(m: MovimientoCC) {
  ocupado.value = true
  error.value = ''
  try {
    await eliminarPago(m.id)
    confirmarId.value = null
    emit('cambiado', `${m.movimiento} de ${clp(m.pagado)} del ${fdate(m.fecha)} eliminado.`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <section class="d-flex flex-column gap-3" aria-label="Cuenta corriente">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <h2 class="mb-0">{{ tr(nombre) }}</h2>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <div class="sum">
          <span><b>Rendido </b>{{ clp(cuenta?.rendido ?? 0) }}</span>
          <span><b>Pagado </b>{{ clp(cuenta?.pagado ?? 0) }}</span>
          <span><b>Saldo </b>{{ clp(cuenta?.saldo ?? 0) }}</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('cerrar')">
          Cerrar
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger mb-0" role="alert">{{ error }}</div>

    <div v-if="movimientos.length" class="table-wrap">
      <table class="table table-sm mb-0">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Movimiento</th>
            <th>Detalle</th>
            <th class="n">Rendido</th>
            <th class="n">Pagado</th>
            <th class="n">Saldo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in movimientos" :key="m.clase + m.id">
            <td class="mono">{{ m.fecha ? fdate(m.fecha) : '—' }}</td>
            <td>{{ m.movimiento }}</td>
            <td class="small text-body-secondary">{{ m.detalle }}</td>
            <td class="n">{{ m.rendido ? clp(m.rendido) : '' }}</td>
            <td class="n">{{ m.pagado ? clp(m.pagado) : '' }}</td>
            <td class="n">{{ clp(m.saldo) }}</td>
            <td>
              <AppChip v-if="m.clase === 'rendicion'" :estado="m.estado" />
              <template v-else-if="m.eliminable">
                <span v-if="confirmarId === m.id" class="d-flex align-items-center gap-1">
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    :disabled="ocupado"
                    @click="eliminar(m)"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    @click="confirmarId = null"
                  >
                    No
                  </button>
                </span>
                <button
                  v-else
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :aria-label="`Eliminar ${m.movimiento} del ${fdate(m.fecha)}`"
                  @click="confirmarId = m.id"
                >
                  Eliminar
                </button>
              </template>
              <span v-else class="small text-body-secondary" title="Se desvincula en Banco"
                >Cartola</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else>Sin rendiciones ni pagos todavía.</EmptyState>

    <FormPago
      :persona-id="personaId"
      :nombre="nombre"
      :saldo="cuenta?.saldo ?? 0"
      :pendientes="pendientes"
      :medios-pago="mediosPago"
      @registrado="emit('cambiado', $event)"
    />
  </section>
</template>
