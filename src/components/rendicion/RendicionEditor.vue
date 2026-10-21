<script setup lang="ts">
// Editor de rendición (porta editor() del prototipo). Mismo componente para los tres modos:
//   persona → Rendir gastos (sin Cuenta ni C.C.)
//   aprobar → Por aprobar · libro → edición en el libro (con Cuenta y C.C.)
// Los botones los pone cada pantalla en el slot #acciones.
import { computed } from 'vue'
import { centroCostoDeEmpresa } from '@/domain/catalogos'
import { lineaVacia, sumaLineas, totalFormularioDe } from '@/domain/rendicion'
import type { Catalogos } from '@/types/catalogos'
import type { BorradorRendicion, ModoEditor, Respaldo } from '@/types/rendicion'
import CuadreTotales from './CuadreTotales.vue'
import DatosFormulario from './DatosFormulario.vue'
import LineasTable from './LineasTable.vue'
import RespaldosGrid from './RespaldosGrid.vue'

const d = defineModel<BorradorRendicion>({ required: true })
const props = withDefaults(
  defineProps<{
    modo: ModoEditor
    catalogos: Catalogos
    fotos?: Respaldo[]
    solicitanteFijo?: boolean
    /** Problemas de validación a mostrar sobre los botones. */
    problemas?: string[]
  }>(),
  { fotos: () => [], solicitanteFijo: false, problemas: () => [] },
)
const emit = defineEmits<{ quitarFoto: [indice: number] }>()

const conCuentas = computed(() => props.modo !== 'persona')
const suma = computed(() => sumaLineas(d.value))
const totalFormulario = computed(() => totalFormularioDe(d.value))

function agregarLinea() {
  d.value.lineas.push(
    lineaVacia({
      fecha: d.value.fecha,
      centroCostoId: centroCostoDeEmpresa(d.value.empresaId, props.catalogos.empresas),
    }),
  )
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <DatosFormulario v-model="d" :catalogos="catalogos" :solicitante-fijo="solicitanteFijo" />

    <div v-if="d.documentosLeidos != null" class="alert alert-primary mb-0">
      Se encontraron {{ d.documentosLeidos }} documento(s) en las fotos y se armaron
      {{ d.lineas.length }} línea(s) de gasto. Si falta alguna boleta, sácale una foto aparte y
      vuelve a leer.
    </div>
    <div v-if="d.dudas.length" class="alert alert-warning mb-0">
      <b>Revisa esto:</b>
      <ul class="mb-0 ps-3">
        <li v-for="(x, i) in d.dudas" :key="i">{{ x }}</li>
      </ul>
    </div>

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex justify-content-between align-items-center">
          <h2>Gastos</h2>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="agregarLinea">
            <i class="bi bi-plus-lg" aria-hidden="true" /> Agregar línea
          </button>
        </div>
        <LineasTable v-model="d.lineas" :catalogos="catalogos" :con-cuentas="conCuentas" />
        <CuadreTotales :suma="suma" :total-formulario="totalFormulario" />
      </div>
    </section>

    <section v-if="fotos.length" class="card">
      <div class="card-body d-flex flex-column gap-3">
        <h2>Respaldos ({{ fotos.length }})</h2>
        <RespaldosGrid :fotos="fotos" @quitar="emit('quitarFoto', $event)" />
      </div>
    </section>

    <div v-if="problemas.length" class="alert alert-danger mb-0" role="alert">
      <ul class="mb-0 ps-3">
        <li v-for="(p, i) in problemas" :key="i">{{ p }}</li>
      </ul>
    </div>

    <div v-if="$slots.acciones" class="d-flex flex-wrap gap-2 align-items-end">
      <slot name="acciones" />
    </div>
  </div>
</template>
