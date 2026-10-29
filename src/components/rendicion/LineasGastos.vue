<script setup lang="ts">
// Gastos de la rendición (spec 12, R1): un colapsable por gasto con sus campos como formulario, igual en
// todos los anchos (sin tabla ni scroll horizontal). Título "Gasto N · Proveedor" + total; marca de
// problema; "Agregar gasto" al final abre el nuevo. Cuenta y C.C. solo los ve tesorería (`conCuentas`).
import { computed, nextTick, ref, toRaw, useId, watch } from 'vue'
import { useDocumentoRepetido } from '@/composables/useDocumentoRepetido'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { clp, num, tr } from '@/domain/formato'
import { cuentaSugerida } from '@/domain/catalogos'
import {
  gastosConProblemas,
  ivaLinea,
  lineaConDatos,
  lineaVacia,
  totalLinea,
} from '@/domain/rendicion'
import { formatearRut } from '@/domain/rut'
import type { Catalogos, Subcuenta } from '@/types/catalogos'
import type { Proveedor } from '@/types/proveedores'
import { TIPOS_DOCUMENTO, type LineaBorrador } from '@/types/rendicion'
import NuevaSubcuenta from './NuevaSubcuenta.vue'
import ProveedorSelect from './ProveedorSelect.vue'

const lineas = defineModel<LineaBorrador[]>({ required: true })
const props = withDefaults(
  defineProps<{
    catalogos: Catalogos
    conCuentas: boolean
    /** Rendición que se edita (no choca consigo misma al revisar el Nº de documento). */
    rendicionId?: string
    /** Tesorería puede agregar una subcuenta desde el selector. */
    puedeCrearSubcuenta?: boolean
    /** Problemas de validación del formulario ("Gasto N: …"): marcan y abren esos gastos. */
    problemas?: string[]
  }>(),
  { rendicionId: undefined, problemas: () => [] },
)
const emit = defineEmits<{ agregar: [] }>()

const id = useId()
const { errorDocumento } = useDocumentoRepetido(lineas, () => props.rendicionId)

// ---------- Abiertos ----------
// Por la línea misma (no por índice), para que sobreviva a quitar y renumerar.
const abiertos = ref(new Set<LineaBorrador>())
const abierto = (l: LineaBorrador) => abiertos.value.has(l)
function alternar(l: LineaBorrador) {
  if (!abiertos.value.delete(l)) abiertos.value.add(l)
}

const conProblemas = computed(() => gastosConProblemas(props.problemas))
const tieneProblema = (i: number) => conProblemas.value.has(i) || !!errorDocumento(i)

// Formulario nuevo o cargado: un solo gasto → abierto; varios → cerrados salvo los con problemas.
// Mismo arreglo con un gasto más (Agregar gasto) → solo el nuevo abierto, con el foco en su fecha.
watch(
  () => [lineas.value, lineas.value.length] as const,
  async ([actual, n], antes) => {
    if (antes && antes[0] === actual) {
      if (n > antes[1]) {
        abiertos.value = new Set([actual[n - 1]!])
        await nextTick()
        document.getElementById(`${id}-${n - 1}-fecha`)?.focus()
      }
      return
    }
    abiertos.value = new Set(
      actual.length === 1 ? actual : actual.filter((_, i) => tieneProblema(i)),
    )
  },
  { immediate: true },
)
// Al intentar enviar o guardar con problemas, se abren esos gastos.
watch(conProblemas, (s) => s.forEach((i) => lineas.value[i] && abiertos.value.add(lineas.value[i]!)))

// Clave estable por línea para el v-for (los índices cambian al quitar).
const claves = new WeakMap<object, number>()
let siguienteClave = 0
function clave(l: LineaBorrador) {
  const raw = toRaw(l)
  if (!claves.has(raw)) claves.set(raw, siguienteClave++)
  return claves.get(raw)!
}

// ---------- Campos ----------
function cambiarSubcuenta(l: LineaBorrador, id: number | null, sugerida?: number | null) {
  l.subcuentaId = id
  const c = sugerida !== undefined ? sugerida : cuentaSugerida(id, props.catalogos.subcuentas)
  if (c != null) l.cuentaId = c
}

/** Valor de la opción "+ Nueva subcuenta…" (spec 11, R6). */
const NUEVA = '__nueva'
/** Línea que espera su subcuenta nueva (modal abierto). */
const lineaNuevaSubcuenta = ref<LineaBorrador | null>(null)

function elegirSubcuenta(l: LineaBorrador, select: HTMLSelectElement) {
  if (select.value === NUEVA) {
    // El selector vuelve a mostrar la subcuenta que tenía hasta que se cree la nueva.
    select.value = l.subcuentaId == null ? '' : String(l.subcuentaId)
    lineaNuevaSubcuenta.value = l
    return
  }
  cambiarSubcuenta(l, select.value ? Number(select.value) : null)
}

function subcuentaCreada(s: Subcuenta) {
  if (lineaNuevaSubcuenta.value) cambiarSubcuenta(lineaNuevaSubcuenta.value, s.id, s.cuentaSugeridaId)
  lineaNuevaSubcuenta.value = null
}

