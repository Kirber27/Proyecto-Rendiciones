<script setup lang="ts">
defineProps<{ etiqueta: string; valor: string | number }>()
</script>

<template>
  <div class="kpi">
    <small>{{ etiqueta }}</small>
    <b>{{ valor }}</b>
  </div>
</template>
