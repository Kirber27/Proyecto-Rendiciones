<script setup lang="ts">
// Cargos sin propuesta: asignar a una rendición, como anticipo a una persona o "No es de rendiciones"
// (porta la segunda tabla de conciliacion() del prototipo). De a 50 por página.
import { computed, reactive, ref } from 'vue'
import type { Asignacion } from '@/domain/asignacion'
import {
  candidatas,
  personasParaAnticipo,
  type MovimientoParaConciliar,
} from '@/domain/conciliacion'
import { clp, fdate, tr } from '@/domain/formato'
import { paginar } from '@/domain/libro'
import type { PersonaOpcion } from '@/types/catalogos'
import type { RendicionParaPago } from '@/types/pagos'

const props = defineProps<{
  cargos: MovimientoParaConciliar[]
  pendientes: RendicionParaPago[]
  asignacion: Asignacion
  nombres: ReadonlyMap<string, string>
  folios: ReadonlyMap<string, string>
  personas: PersonaOpcion[]
  bancoDe: (movimientoId: string) => string
  ocupado: boolean
}>()
const emit = defineEmits<{ aplicar: [movimientoId: string, valor: string] }>()

const pagina = ref(1)
const vista = computed(() => paginar(props.cargos, pagina.value))
const eleccion = reactive<Record<string, string>>({})

const saldo = (r: RendicionParaPago) => props.asignacion.porRendicion.get(r.id)?.saldo ?? r.total
const opcionesRendicion = (m: MovimientoParaConciliar) =>
  candidatas(m, props.pendientes, props.asignacion, props.nombres)
const opcionesPersona = (m: MovimientoParaConciliar) => personasParaAnticipo(m, props.personas)
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <div class="table-wrap">
      <table class="table table-sm mb-0">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Movimiento</th>
            <th class="n">Cargo</th>
            <th>Asignar</th>
            <th><span class="visually-hidden">Aplicar</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in vista.items" :key="m.id">
            <td class="mono">{{ fdate(m.fecha) }}</td>
            <td>
              {{ m.descripcion }}
              <div class="small text-body-secondary">{{ bancoDe(m.id) }}</div>
            </td>
            <td class="n">{{ clp(m.cargo) }}</td>
            <td style="min-width: 280px">
              <select
                v-model="eleccion[m.id]"
                class="form-select form-select-sm"
                :aria-label="`Asignar cargo del ${fdate(m.fecha)} por ${clp(m.cargo)}`"
              >
                <option :value="undefined">Elegir…</option>
                <optgroup label="Pago de rendición">
                  <option v-for="r in opcionesRendicion(m)" :key="r.id" :value="`r:${r.id}`">
                    {{ folios.get(r.id) }} · {{ tr(nombres.get(r.personaId) ?? '') }} ·
                    {{ clp(saldo(r)) }}
                  </option>
                </optgroup>
                <optgroup label="Anticipo a">
                  <option v-for="p in opcionesPersona(m)" :key="p.id" :value="`a:${p.id}`">
                    {{ tr(p.nombre) }}
                  </option>
                </optgroup>
                <option value="x">No es de rendiciones</option>
              </select>
            </td>
            <td>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                :disabled="!eleccion[m.id] || ocupado"
                @click="emit('aplicar', m.id, eleccion[m.id]!)"
              >
                Aplicar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav
      v-if="vista.paginas > 1"
      class="d-flex align-items-center gap-2 small"
      aria-label="Páginas"
    >
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="vista.pagina <= 1"
        @click="pagina = vista.pagina - 1"
      >
        ← Anterior
      </button>
      <span class="text-body-secondary">Página {{ vista.pagina }} de {{ vista.paginas }}</span>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="vista.pagina >= vista.paginas"
        @click="pagina = vista.pagina + 1"
      >
        Siguiente →
      </button>
    </nav>
  </div>
</template>
