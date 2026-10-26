<script setup lang="ts">
// Propuestas de conciliación (porta la tabla de conciliacion() del prototipo): casilla, cargo, a qué
// corresponde y por qué coincide. Las "solo por monto" llegan sin marcar.
import { computed, ref, watch } from 'vue'
import AppChip from '@/components/ui/AppChip.vue'
import type { Asignacion } from '@/domain/asignacion'
import type { Propuesta } from '@/domain/conciliacion'
import { clp, fdate, tr } from '@/domain/formato'
import type { Pago } from '@/services/pagos'

const props = defineProps<{
  propuestas: Propuesta[]
  asignacion: Asignacion
  pagos: Pago[]
  nombres: ReadonlyMap<string, string>
  folios: ReadonlyMap<string, string>
  personaDeRendicion: ReadonlyMap<string, string>
  /** Banco de la cartola de cada movimiento. */
  bancoDe: (movimientoId: string) => string
  ocupado: boolean
}>()
const emit = defineEmits<{ confirmar: [propuestas: Propuesta[]] }>()

const seleccion = ref(new Set<string>())
/** Propuestas ya mostradas: al recalcular no se vuelve a marcar lo que tesorería desmarcó. */
const vistas = new Set<string>()
watch(
  () => props.propuestas,
  (ps) => {
    const s = new Set([...seleccion.value].filter((id) => ps.some((p) => p.movimiento.id === id)))
    for (const p of ps) {
      const id = p.movimiento.id
      if (vistas.has(id)) continue
      vistas.add(id)
      if (p.marcada) s.add(id)
    }
    seleccion.value = s
  },
  { immediate: true },
)

function alternar(id: string, marcada: boolean) {
  const s = new Set(seleccion.value)
  if (marcada) s.add(id)
  else s.delete(id)
  seleccion.value = s
}

const elegidas = computed(() =>
  props.propuestas.filter((p) => seleccion.value.has(p.movimiento.id)),
)
const pagoPorId = computed(() => new Map(props.pagos.map((p) => [p.id, p])))
const nombre = (personaId: string | undefined) => tr(props.nombres.get(personaId ?? '') ?? '')
const saldo = (id: string) => props.asignacion.porRendicion.get(id)?.saldo ?? 0
const tono = (p: Propuesta) => (p.marcada ? 'ok' : 'warn')
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <div class="table-wrap">
      <table class="table table-sm mb-0">
        <thead>
          <tr>
            <th><span class="visually-hidden">Confirmar</span></th>
            <th>Fecha</th>
            <th>Movimiento</th>
            <th class="n">Cargo</th>
            <th>Corresponde a</th>
            <th>Coincide por</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in propuestas" :key="p.movimiento.id">
            <td>
              <input
                type="checkbox"
                class="form-check-input"
                :aria-label="`Confirmar cargo del ${fdate(p.movimiento.fecha)} por ${clp(p.movimiento.cargo)}`"
                :checked="seleccion.has(p.movimiento.id)"
                @change="alternar(p.movimiento.id, ($event.target as HTMLInputElement).checked)"
              />
            </td>
            <td class="mono">{{ fdate(p.movimiento.fecha) }}</td>
            <td>
              {{ p.movimiento.descripcion }}
              <div class="small text-body-secondary">
                {{ bancoDe(p.movimiento.id) }}
              </div>
            </td>
            <td class="n">{{ clp(p.movimiento.cargo) }}</td>
            <td>
              <template v-if="p.tipo === 'pago-existente'">
                Pago registrado a {{ nombre(pagoPorId.get(p.pagoId)?.personaId) }} el
                {{ fdate(pagoPorId.get(p.pagoId)?.fecha) }}
              </template>
              <template v-else>
                <div v-for="id in p.rendicionIds" :key="id">
                  {{ nombre(personaDeRendicion.get(id)) }} · {{ folios.get(id) }} ·
                  <span class="mono">{{ clp(saldo(id)) }}</span>
                </div>
              </template>
            </td>
            <td>
              <AppChip :tono="tono(p)">{{ p.confianza }}</AppChip>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!elegidas.length || ocupado"
        @click="emit('confirmar', elegidas)"
      >
        Confirmar seleccionados ({{ elegidas.length }})
      </button>
    </div>
  </div>
</template>
