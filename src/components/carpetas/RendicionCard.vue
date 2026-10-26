<script setup lang="ts">
// Tarjeta de una rendición en la carpeta: Nº, fecha, estado, monto y su línea de tiempo desplegable.
import { ref } from 'vue'
import LineaTiempo from '@/components/rendicion/LineaTiempo.vue'
import AppChip from '@/components/ui/AppChip.vue'
import type { ItemCarpeta } from '@/domain/carpeta'
import { clp, fdate } from '@/domain/formato'

defineProps<{ item: ItemCarpeta; puedeCorregir?: boolean }>()
const emit = defineEmits<{ corregir: [id: string] }>()

const abierta = ref(false)
</script>

<template>
  <div class="card h-100">
    <div class="card-body d-flex flex-column gap-1">
      <button
        type="button"
        class="btn btn-link p-0 text-reset text-decoration-none d-flex justify-content-between align-items-baseline gap-2 text-start"
        :aria-expanded="abierta"
        @click="abierta = !abierta"
      >
        <b>Nº {{ item.nro }} · {{ fdate(item.fecha) }}</b>
        <AppChip :estado="item.actual" />
      </button>
      <div class="amt">{{ clp(item.total) }}</div>
      <div class="small text-body-secondary">
        {{ item.etiqueta
        }}<template v-if="item.respaldos"> · {{ item.respaldos }} respaldo(s)</template>
      </div>
      <div v-if="item.puedeCorregir && item.notaTesoreria" class="small text-danger-emphasis">
        {{ item.notaTesoreria }}
      </div>
      <LineaTiempo v-if="abierta" class="mt-2" :eventos="item.eventos" />
      <div class="d-flex flex-wrap gap-2 mt-1">
        <button
          v-if="!abierta"
          type="button"
          class="btn btn-sm btn-outline-secondary"
          @click="abierta = true"
        >
          Ver movimientos ({{ item.eventos.length }})
        </button>
        <button
          v-if="item.puedeCorregir && puedeCorregir"
          type="button"
          class="btn btn-sm btn-primary"
          @click="emit('corregir', item.id)"
        >
          Corregir y reenviar
        </button>
      </div>
    </div>
  </div>
</template>
