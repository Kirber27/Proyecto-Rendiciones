<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { puedeEntrar } from '@/router/permisos'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Si cambia la función del usuario y ya no puede estar en esta pantalla, vuelve al inicio.
watch(
  () => auth.rol,
  (rol) => {
    if (!route.meta.publica && !puedeEntrar(route.meta.roles, rol)) router.replace('/')
  },
)
</script>

<template>
  <RouterView v-if="route.meta.publica" />
  <template v-else>
    <AppHeader />
    <main class="app-wrap pt-4 pb-5">
      <RouterView />
    </main>
  </template>
</template>
