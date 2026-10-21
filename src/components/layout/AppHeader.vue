<script setup lang="ts">
import AppTabs from './AppTabs.vue'
import DevRolSelector from './DevRolSelector.vue'
import ThemeToggle from './ThemeToggle.vue'

defineProps<{ badges?: Record<string, number> }>()

const esDev = import.meta.env.DEV
</script>

<template>
  <header class="app-header">
    <div class="app-wrap d-flex flex-wrap align-items-center gap-2 column-gap-4 py-2">
      <RouterLink to="/" class="brand text-reset text-decoration-none">
        <b>Rendiciones Heca</b>
        <small>POE-GLO-FIN-003 · RENDICIÓN DE GASTOS</small>
      </RouterLink>
      <AppTabs :badges="badges" />
      <div class="ms-auto d-flex align-items-center gap-2">
        <DevRolSelector v-if="esDev" />
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>
