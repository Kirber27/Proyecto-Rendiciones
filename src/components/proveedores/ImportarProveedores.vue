<script setup lang="ts">
// Importar proveedores desde Excel (solo tesorería): archivo → columnas → vista previa → agregar.
// Solo se agregan los nuevos; los que ya están (mismo RUT) no se tocan.
import { computed, ref } from 'vue'
import { formatearRut } from '@/domain/rut'
import { leerFilasProveedores, previsualizarImportacion } from '@/domain/proveedores'
import { leerArchivoProveedores } from '@/services/proveedores'
import { useProveedoresStore } from '@/stores/proveedores'
import type { MapeoProveedores } from '@/types/proveedores'

const emit = defineEmits<{ importado: [mensaje: string] }>()

const CAMPOS: [keyof MapeoProveedores, string][] = [
  ['nombre', 'Nombre o razón social'],
  ['rut', 'RUT'],
  ['dv', 'Dígito verificador (si viene aparte)'],
]

const store = useProveedoresStore()
const archivo = ref<{
  nombre: string
  encabezados: string[]
  datos: readonly (readonly unknown[])[]
  primeraFila: number
} | null>(null)
const mapeo = ref<MapeoProveedores | null>(null)
const leyendo = ref(false)
const guardando = ref(false)
const error = ref('')
const input = ref<HTMLInputElement | null>(null)

const vista = computed(() =>
  archivo.value && mapeo.value
    ? previsualizarImportacion(
        archivo.value.datos,
        mapeo.value,
        store.proveedores,
        archivo.value.primeraFila,
      )
    : null,
)
const conOtroNombre = computed(() => vista.value?.existentes.filter((e) => e.distinto) ?? [])

async function elegir(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  error.value = ''
  leyendo.value = true
  try {
    const r = leerFilasProveedores(await leerArchivoProveedores(f))
    archivo.value = {
      nombre: f.name,
      encabezados: r.encabezados,
      datos: r.datos,
      primeraFila: r.primeraFila,
    }
    mapeo.value = r.mapeo
  } catch (err) {
    cancelar()
    error.value = (err as Error).message
  } finally {
    leyendo.value = false
  }
}

function cancelar() {
  archivo.value = null
  mapeo.value = null
  error.value = ''
}

async function agregar() {
  const nuevos = vista.value?.nuevos ?? []
  if (!nuevos.length) return
  guardando.value = true
  error.value = ''
  try {
    const n = await store.importar(nuevos)
    const ya = vista.value?.existentes.length ?? 0
    const err = vista.value?.errores.length ?? 0
    emit(
      'importado',
      `${n} proveedor(es) agregado(s).` +
        (ya ? ` ${ya} ya estaban registrados.` : '') +
        (err ? ` ${err} fila(s) con error no se cargaron.` : ''),
    )
    cancelar()
  } catch (err) {
    error.value = `No se pudo importar: ${(err as Error).message}`
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section class="card">
    <div class="card-body d-flex flex-column gap-3">
      <div>
        <h2 class="mb-1">Importar desde Excel</h2>
        <p class="small text-body-secondary mb-0">
          Un archivo con una fila por proveedor: nombre o razón social y RUT. Solo se agregan los
          que no están; los ya registrados no cambian.
        </p>
      </div>
      <div>
        <input
          ref="input"
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          data-test="archivo-proveedores"
          @change="elegir"
        />
        <button
          type="button"
          class="btn btn-outline-primary"
          :disabled="leyendo"
          @click="input?.click()"
        >
          <i class="bi bi-file-earmark-excel" aria-hidden="true" />
          {{ leyendo ? 'Leyendo…' : 'Elegir archivo' }}
        </button>
      </div>

      <div v-if="error" class="alert alert-danger mb-0" role="alert">{{ error }}</div>

      <template v-if="archivo && mapeo && vista">
        <p class="small text-body-secondary mb-0">
          Archivo: {{ archivo.nombre }}. Revisa que cada dato apunte a la columna correcta.
        </p>
        <div class="row g-3">
          <div v-for="[campo, etiqueta] in CAMPOS" :key="campo" class="col-12 col-sm-6 col-lg-4">
            <label class="label-caps" :for="`imp-${campo}`">{{ etiqueta }}</label>
            <select :id="`imp-${campo}`" v-model.number="mapeo[campo]" class="form-select">
              <option :value="-1">(no tiene)</option>
              <option v-for="(h, i) in archivo.encabezados" :key="i" :value="i">
                {{ h || `Columna ${i + 1}` }}
              </option>
            </select>
          </div>
        </div>

        <p class="small mb-0" data-test="resumen-importacion">
          <b>{{ vista.nuevos.length }}</b> nuevo(s) · {{ vista.existentes.length }} ya registrado(s)
          · {{ vista.errores.length }} con error.
        </p>

        <div v-if="vista.nuevos.length" class="table-wrap">
          <table class="table table-sm mb-0">
            <caption class="small">
              Se agregarán (primeros 5)
            </caption>
            <thead>
              <tr>
                <th>Fila</th>
                <th>Nombre</th>
                <th>RUT</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in vista.nuevos.slice(0, 5)" :key="n.fila">
                <td class="mono">{{ n.fila }}</td>
                <td>{{ n.nombre }}</td>
                <td class="mono">{{ formatearRut(n.rut) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="conOtroNombre.length" class="alert alert-info mb-0 small">
          {{ conOtroNombre.length }} RUT ya registrado(s) con otro nombre; se mantiene el registrado:
          <ul class="mb-0 ps-3">
            <li v-for="e in conOtroNombre.slice(0, 10)" :key="e.fila">
              Fila {{ e.fila }}: «{{ e.nombre }}» → queda «{{ e.registrado }}»
            </li>
          </ul>
        </div>

        <div v-if="vista.errores.length" class="alert alert-warning mb-0 small">
          {{ vista.errores.length }} fila(s) no se cargarán:
          <ul class="mb-0 ps-3">
            <li v-for="e in vista.errores.slice(0, 20)" :key="e.fila">
              Fila {{ e.fila }}<template v-if="e.nombre"> ({{ e.nombre }})</template>:
              {{ e.motivo }}
            </li>
          </ul>
          <span v-if="vista.errores.length > 20">… y {{ vista.errores.length - 20 }} más.</span>
        </div>

        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!vista.nuevos.length || guardando"
            @click="agregar"
          >
            {{
              guardando
                ? 'Agregando…'
                : vista.nuevos.length
                  ? `Agregar ${vista.nuevos.length} proveedor(es)`
                  : 'Nada nuevo que agregar'
            }}
          </button>
          <button type="button" class="btn btn-outline-secondary" @click="cancelar">
            Cancelar
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