// IVA (spec 11, R4): no se escribe. Se recalcula al cambiar el neto o el tipo; una línea guardada
// conserva el suyo mientras no se toquen (el historial puede traer otro redondeo).
function cambiarNeto(l: LineaBorrador, neto: LineaBorrador['neto']) {
  l.neto = neto
  l.iva = ivaLinea(l)
}

function cambiarTipo(l: LineaBorrador, tipo: string) {
  l.tipo = tipo as LineaBorrador['tipo']
  l.iva = ivaLinea(l)
}

/** Al elegir el proveedor, la línea toma su nombre y su RUT (el RUT no se escribe). */
function elegirProveedor(l: LineaBorrador, p: Proveedor) {
  l.proveedorId = p.id
  l.proveedor = p.nombre
  l.rut = p.rut
}

/** Neto e IVA: en facturas (o en una línea antigua que ya trae neto). */
const conNeto = (l: LineaBorrador) => l.tipo === 'Factura' || num(l.neto) !== 0

// ---------- Quitar ----------
/** Gasto que espera confirmación para quitarse (tiene datos). */
const porQuitar = ref<LineaBorrador | null>(null)

function pedirQuitar(l: LineaBorrador, i: number) {
  if (lineaConDatos(l)) porQuitar.value = l
  else quitar(i)
}

