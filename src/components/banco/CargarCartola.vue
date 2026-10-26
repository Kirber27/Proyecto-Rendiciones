<script setup lang="ts">
// Cargar cartola (porta leerCartola() y mapper() del prototipo): banco, archivo, mapeo de columnas,
// resumen, vista previa y aviso de movimientos que ya están en otra cartola.
import { computed, ref, watch } from 'vue'
import {
  adivinarColumnas,
  construirMovimientos,
  detectarEncabezados,
  resumenMovimientos,
  separarDuplicados,
} from '@/domain/cartola'
import { clp, fdate, norm, tr } from '@/domain/formato'
import { guardarCartola, leerFilasArchivo } from '@/services/banco'
import type { OpcionCatalogo } from '@/types/catalogos'
import type {
  CampoCartola,
  MapeoCartola,
  MovimientoCartola,
  MovimientoGuardado,
} from '@/types/banco'

const props = defineProps<{
  mediosPago: OpcionCatalogo[]
  /** Movimientos de las cartolas ya guardadas (para avisar duplicados). */
  existentes: MovimientoGuardado[]
}>()
const emit = defineEmits<{ guardada: [mensaje: string] }>()

const CAMPOS: [CampoCartola, string][] = [
  ['fecha', 'Fecha'],
  ['descripcion', 'Descripción'],
  ['cargo', 'Cargo'],
  ['abono', 'Abono'],
  ['monto', 'Monto (si viene en una sola columna)'],
  ['referencia', 'Nº operación'],
]

const medioPagoId = ref<number | null>(null)
// Banco por defecto apenas llegan los catálogos.
watch(
  () => props.mediosPago,
  (ms) => {
    medioPagoId.value ??=
      ms.find((m) => norm(m.nombre) === 'banco internacional hgi')?.id ?? ms[0]?.id ?? null
  },
  { immediate: true },
)
const archivo = ref<{
  nombre: string
  encabezados: string[]
  datos: readonly (readonly unknown[])[]
} | null>(null)
const mapa = ref<MapeoCartola | null>(null)
const leyendo = ref(false)
const guardando = ref(false)
const error = ref('')
const input = ref<HTMLInputElement | null>(null)

type ConIdx = MovimientoCartola & { idx: number }
const movimientos = computed<ConIdx[]>(() =>
  archivo.value && mapa.value
    ? construirMovimientos(archivo.value.datos, mapa.value).map((m, idx) => ({ ...m, idx }))
    : [],
)
const resumen = computed(() => resumenMovimientos(movimientos.value))
const separados = computed(() => {
  const r = separarDuplicados(movimientos.value, props.existentes)
  return { nuevos: r.nuevos as ConIdx[], duplicados: r.duplicados as ConIdx[] }
})

async function elegir(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  error.value = ''
  leyendo.value = true
  try {
    const filas = await leerFilasArchivo(f)
    const { encabezados, datos } = detectarEncabezados(filas)
    archivo.value = { nombre: f.name, encabezados, datos }
    mapa.value = adivinarColumnas(encabezados)
  } catch (err) {
    archivo.value = null
    error.value = (err as Error).message
  } finally {
    leyendo.value = false
  }
}

function cancelar() {
  archivo.value = null
  mapa.value = null
  error.value = ''
}

async function guardar() {
  if (!archivo.value) return
  const { nuevos, duplicados } = separados.value
  if (!nuevos.length) {
    error.value = 'Todos los movimientos de este archivo ya están en otra cartola.'
    return
  }
  guardando.value = true
  error.value = ''
  try {
    await guardarCartola(archivo.value.nombre, medioPagoId.value, nuevos)
    const dup = duplicados.length
      ? ` ${duplicados.length} ya estaban en otra cartola y no se guardaron.`
      : ''
    emit(
      'guardada',
      `Cartola guardada: ${nuevos.length} movimientos.${dup} Abajo están las coincidencias encontradas.`,
    )
    cancelar()
  } catch (err) {
    error.value = `No se pudo guardar la cartola: ${(err as Error).message}`
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section class="card">
    <div class="card-body d-flex flex-column gap-3">
      <h2>Cargar cartola</h2>
      <div class="d-flex flex-wrap align-items-end gap-2">
        <div style="min-width: 240px">
          <label class="label-caps" for="cartola-banco">Banco</label>
          <select id="cartola-banco" v-model="medioPagoId" class="form-select">
            <option v-for="m in mediosPago" :key="m.id" :value="m.id">{{ tr(m.nombre) }}</option>
          </select>
        </div>
        <input
          ref="input"
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          data-test="archivo"
          @change="elegir"
        />
        <button type="button" class="btn btn-primary" :disabled="leyendo" @click="input?.click()">
          <i class="bi bi-upload" aria-hidden="true" />
          {{ leyendo ? 'Leyendo…' : 'Elegir archivo' }}
        </button>
      </div>

      <div v-if="error" class="alert alert-danger mb-0" role="alert">{{ error }}</div>

      <template v-if="archivo && mapa">
        <p class="small text-body-secondary mb-0">
          Archivo: {{ archivo.nombre }}. Revisa que cada dato apunte a la columna correcta.
        </p>
        <div class="row g-3">
          <div v-for="[campo, etiqueta] in CAMPOS" :key="campo" class="col-12 col-sm-6 col-lg-4">
            <label class="label-caps" :for="`col-${campo}`">{{ etiqueta }}</label>
            <select :id="`col-${campo}`" v-model.number="mapa[campo]" class="form-select">
              <option :value="-1">(no tiene)</option>
              <option v-for="(h, i) in archivo.encabezados" :key="i" :value="i">
                {{ h || `Columna ${i + 1}` }}
              </option>
            </select>
          </div>
        </div>

        <p class="small mb-0" data-test="resumen">
          {{ resumen.movimientos }} movimientos · {{ resumen.cargos }} cargos por
          {{ clp(resumen.totalCargos) }}.
        </p>
        <div v-if="separados.duplicados.length" class="alert alert-warning mb-0">
          {{ separados.duplicados.length }} movimiento(s) ya están en otra cartola (misma fecha,
          monto y glosa). No se guardarán de nuevo.
        </div>

        <div v-if="movimientos.length" class="table-wrap">
          <table class="table table-sm mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th class="n">Cargo</th>
                <th class="n">Abono</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movimientos.slice(0, 5)" :key="m.idx">
                <td class="mono">{{ fdate(m.fecha) }}</td>
                <td>{{ m.descripcion }}</td>
                <td class="n">{{ m.cargo ? clp(m.cargo) : '' }}</td>
                <td class="n">{{ m.abono ? clp(m.abono) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!movimientos.length || guardando"
            @click="guardar"
          >
            {{ guardando ? 'Guardando…' : 'Guardar cartola' }}
          </button>
          <button type="button" class="btn btn-outline-secondary" @click="cancelar">
            Cancelar
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
