<script setup lang="ts">
// Registrar pago o anticipo manual (porta el formulario de vPersonas() del prototipo).
// Los pagos que vienen de una cartola se registran en Banco.
import { computed, ref, watch } from 'vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { montoSugerido, type PendienteDePago } from '@/domain/cuentaCorriente'
import { clp, fdate, hoy, miles, norm, num, tr } from '@/domain/formato'
import { registrarPago } from '@/services/pagos'
import type { OpcionCatalogo } from '@/types/catalogos'
import { TIPOS_PAGO, type TipoPago } from '@/types/pagos'

const props = defineProps<{
  personaId: string
  nombre: string
  saldo: number
  pendientes: PendienteDePago[]
  mediosPago: OpcionCatalogo[]
}>()
const emit = defineEmits<{ registrado: [mensaje: string] }>()

const MEDIO_DEFECTO = 'banco internacional hgi'

const tipo = ref<TipoPago>('Pago')
const fecha = ref(hoy())
const medioPagoId = ref<number | null>(
  props.mediosPago.find((m) => norm(m.nombre) === MEDIO_DEFECTO)?.id ??
    props.mediosPago[0]?.id ??
    null,
)
const elegidas = ref<string[]>([])
const monto = ref(sugerido())
const descripcion = ref('')
const guardando = ref(false)
const error = ref('')

const vinculable = computed(() => tipo.value !== 'Devolución de la persona')

function sugerido() {
  const sel = props.pendientes.filter((p) => elegidas.value.includes(p.id))
  const n = montoSugerido(props.saldo, sel)
  return n ? miles(n) : ''
}

// Al marcar rendiciones, el monto propuesto es lo que suman.
watch(elegidas, () => (monto.value = sugerido()))
watch(vinculable, (v) => {
  if (!v) elegidas.value = []
})

async function registrar() {
  error.value = ''
  const n = Math.abs(num(monto.value))
  if (!n) {
    document.getElementById('pp-monto')?.focus()
    return
  }
  guardando.value = true
  try {
    await registrarPago({
      personaId: props.personaId,
      tipo: tipo.value,
      fecha: fecha.value,
      medioPagoId: medioPagoId.value,
      monto: n,
      descripcion: descripcion.value,
      rendicionIds: elegidas.value,
    })
    const signo = tipo.value === 'Devolución de la persona' ? -n : n
    emit('registrado', `${tipo.value}: ${clp(signo)} registrado para ${tr(props.nombre)}.`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section class="card">
    <form class="card-body d-flex flex-column gap-3" @submit.prevent="registrar">
      <div>
        <h2>Registrar pago o anticipo</h2>
        <p class="small text-body-secondary mb-0">
          Para pagos que no vienen de una cartola (los de la cartola se registran en Banco). Una
          devolución de la persona se guarda en negativo.
        </p>
      </div>
      <div class="row g-3">
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="label-caps" for="pp-tipo">Tipo</label>
          <select id="pp-tipo" v-model="tipo" class="form-select">
            <option v-for="t in TIPOS_PAGO" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="label-caps" for="pp-fecha">Fecha</label>
          <input id="pp-fecha" v-model="fecha" type="date" class="form-control" required />
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="label-caps" for="pp-medio">Pagado por</label>
          <select id="pp-medio" v-model="medioPagoId" class="form-select">
            <option v-for="m in mediosPago" :key="m.id" :value="m.id">{{ tr(m.nombre) }}</option>
          </select>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="label-caps" for="pp-monto">Monto</label>
          <MoneyInput id="pp-monto" v-model="monto" placeholder="0" />
        </div>
        <div class="col-12">
          <label class="label-caps" for="pp-desc">Descripción (opcional)</label>
          <input
            id="pp-desc"
            v-model="descripcion"
            class="form-control"
            placeholder="Ej.: anticipo viaje a Concepción"
            autocomplete="off"
          />
        </div>
      </div>

      <fieldset v-if="vinculable && pendientes.length">
        <legend class="label-caps">Rendiciones a las que aplica (opcional)</legend>
        <div class="d-flex flex-wrap gap-3">
          <label v-for="p in pendientes" :key="p.id" class="form-check d-flex gap-2 mb-0">
            <input v-model="elegidas" type="checkbox" class="form-check-input" :value="p.id" />
            <span class="small">
              <span class="mono">{{ p.etiqueta }}</span> · {{ fdate(p.fecha) }} ·
              {{ clp(p.saldo) }}
            </span>
          </label>
        </div>
        <p class="small text-body-secondary mb-0 mt-1">
          Sin marcar, el pago se aplica a sus rendiciones pendientes desde la más antigua.
        </p>
      </fieldset>

      <div v-if="error" class="alert alert-danger mb-0" role="alert">{{ error }}</div>
      <div>
        <button type="submit" class="btn btn-primary" :disabled="guardando">
          {{ guardando ? 'Registrando…' : 'Registrar' }}
        </button>
      </div>
    </form>
  </section>
</template>
