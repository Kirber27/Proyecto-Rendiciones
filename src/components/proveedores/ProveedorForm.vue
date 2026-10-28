<script setup lang="ts">
// Agregar proveedor (nombre + RUT). Lo usa la vista Proveedores y, en el formulario de rendición,
// el modal "¿No está? Agrégalo". Valida en pantalla y la base vuelve a validar.
import { ref, useId } from 'vue'
import { tr } from '@/domain/formato'
import { validarProveedor } from '@/domain/proveedores'
import { formatearRut, rutValido } from '@/domain/rut'
import { useProveedoresStore } from '@/stores/proveedores'
import type { Proveedor } from '@/types/proveedores'

const emit = defineEmits<{ creado: [p: Proveedor] }>()

const store = useProveedoresStore()
const id = useId()
const nombre = ref('')
const rut = ref('')
const problemas = ref<string[]>([])
const guardando = ref(false)

/** Al salir del campo, el RUT válido queda con puntos y guion. */
function ordenarRut() {
  if (rutValido(rut.value)) rut.value = formatearRut(rut.value)
}

async function agregar() {
  problemas.value = validarProveedor({ nombre: nombre.value, rut: rut.value }, store.proveedores)
  if (problemas.value.length) return
  guardando.value = true
  try {
    const p = await store.crear({ nombre: tr(nombre.value), rut: rut.value })
    nombre.value = ''
    rut.value = ''
    emit('creado', p)
  } catch (e) {
    problemas.value = [(e as Error).message]
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <form class="d-flex flex-column gap-3" @submit.prevent="agregar">
    <div class="row g-3">
      <div class="col-12 col-md-7">
        <label class="label-caps" :for="`${id}-nombre`">Nombre o razón social</label>
        <input
          :id="`${id}-nombre`"
          v-model="nombre"
          class="form-control"
          placeholder="Ej: Ferretería del Centro SpA"
          autocomplete="off"
        />
      </div>
      <div class="col-12 col-md-5">
        <label class="label-caps" :for="`${id}-rut`">RUT</label>
        <input
          :id="`${id}-rut`"
          v-model="rut"
          class="form-control mono"
          placeholder="12.345.678-5"
          autocomplete="off"
          @blur="ordenarRut"
        />
      </div>
    </div>
    <div v-if="problemas.length" class="alert alert-danger py-2 mb-0 small" role="alert">
      <ul class="mb-0 ps-3">
        <li v-for="p in problemas" :key="p">{{ p }}</li>
      </ul>
    </div>
    <div>
      <button type="submit" class="btn btn-primary" :disabled="guardando">
        {{ guardando ? 'Agregando…' : 'Agregar proveedor' }}
      </button>
    </div>
  </form>
</template>
