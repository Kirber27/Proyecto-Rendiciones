<script setup lang="ts">
// Pestañas del encabezado: salen de las rutas con meta.pestana, filtradas por la función del usuario.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { puedeEntrar } from '@/router/permisos'

const props = defineProps<{
  /** Contadores por nombre de ruta (p. ej. { aprobar: 3 }). */
  badges?: Record<string, number>
}>()

const router = useRouter()
const auth = useAuthStore()

const pestanas = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta.pestana && puedeEntrar(r.meta.roles, auth.rol))
    .sort((a, b) => a.meta.pestana!.orden - b.meta.pestana!.orden)
    .map((r) => {
      const t = r.meta.pestana!.texto
      const nombre = String(r.name)
      return {
        nombre,
        path: r.path,
        texto: typeof t === 'function' ? t(auth.rol) : t,
        badge: props.badges?.[nombre] || 0,
      }
    }),
)
</script>

<template>
  <nav class="nav nav-pills gap-1 flex-wrap" aria-label="Secciones">
    <RouterLink
      v-for="p in pestanas"
      :key="p.nombre"
      :to="p.path"
      class="nav-link d-inline-flex align-items-center gap-2"
      active-class="active"
    >
      {{ p.texto }}
      <span v-if="p.badge" class="badge" :aria-label="`${p.badge} pendientes`">{{ p.badge }}</span>
    </RouterLink>
  </nav>
</template>
