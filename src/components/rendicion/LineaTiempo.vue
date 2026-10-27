<script setup lang="ts">
// Línea de tiempo de una rendición: cada evento con su chip, fecha y nota (Enviada, Observada, Aprobada…).
import AppChip from '@/components/ui/AppChip.vue'
import { fdate } from '@/domain/formato'
import type { EventoRendicion } from '@/types/rendicion'

defineProps<{ eventos: EventoRendicion[] }>()

const hora = (iso: string) => (iso.length > 10 ? iso.slice(11, 16) : '')
</script>

<template>
  <ol class="linea-tiempo list-unstyled mb-0 d-flex flex-column gap-2">
    <li v-for="(e, i) in eventos" :key="i" class="d-flex gap-2 align-items-baseline">
      <span class="mono small text-body-secondary text-nowrap fecha">
        {{ e.fecha ? fdate(e.fecha) : '—' }}
        <span v-if="hora(e.fecha)" class="d-none d-sm-inline">{{ hora(e.fecha) }}</span>
      </span>
      <div class="d-flex flex-column">
        <span><AppChip :estado="e.evento" /></span>
        <span v-if="e.nota" class="small text-body-secondary">{{ e.nota }}</span>
      </div>
    </li>
    <li v-if="!eventos.length" class="small text-body-secondary">Sin movimientos.</li>
  </ol>
</template>

<style scoped>
.fecha {
  min-width: 7.5rem;
}
</style>
