<script setup lang="ts">
// Líneas de gasto editables: tabla en escritorio, una tarjeta por línea en el celular.
// Cuenta y C.C. solo los ve tesorería (`conCuentas`).
import { useEsAncho } from '@/composables/useMediaQuery'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { clp, tr } from '@/domain/formato'
import { cuentaSugerida } from '@/domain/catalogos'
import { lineaVacia, totalLinea } from '@/domain/rendicion'
import type { Catalogos } from '@/types/catalogos'
import { TIPOS_DOCUMENTO, type LineaBorrador } from '@/types/rendicion'

const lineas = defineModel<LineaBorrador[]>({ required: true })
const props = defineProps<{ catalogos: Catalogos; conCuentas: boolean }>()

const esAncho = useEsAncho()

function cambiarSubcuenta(l: LineaBorrador, id: number | null) {
  l.subcuentaId = id
  const c = cuentaSugerida(id, props.catalogos.subcuentas)
  if (c != null) l.cuentaId = c
}

function quitar(i: number) {
  lineas.value.splice(i, 1)
  if (!lineas.value.length) lineas.value.push(lineaVacia())
}

const esFactura = (l: LineaBorrador) => l.tipo === 'Factura'
</script>

<template>
  <!-- Escritorio -->
  <div v-if="esAncho" class="table-wrap">
    <table class="table table-sm table-edit align-middle">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Proveedor</th>
          <th>RUT</th>
          <th>Nº doc.</th>
          <th class="n">Neto</th>
          <th class="n">IVA</th>
          <th class="n">Exento / monto</th>
          <th class="n">Total</th>
          <th>Detalle</th>
          <th>Subcuenta</th>
          <template v-if="conCuentas">
            <th>Cuenta</th>
            <th>C.C.</th>
          </template>
          <th><span class="visually-hidden">Quitar</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(l, i) in lineas" :key="i">
          <td>
            <input
              v-model="l.fecha"
              type="date"
              class="form-control form-control-sm w-fecha"
              :aria-label="`Fecha línea ${i + 1}`"
            />
          </td>
          <td>
            <select
              v-model="l.tipo"
              class="form-select form-select-sm w-tipo"
              :aria-label="`Tipo línea ${i + 1}`"
            >
              <option v-for="t in TIPOS_DOCUMENTO" :key="t" :value="t">{{ t }}</option>
            </select>
          </td>
          <td>
            <input
              v-model="l.proveedor"
              class="form-control form-control-sm w-texto"
              :aria-label="`Proveedor línea ${i + 1}`"
            />
          </td>
          <td>
            <input
              v-model="l.rut"
              class="form-control form-control-sm w-rut"
              :aria-label="`RUT línea ${i + 1}`"
            />
          </td>
          <td>
            <input
              v-model="l.numero"
              class="form-control form-control-sm mono w-doc"
              :aria-label="`Nº documento línea ${i + 1}`"
            />
          </td>
          <td>
            <MoneyInput
              v-model="l.neto"
              class="form-control-sm w-monto"
              :aria-label="`Neto línea ${i + 1}`"
            />
          </td>
          <td>
            <MoneyInput
              v-model="l.iva"
              class="form-control-sm w-monto"
              :aria-label="`IVA línea ${i + 1}`"
            />
          </td>
          <td>
            <MoneyInput
              v-model="l.exento"
              class="form-control-sm w-monto"
              :aria-label="`Exento línea ${i + 1}`"
            />
          </td>
          <td class="n">{{ clp(totalLinea(l)) }}</td>
          <td>
            <input
              v-model="l.detalle"
              class="form-control form-control-sm w-texto"
              :aria-label="`Detalle línea ${i + 1}`"
            />
          </td>
          <td>
            <select
              :value="l.subcuentaId"
              class="form-select form-select-sm w-sub"
              :aria-label="`Subcuenta línea ${i + 1}`"
              @change="
                cambiarSubcuenta(
                  l,
                  ($event.target as HTMLSelectElement).value
                    ? Number(($event.target as HTMLSelectElement).value)
                    : null,
                )
              "
            >
              <option value="">Elegir…</option>
              <option v-for="s in catalogos.subcuentas" :key="s.id" :value="s.id">
                {{ tr(s.nombre) }}
              </option>
            </select>
          </td>
          <template v-if="conCuentas">
            <td>
              <select
                v-model="l.cuentaId"
                class="form-select form-select-sm w-cuenta"
                :aria-label="`Cuenta línea ${i + 1}`"
              >
                <option :value="null">—</option>
                <option v-for="c in catalogos.cuentas" :key="c.id" :value="c.id">
                  {{ tr(c.nombre) }}
                </option>
              </select>
            </td>
            <td>
              <select
                v-model="l.centroCostoId"
                class="form-select form-select-sm w-cc"
                :aria-label="`C.C. línea ${i + 1}`"
              >
                <option :value="null">—</option>
                <option v-for="c in catalogos.centrosCosto" :key="c.id" :value="c.id">
                  {{ tr(c.nombre) }}
                </option>
              </select>
            </td>
          </template>
          <td>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :aria-label="`Quitar línea ${i + 1}`"
              @click="quitar(i)"
            >
              ×
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Celular: una tarjeta por línea -->
  <div v-else class="d-flex flex-column gap-2">
    <div v-for="(l, i) in lineas" :key="i" class="card linea-card">
      <div class="card-body d-flex flex-column gap-2 p-2">
        <div class="d-flex justify-content-between align-items-center">
          <b>Gasto {{ i + 1 }}</b>
          <div class="d-flex align-items-center gap-2">
            <span class="amt fs-6">{{ clp(totalLinea(l)) }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :aria-label="`Quitar gasto ${i + 1}`"
              @click="quitar(i)"
            >
              ×
            </button>
          </div>
        </div>
        <div class="row g-2">
          <div class="col-6">
            <label class="label-caps"
              >Fecha<input v-model="l.fecha" type="date" class="form-control form-control-sm"
            /></label>
          </div>
          <div class="col-6">
            <label class="label-caps"
              >Tipo
              <select v-model="l.tipo" class="form-select form-select-sm">
                <option v-for="t in TIPOS_DOCUMENTO" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
          </div>
          <div class="col-12">
            <label class="label-caps"
              >Proveedor<input v-model="l.proveedor" class="form-control form-control-sm"
            /></label>
          </div>
          <div class="col-6">
            <label class="label-caps"
              >RUT<input v-model="l.rut" class="form-control form-control-sm"
            /></label>
          </div>
          <div class="col-6">
            <label class="label-caps"
              >Nº doc.<input v-model="l.numero" class="form-control form-control-sm mono"
            /></label>
          </div>
          <template v-if="esFactura(l)">
            <div class="col-4">
              <label class="label-caps"
                >Neto<MoneyInput v-model="l.neto" class="form-control-sm"
              /></label>
            </div>
            <div class="col-4">
              <label class="label-caps"
                >IVA<MoneyInput v-model="l.iva" class="form-control-sm"
              /></label>
            </div>
            <div class="col-4">
              <label class="label-caps"
                >Exento<MoneyInput v-model="l.exento" class="form-control-sm"
              /></label>
            </div>
          </template>
          <div v-else class="col-12">
            <label class="label-caps"
              >Monto<MoneyInput v-model="l.exento" class="form-control-sm"
            /></label>
          </div>
          <div class="col-12">
            <label class="label-caps"
              >Detalle<input v-model="l.detalle" class="form-control form-control-sm"
            /></label>
          </div>
          <div class="col-12">
            <label class="label-caps"
              >Subcuenta
              <select
                :value="l.subcuentaId"
                class="form-select form-select-sm"
                @change="
                  cambiarSubcuenta(
                    l,
                    ($event.target as HTMLSelectElement).value
                      ? Number(($event.target as HTMLSelectElement).value)
                      : null,
                  )
                "
              >
                <option value="">Elegir…</option>
                <option v-for="s in catalogos.subcuentas" :key="s.id" :value="s.id">
                  {{ tr(s.nombre) }}
                </option>
              </select>
            </label>
          </div>
          <template v-if="conCuentas">
            <div class="col-7">
              <label class="label-caps"
                >Cuenta
                <select v-model="l.cuentaId" class="form-select form-select-sm">
                  <option :value="null">—</option>
                  <option v-for="c in catalogos.cuentas" :key="c.id" :value="c.id">
                    {{ tr(c.nombre) }}
                  </option>
                </select>
              </label>
            </div>
            <div class="col-5">
              <label class="label-caps"
                >C.C.
                <select v-model="l.centroCostoId" class="form-select form-select-sm">
                  <option :value="null">—</option>
                  <option v-for="c in catalogos.centrosCosto" :key="c.id" :value="c.id">
                    {{ tr(c.nombre) }}
                  </option>
                </select>
              </label>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.table-edit td {
  padding: 4px;
}
.w-fecha {
  width: 138px;
}
.w-tipo {
  width: 128px;
}
.w-texto {
  width: 170px;
}
.w-rut {
  width: 110px;
}
.w-doc {
  width: 150px;
}
.w-monto {
  width: 104px;
}
.w-sub {
  width: 200px;
}
.w-cuenta {
  width: 160px;
}
.w-cc {
  width: 100px;
}

// En las tarjetas la etiqueta envuelve al control: el texto queda como título chico.
.linea-card label.label-caps {
  display: block;
  width: 100%;
  margin: 0;

  :deep(.form-control),
  .form-control,
  .form-select {
    margin-top: 2px;
    text-transform: none;
    letter-spacing: normal;
    font-size: 13px;
    color: var(--bs-body-color);
  }
}
</style>
