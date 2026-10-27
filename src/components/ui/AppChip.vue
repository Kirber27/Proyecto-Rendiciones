<script setup lang="ts">
import { computed } from 'vue'
import { tonoDe, type Tono } from './tonos'

const props = defineProps<{
  /** Texto del chip; si no se pasa `tono`, el color sale del estado. */
  estado?: string | null
  tono?: Tono
}>()

const clase = computed(() => `chip chip-${props.tono ?? tonoDe(props.estado)}`)
</script>

<template>
  <span :class="clase"><slot>{{ estado || '—' }}</slot></span>
</template>
