<script setup lang="ts">
// Encabezado del formulario POE-GLO-FIN-003: solicitante, Nº, fecha, empresa, fondo y total escrito.
import { useId } from 'vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { tr } from '@/domain/formato'
import type { Catalogos } from '@/types/catalogos'
import type { BorradorRendicion } from '@/types/rendicion'

const d = defineModel<BorradorRendicion>({ required: true })
defineProps<{
  catalogos: Catalogos
  /** El solicitante queda fijo (persona vinculada que no es tesorería). */
  solicitanteFijo?: boolean
}>()

const id = useId()
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
          <input
            :id="`${id}-nro`"
            :value="d.nro"
            class="form-control mono bg-body-tertiary"
            readonly
            :placeholder="d.personaId ? '…' : 'Elige el solicitante'"
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
