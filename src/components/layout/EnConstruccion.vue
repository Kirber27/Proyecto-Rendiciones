<script setup lang="ts">
// Placeholder de las pantallas que aún no se implementan.
import EmptyState from '@/components/ui/EmptyState.vue'
import PageTitle from './PageTitle.vue'

defineProps<{ titulo: string; lead?: string; spec: string }>()
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle :titulo="titulo" :lead="lead" />
    <EmptyState icono="bi-cone-striped">
      <span>En construcción · <span class="mono">{{ spec }}</span></span>
    </EmptyState>
  </div>
</template>
