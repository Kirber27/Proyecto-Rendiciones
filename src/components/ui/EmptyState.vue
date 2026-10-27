<script setup lang="ts">
defineProps<{ icono?: string }>()
</script>

<template>
  <div class="card empty-state d-flex flex-column align-items-center gap-2">
    <i v-if="icono" :class="['bi', icono, 'fs-3']" aria-hidden="true" />
    <slot />
  </div>
</template>
