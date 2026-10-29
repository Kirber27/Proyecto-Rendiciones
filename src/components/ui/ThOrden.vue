<script setup lang="ts" generic="C extends string">
// Encabezado de tabla ordenable (spec 12, R3): texto + ícono; clic, Enter o Espacio emite `ordenar`.
// El que está ordenado lleva aria-sort.
import { computed } from 'vue'

const props = defineProps<{
  columna: C
  orden: { columna: C; dir: 'asc' | 'desc' } | null
  /** Columna numérica: alineada a la derecha. */
  numero?: boolean
}>()
const emit = defineEmits<{ ordenar: [columna: C] }>()

const dir = computed(() => (props.orden?.columna === props.columna ? props.orden.dir : null))
</script>

<template>
  <th
    :class="{ n: numero }"
    :aria-sort="dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined"
  >
    <button type="button" class="th-orden" @click="emit('ordenar', columna)">
      <slot />
      <i
        :class="[
          'bi',
          dir === 'asc' ? 'bi-sort-up' : dir === 'desc' ? 'bi-sort-down' : 'bi-arrow-down-up th-orden-off',
        ]"
        aria-hidden="true"
      />
    </button>
  </th>
</template>
