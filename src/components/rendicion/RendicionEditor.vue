<script setup lang="ts">
// Editor de rendición (porta editor() del prototipo). Mismo componente para los tres modos:
//   persona → Rendir gastos (sin Cuenta ni C.C.)
//   aprobar → Por aprobar · libro → edición en el libro (con Cuenta y C.C.)
// Los botones los pone cada pantalla en el slot #acciones; Rendir gastos pone en #respaldos la zona
// para adjuntar (por defecto se muestran los respaldos, si hay).
import { computed, ref, watch } from 'vue'
import { centroCostoDeEmpresa } from '@/domain/catalogos'
import { lineaVacia, sumaLineas, totalFormularioDe } from '@/domain/rendicion'
import { nrosFaltantes, siguienteNro } from '@/services/rendiciones'
import { useAuthStore } from '@/stores/auth'
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
    respaldos?: Respaldo[]
    solicitanteFijo?: boolean
    /** Problemas de validación a mostrar sobre los botones. */
    problemas?: string[]
  }>(),
  { respaldos: () => [], solicitanteFijo: false, problemas: () => [] },
)
const emit = defineEmits<{ quitarRespaldo: [indice: number] }>()

const auth = useAuthStore()
const conCuentas = computed(() => props.modo !== 'persona')
const suma = computed(() => sumaLineas(d.value))
const totalFormulario = computed(() => totalFormularioDe(d.value))

// Nº correlativo (spec 11, R1): no se escribe. Una rendición guardada conserva su Nº mientras no cambie
// la persona; si no, se muestra el siguiente de la persona elegida (el servidor lo confirma al guardar).
// R1b: si la persona tiene Nº faltantes, se puede elegir uno en vez del Nº por defecto.
let original: { personaId: string | null; nro: string } | null = null
let consulta = 0
/** Estado de la consulta del Nº, para el texto del campo mientras está vacío. */
const estadoNro = ref<'consultando' | 'sin-respuesta' | null>(null)
/** Nº por defecto: el guardado (si conserva la persona) o el siguiente. */
const nroPorDefecto = ref('')
const nroGuardado = ref(false)
const faltantes = ref<number[]>([])
watch(
  () => [d.value, d.value.personaId] as const,
  async ([borrador, personaId], antes) => {
    if (!antes || antes[0] !== borrador) {
      original = borrador.id ? { personaId: borrador.personaId, nro: borrador.nro } : null
    }
    const yo = ++consulta
    const conserva = !!original && personaId === original.personaId
    estadoNro.value = null
    faltantes.value = []
    nroGuardado.value = conserva
    nroPorDefecto.value = conserva ? original!.nro : ''
    borrador.nro = nroPorDefecto.value
    borrador.nroFaltante = false
    if (!personaId) return
    if (!conserva) estadoNro.value = 'consultando'
    // Sin faltantes a la vista se sigue con el Nº por defecto; sin el siguiente, lo asigna el servidor.
    const [siguiente, huecos] = await Promise.allSettled([
      conserva ? Promise.resolve(null) : siguienteNro(personaId),
      nrosFaltantes(personaId),
    ])
    if (yo !== consulta) return
    if (huecos.status === 'fulfilled') faltantes.value = huecos.value
    if (conserva) return
    if (siguiente.status === 'fulfilled' && siguiente.value !== null) {
      nroPorDefecto.value = String(siguiente.value)
      if (!borrador.nroFaltante) borrador.nro = nroPorDefecto.value
      estadoNro.value = null
    } else {
      estadoNro.value = 'sin-respuesta'
    }
  },
  { immediate: true },
)

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
    <DatosFormulario
      v-model="d"
      :catalogos="catalogos"
      :solicitante-fijo="solicitanteFijo"
      :estado-nro="estadoNro"
      :nro-por-defecto="nroPorDefecto"
      :nro-guardado="nroGuardado"
      :nros-faltantes="faltantes"
    />

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex justify-content-between align-items-center">
          <h2>Gastos</h2>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="agregarLinea">
            <i class="bi bi-plus-lg" aria-hidden="true" /> Agregar línea
          </button>
        </div>
        <LineasTable
          v-model="d.lineas"
          :catalogos="catalogos"
          :con-cuentas="conCuentas"
          :rendicion-id="d.id"
          :puede-crear-subcuenta="auth.esTesoreria"
        />
        <CuadreTotales :suma="suma" :total-formulario="totalFormulario" />
      </div>
    </section>

    <section v-if="$slots.respaldos || respaldos.length" class="card">
      <div class="card-body d-flex flex-column gap-3">
        <h2>Respaldos ({{ respaldos.length }})</h2>
        <slot name="respaldos">
          <RespaldosGrid :respaldos="respaldos" @quitar="emit('quitarRespaldo', $event)" />
        </slot>
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
