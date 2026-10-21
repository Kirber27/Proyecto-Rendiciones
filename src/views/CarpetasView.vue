<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EnConstruccion from '@/components/layout/EnConstruccion.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()

const titulo = computed(() =>
  route.params.personaId ? 'Carpeta' : auth.esTesoreria ? 'Carpetas por persona' : 'Mis rendiciones',
)
const lead = computed(() =>
  auth.esTesoreria
    ? 'Una carpeta por persona con todas sus rendiciones y cada movimiento: enviada, aprobada, devuelta, rechazada, anulada, eliminada y pagada.'
    : 'Tu carpeta: cada rendición que enviaste y todo lo que pasó con ella. Toca una para ver sus movimientos.',
)
</script>

<template>
  <EnConstruccion :titulo="titulo" :lead="lead" spec="05-carpetas" />
</template>
