<script setup lang="ts">
// Encabezado del formulario POE-GLO-FIN-003: solicitante, Nº, fecha, empresa, fondo y total escrito.
import { computed, useId } from 'vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { tr } from '@/domain/formato'
import type { Catalogos } from '@/types/catalogos'
import type { BorradorRendicion } from '@/types/rendicion'

const d = defineModel<BorradorRendicion>({ required: true })
const props = defineProps<{
  catalogos: Catalogos
  /** El solicitante queda fijo (persona vinculada que no es tesorería). */
  solicitanteFijo?: boolean
  /** Consulta del Nº correlativo: en curso o sin respuesta (el Nº lo asigna igual el servidor). */
  estadoNro?: 'consultando' | 'sin-respuesta' | null
  /** Nº que corresponde sin elegir nada: el siguiente o el que la rendición ya tiene. */
  nroPorDefecto?: string
  /** El Nº por defecto es el guardado de la rendición (no el siguiente). */
  nroGuardado?: boolean
  /** Faltantes del correlativo de la persona: se pueden elegir en vez del Nº por defecto. */
  nrosFaltantes?: number[]
}>()

const id = useId()

const etiquetaPorDefecto = computed(() =>
  props.nroPorDefecto
    ? `${props.nroPorDefecto} · ${props.nroGuardado ? 'actual' : 'siguiente'}`
    : props.estadoNro === 'consultando'
      ? 'Buscando…'
      : 'Se asigna al enviar',
)

function elegirNro(valor: string) {
  d.value.nro = valor
  d.value.nroFaltante = valor !== (props.nroPorDefecto ?? '')
}
</script>

<template>
  <section class="card">
    <div class="card-body d-flex flex-column gap-3">
      <h2>Datos del formulario</h2>
      <div class="row g-3">
        <div class="col-12 col-sm-6 col-lg-4">
          <label class="label-caps" :for="`${id}-sol`">Solicitante</label>
          <select
            :id="`${id}-sol`"
            v-model="d.personaId"
            class="form-select"
            :disabled="solicitanteFijo"
          >
            <option :value="null">Elegir…</option>
            <option v-for="p in catalogos.personas" :key="p.id" :value="p.id">
              {{ tr(p.nombre) }}
            </option>
          </select>
        </div>
        <div class="col-6 col-lg-4">
          <label class="label-caps" :for="`${id}-nro`">Nº rendición</label>
          <template v-if="nrosFaltantes?.length">
            <select
              :id="`${id}-nro`"
              class="form-select mono"
              :value="d.nroFaltante ? d.nro : (nroPorDefecto ?? '')"
              :aria-describedby="`${id}-nro-faltan`"
              @change="elegirNro(($event.target as HTMLSelectElement).value)"
            >
              <option :value="nroPorDefecto ?? ''">{{ etiquetaPorDefecto }}</option>
              <option v-for="n in nrosFaltantes" :key="n" :value="String(n)">
                {{ n }} · faltante
              </option>
            </select>
            <div :id="`${id}-nro-faltan`" class="form-text">
              <i class="bi bi-info-circle" aria-hidden="true" />
              Faltan en el correlativo: {{ nrosFaltantes.join(', ') }}. Elige uno para cargar esa
              rendición.
            </div>
          </template>
          <input
            v-else
            :id="`${id}-nro`"
            :value="d.nro"
            class="form-control mono bg-body-tertiary"
            readonly
            :placeholder="
              !d.personaId
                ? 'Elige el solicitante'
                : estadoNro === 'sin-respuesta'
                  ? 'Se asigna al enviar'
                  : estadoNro === 'consultando'
                    ? 'Buscando…'
                    : ''
            "
            title="Correlativo de la persona: se asigna solo"
          />
        </div>
        <div class="col-6 col-lg-4">
          <label class="label-caps" :for="`${id}-fecha`">Fecha</label>
          <input :id="`${id}-fecha`" v-model="d.fecha" class="form-control" type="date" />
        </div>
        <div class="col-12 col-sm-6 col-lg-4">
          <label class="label-caps" :for="`${id}-emp`">Empresa</label>
          <select :id="`${id}-emp`" v-model="d.empresaId" class="form-select">
            <option :value="null">—</option>
            <option v-for="e in catalogos.empresas" :key="e.id" :value="e.id">
              {{ tr(e.nombre) }}
            </option>
          </select>
        </div>
        <div class="col-12 col-sm-6 col-lg-4">
          <label class="label-caps" :for="`${id}-fondo`">Tipo de fondo</label>
          <input :id="`${id}-fondo`" v-model="d.fondo" class="form-control" autocomplete="off" />
        </div>
        <div class="col-12 col-sm-6 col-lg-4">
          <label class="label-caps" :for="`${id}-total`">Total del formulario</label>
          <MoneyInput :id="`${id}-total`" v-model="d.totalFormulario" />
        </div>
      </div>
    </div>
  </section>
</template>
