<script setup lang="ts">
// Placeholder: el ingreso por correo con código se implementa en la tarea 1.8.
import EmptyState from '@/components/ui/EmptyState.vue'
</script>

<template>
  <div class="mx-auto py-5" style="max-width: 420px">
    <div class="brand mb-4">
      <b>Rendiciones Heca</b>
      <small>POE-GLO-FIN-003 · RENDICIÓN DE GASTOS</small>
    </div>
    <EmptyState icono="bi-envelope">
      <span>Ingreso con tu correo · en construcción (<span class="mono">tarea 1.8</span>)</span>
      <RouterLink to="/" class="btn btn-sm btn-outline-secondary">Volver</RouterLink>
    </EmptyState>
  </div>
</template>
