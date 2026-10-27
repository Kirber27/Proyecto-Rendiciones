<script setup lang="ts">
import { computed } from 'vue'
import { useTheme, type PreferenciaTema } from '@/composables/useTheme'

const { preferencia, siguiente } = useTheme()

const INFO: Record<PreferenciaTema, { icono: string; texto: string }> = {
  sistema: { icono: 'bi-circle-half', texto: 'Tema: según el sistema' },
  claro: { icono: 'bi-sun', texto: 'Tema: claro' },
  oscuro: { icono: 'bi-moon-stars', texto: 'Tema: oscuro' },
}
const actual = computed(() => INFO[preferencia.value])
</script>

<template>
  <button
    type="button"
    class="btn btn-sm btn-outline-secondary border-0"
    :title="actual.texto"
    :aria-label="`${actual.texto}. Cambiar tema`"
    @click="siguiente"
  >
    <i :class="['bi', actual.icono]" aria-hidden="true" />
  </button>
</template>
