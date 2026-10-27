<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppChip from '@/components/ui/AppChip.vue'
import { useAuthStore } from '@/stores/auth'
import { usePorAprobarStore } from '@/stores/porAprobar'
import { NOMBRE_ROL } from '@/types/roles'
import AppTabs from './AppTabs.vue'
import ThemeToggle from './ThemeToggle.vue'

const auth = useAuthStore()
const porAprobar = usePorAprobarStore()
const router = useRouter()

async function salir() {
  await auth.salir()
  await router.replace({ name: 'ingresar' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-wrap d-flex flex-wrap align-items-center gap-2 column-gap-4 py-2">
      <RouterLink to="/" class="brand text-reset text-decoration-none">
        <b>Rendiciones Heca</b>
        <small>POE-GLO-FIN-003 · RENDICIÓN DE GASTOS</small>
      </RouterLink>
      <AppTabs :badges="{ aprobar: porAprobar.cantidad }" />
      <div class="ms-auto d-flex align-items-center gap-2">
        <span class="small text-body-secondary d-none d-sm-inline">{{ auth.nombre }}</span>
        <AppChip v-if="auth.persona" tono="info" class="d-none d-md-inline-block">
          {{ NOMBRE_ROL[auth.rol] }}
        </AppChip>
        <ThemeToggle />
        <RouterLink
          to="/clave"
          class="btn btn-sm btn-outline-secondary border-0"
          title="Cambiar contraseña"
          aria-label="Cambiar contraseña"
        >
          <i class="bi bi-key" aria-hidden="true" />
        </RouterLink>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary border-0"
          title="Salir"
          aria-label="Salir"
          @click="salir"
        >
          <i class="bi bi-box-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  </header>
</template>
