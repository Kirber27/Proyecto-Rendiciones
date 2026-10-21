<script setup lang="ts">
// TEMPORAL (solo desarrollo): cambia la función del usuario para probar pestañas y permisos
// mientras no existe la autenticación. Se elimina en la tarea 1.8.
import { useAuthStore } from '@/stores/auth'
import { NOMBRE_ROL, ROLES, type Rol } from '@/types/roles'

const auth = useAuthStore()
</script>

<template>
  <select
    class="form-select form-select-sm w-auto"
    aria-label="Rol de prueba (solo desarrollo)"
    title="Rol de prueba (solo desarrollo)"
    :value="auth.rol"
    @change="auth.fijarRol(($event.target as HTMLSelectElement).value as Rol)"
  >
    <option v-for="r in ROLES" :key="r" :value="r">Dev: {{ NOMBRE_ROL[r] }}</option>
  </select>
</template>
