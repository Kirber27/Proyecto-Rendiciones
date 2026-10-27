<script setup lang="ts">
import { computed } from 'vue'
import AppChip from '@/components/ui/AppChip.vue'
import { clp } from '@/domain/formato'
import { cuadra } from '@/domain/rendicion'

const props = defineProps<{ suma: number; totalFormulario: number | null }>()

const estado = computed(() => cuadra(props.suma, props.totalFormulario))
</script>

<template>
  <div class="sum" aria-live="polite">
    <span><b>Suma de gastos </b>{{ clp(suma) }}</span>
    <span><b>Formulario </b>{{ totalFormulario == null ? '—' : clp(totalFormulario) }}</span>
    <AppChip v-if="estado == null" tono="muted">Sin total del formulario</AppChip>
    <AppChip v-else-if="estado" estado="Cuadra" />
    <AppChip v-else tono="bad">Diferencia {{ clp(suma - (totalFormulario ?? 0)) }}</AppChip>
  </div>
</template>
