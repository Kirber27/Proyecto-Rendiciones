<script setup lang="ts">
// Paginación de una tabla (spec 12, R4): rango, Anterior / Siguiente y "Mostrar [N] por página".
// Envuelve en el celular. Cambiar el tamaño lo decide la pantalla (normalmente vuelve a la página 1).
import { useId } from 'vue'

defineProps<{
  pagina: number
  paginas: number
  total: number
  desde: number
  hasta: number
  tamano: number
  tamanos: readonly number[]
  /** Qué se cuenta: "rendiciones", "proveedores"… */
  etiqueta: string
}>()
const emit = defineEmits<{ 'update:pagina': [n: number]; 'update:tamano': [n: number] }>()

const id = useId()
</script>

<template>
  <nav class="paginacion d-flex flex-wrap align-items-center gap-2 small" :aria-label="`Páginas de ${etiqueta}`">
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      :disabled="pagina <= 1"
      @click="emit('update:pagina', pagina - 1)"
    >
      ← Anterior
    </button>
    <span class="text-body-secondary" data-test="rango">
      {{ desde }}–{{ hasta }} de {{ total }} {{ etiqueta }} · Página {{ pagina }} de {{ paginas }}
    </span>
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      :disabled="pagina >= paginas"
      @click="emit('update:pagina', pagina + 1)"
    >
      Siguiente →
    </button>
    <div class="d-flex align-items-center gap-2 ms-sm-auto">
      <label :for="`${id}-tamano`" class="text-body-secondary text-nowrap">Mostrar</label>
      <select
        :id="`${id}-tamano`"
        :value="tamano"
        class="form-select form-select-sm w-auto"
        @change="emit('update:tamano', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="t in tamanos" :key="t" :value="t">{{ t }}</option>
      </select>
      <span class="text-body-secondary text-nowrap">por página</span>
    </div>
  </nav>
</template>
