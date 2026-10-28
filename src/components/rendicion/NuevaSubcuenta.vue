<script setup lang="ts">
// Nueva subcuenta desde el selector de una línea (spec 11, R6; solo tesorería): nombre y cuenta
// sugerida opcional. Si ya existe una igual, ofrece elegir esa.
import { ref, useId } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { validarSubcuentaNueva } from '@/domain/catalogos'
import { tr } from '@/domain/formato'
import { useCatalogosStore } from '@/stores/catalogos'
import type { Catalogos, Subcuenta } from '@/types/catalogos'

const props = defineProps<{ catalogos: Pick<Catalogos, 'subcuentas' | 'cuentas'> }>()
const emit = defineEmits<{ elegida: [s: Subcuenta]; cerrar: [] }>()

const cat = useCatalogosStore()
const id = useId()
const nombre = ref('')
const cuentaId = ref<number | null>(null)
const problema = ref('')
const existente = ref<Subcuenta | null>(null)
const guardando = ref(false)

async function crear() {
  const r = validarSubcuentaNueva(nombre.value, props.catalogos.subcuentas)
  problema.value = r?.problema ?? ''
  existente.value = r?.existente ?? null
  if (r) return
  guardando.value = true
  try {
    emit('elegida', await cat.agregarSubcuenta(tr(nombre.value), cuentaId.value))
  } catch (e) {
    problema.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <AppModal titulo="Nueva subcuenta" @cerrar="emit('cerrar')">
    <form class="d-flex flex-column gap-3" @submit.prevent="crear">
      <p class="small text-body-secondary mb-0">
        Queda en la lista para todos. Revisa que no exista con otro nombre: así cuadran las tablas
        del Excel.
      </p>
      <div>
        <label class="label-caps" :for="`${id}-nombre`">Nombre</label>
        <input
          :id="`${id}-nombre`"
          v-model="nombre"
          class="form-control"
          placeholder="Ej: Peajes urbanos"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="label-caps" :for="`${id}-cuenta`">Cuenta sugerida (opcional)</label>
        <select :id="`${id}-cuenta`" v-model="cuentaId" class="form-select">
          <option :value="null">—</option>
          <option v-for="c in catalogos.cuentas" :key="c.id" :value="c.id">
            {{ tr(c.nombre) }}
          </option>
        </select>
      </div>
      <div
        v-if="problema"
        class="alert alert-danger py-2 mb-0 small d-flex flex-wrap align-items-center gap-2"
        role="alert"
      >
        <span>{{ problema }}</span>
        <button
          v-if="existente"
          type="button"
          class="btn btn-sm btn-outline-primary"
          @click="emit('elegida', existente)"
        >
          Usar «{{ tr(existente.nombre) }}»
        </button>
      </div>
      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary" :disabled="guardando">
          {{ guardando ? 'Agregando…' : 'Agregar subcuenta' }}
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="emit('cerrar')">
          Cancelar
        </button>
      </div>
    </form>
  </AppModal>
</template>
