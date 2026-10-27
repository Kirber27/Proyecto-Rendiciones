<script setup lang="ts">
defineProps<{ titulo: string; lead?: string }>()
</script>

<template>
  <div>
    <h1 class="mb-1">{{ titulo }}</h1>
    <p v-if="lead" class="lead-muted">{{ lead }}</p>
  </div>
</template>