function quitar(i: number) {
  porQuitar.value = null
  lineas.value.splice(i, 1)
  if (!lineas.value.length) lineas.value.push(lineaVacia())
}
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <div class="accordion d-flex flex-column gap-2">
      <div
        v-for="(l, i) in lineas"
        :key="clave(l)"
        :class="['accordion-item gasto', tieneProblema(i) && 'gasto-problema']"
        data-test="gasto"
      >
        <h3 class="accordion-header">
          <button
            type="button"
            :class="['accordion-button', !abierto(l) && 'collapsed']"
            :aria-expanded="abierto(l)"
            :aria-controls="`${id}-${i}-cuerpo`"
            @click="alternar(l)"
          >
            <i
              v-if="tieneProblema(i)"
              class="bi bi-exclamation-circle text-danger"
              aria-label="Tiene problemas"
            />
            <span class="gasto-titulo">
              Gasto {{ i + 1 }} · {{ tr(l.proveedor) || 'Sin proveedor' }}
            </span>
            <span class="amt gasto-total">{{ clp(totalLinea(l)) }}</span>
          </button>
        </h3>
        <div v-show="abierto(l)" :id="`${id}-${i}-cuerpo`" class="accordion-body">
          <div class="row g-3">
            <div class="col-6 col-md-3">
              <label class="label-caps" :for="`${id}-${i}-fecha`">Fecha</label>
              <input
                :id="`${id}-${i}-fecha`"
                v-model="l.fecha"
                type="date"
                class="form-control"
                :aria-label="`Fecha gasto ${i + 1}`"
              />
            </div>
            <div class="col-6 col-md-3">
              <label class="label-caps" :for="`${id}-${i}-tipo`">Tipo</label>
              <select
                :id="`${id}-${i}-tipo`"
                :value="l.tipo"
                class="form-select"
                :aria-label="`Tipo gasto ${i + 1}`"
                @change="cambiarTipo(l, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="t in TIPOS_DOCUMENTO" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="label-caps" :for="`${id}-${i}-prov`">Proveedor</label>
              <ProveedorSelect
                :input-id="`${id}-${i}-prov`"
                :proveedor-id="l.proveedorId"
                :texto="l.proveedor"
                :etiqueta="`Proveedor gasto ${i + 1}`"
                @elegir="elegirProveedor(l, $event)"
              />
            </div>
            <div class="col-6 col-md-3">
              <label class="label-caps" :for="`${id}-${i}-rut`">RUT</label>
              <input
                :id="`${id}-${i}-rut`"
                :value="formatearRut(l.rut)"
                class="form-control mono bg-body-tertiary"
                readonly
                :aria-label="`RUT gasto ${i + 1}`"
              />
            </div>
            <div class="col-6 col-md-3">
              <label class="label-caps" :for="`${id}-${i}-doc`">Nº doc.</label>
              <input
                :id="`${id}-${i}-doc`"
                v-model="l.numero"
                :class="['form-control mono', errorDocumento(i) && 'is-invalid']"
                :aria-label="`Nº documento gasto ${i + 1}`"
                :aria-invalid="!!errorDocumento(i)"
                :aria-describedby="errorDocumento(i) ? `${id}-${i}-doc-error` : undefined"
              />
              <div v-if="errorDocumento(i)" :id="`${id}-${i}-doc-error`" class="invalid-feedback">
                {{ errorDocumento(i) }}
              </div>
            </div>
            <template v-if="conNeto(l)">
              <div class="col-6 col-md-3">
                <label class="label-caps" :for="`${id}-${i}-neto`">Neto</label>
                <MoneyInput
                  :id="`${id}-${i}-neto`"
                  :model-value="l.neto"
                  :aria-label="`Neto gasto ${i + 1}`"
                  @update:model-value="cambiarNeto(l, $event)"
                />
              </div>
              <div class="col-6 col-md-3">
                <label class="label-caps" :for="`${id}-${i}-iva`">IVA</label>
                <MoneyInput
                  :id="`${id}-${i}-iva`"
                  :model-value="l.iva"
                  class="bg-body-tertiary"
                  readonly
                  title="Neto × 19 %: se calcula solo"
                  :aria-label="`IVA gasto ${i + 1}`"
                />
              </div>
            </template>
            <div class="col-6 col-md-3">
              <label class="label-caps" :for="`${id}-${i}-exento`">
                {{ conNeto(l) ? 'Exento' : 'Monto' }}
              </label>
              <MoneyInput
                :id="`${id}-${i}-exento`"
                v-model="l.exento"
                :aria-label="`${conNeto(l) ? 'Exento' : 'Monto'} gasto ${i + 1}`"
              />
            </div>
            <div class="col-6 col-md-3">
              <label class="label-caps" :for="`${id}-${i}-otros`">Imp. especial</label>
              <MoneyInput
                :id="`${id}-${i}-otros`"
                v-model="l.otros"
                placeholder="Opcional"
                :aria-label="`Impuesto especial gasto ${i + 1}`"
              />
            </div>
            <div class="col-12 col-md-6">
              <label class="label-caps" :for="`${id}-${i}-detalle`">Detalle</label>
              <input
                :id="`${id}-${i}-detalle`"
                v-model="l.detalle"
                class="form-control"
                :aria-label="`Detalle gasto ${i + 1}`"
              />
            </div>
            <div class="col-12 col-md-6">
              <label class="label-caps" :for="`${id}-${i}-sub`">Subcuenta</label>
              <select
                :id="`${id}-${i}-sub`"
                :value="l.subcuentaId"
                class="form-select"
                :aria-label="`Subcuenta gasto ${i + 1}`"
                @change="elegirSubcuenta(l, $event.target as HTMLSelectElement)"
              >
                <option value="">Elegir…</option>
                <option v-for="s in catalogos.subcuentas" :key="s.id" :value="s.id">
                  {{ tr(s.nombre) }}
                </option>
                <option v-if="puedeCrearSubcuenta" :value="NUEVA">+ Nueva subcuenta…</option>
              </select>
            </div>
            <template v-if="conCuentas">
              <div class="col-7 col-md-4">
                <label class="label-caps" :for="`${id}-${i}-cuenta`">Cuenta</label>
                <select
                  :id="`${id}-${i}-cuenta`"
                  v-model="l.cuentaId"
                  class="form-select"
                  :aria-label="`Cuenta gasto ${i + 1}`"
                >
                  <option :value="null">—</option>
                  <option v-for="c in catalogos.cuentas" :key="c.id" :value="c.id">
                    {{ tr(c.nombre) }}
                  </option>
                </select>
              </div>
              <div class="col-5 col-md-2">
                <label class="label-caps" :for="`${id}-${i}-cc`">C.C.</label>
                <select
                  :id="`${id}-${i}-cc`"
                  v-model="l.centroCostoId"
                  class="form-select"
                  :aria-label="`C.C. gasto ${i + 1}`"
                >
                  <option :value="null">—</option>
                  <option v-for="c in catalogos.centrosCosto" :key="c.id" :value="c.id">
                    {{ tr(c.nombre) }}
                  </option>
                </select>
              </div>
            </template>
          </div>

          <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 mt-3">
            <template v-if="porQuitar === l">
              <span class="small">¿Quitar el gasto {{ i + 1 }}?</span>
              <button type="button" class="btn btn-sm btn-danger" @click="quitar(i)">Quitar</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="porQuitar = null">
                Cancelar
              </button>
            </template>
            <button
              v-else
              type="button"
              class="btn btn-sm btn-outline-danger"
              :aria-label="`Quitar gasto ${i + 1}`"
              @click="pedirQuitar(l, i)"
            >
              <i class="bi bi-trash" aria-hidden="true" /> Quitar gasto
            </button>
          </div>
        </div>
      </div>
    </div>

    <div>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('agregar')">
        <i class="bi bi-plus-lg" aria-hidden="true" /> Agregar gasto
      </button>
    </div>
  </div>

  <NuevaSubcuenta
    v-if="lineaNuevaSubcuenta"
    :catalogos="catalogos"
    @elegida="subcuentaCreada"
    @cerrar="lineaNuevaSubcuenta = null"
  />
</template>

<style scoped lang="scss">
// Cada gasto es una tarjeta propia (no un acordeón pegado): bordes y radio completos.
.gasto {
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  overflow: hidden;

  .accordion-header {
    margin: 0;
  }
  .accordion-button {
    gap: 0.5rem;
    min-height: 48px;
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    font-weight: 600;
    // Sin sombra al estar abierto (ui.md: bordes de 1px, sin sombras)
    box-shadow: none;
  }
  .gasto-titulo {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gasto-total {
    margin-left: auto;
    font-weight: 500;
    white-space: nowrap;
  }
}
.gasto-problema {
  border-color: var(--bs-danger);
}
</style>
