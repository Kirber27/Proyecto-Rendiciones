<script setup lang="ts">
// Modal liviano con las clases de Bootstrap (sin su JS): se dibuja en <body>, enfoca el primer campo
// al abrir, y se cierra con Escape, con la × o tocando fuera.
import { nextTick, onMounted, ref, useId } from 'vue'

defineProps<{ titulo: string }>()
const emit = defineEmits<{ cerrar: [] }>()

const id = useId()
const raiz = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  raiz.value?.querySelector<HTMLElement>('input, select, textarea')?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="raiz"
      class="modal d-block"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${id}-titulo`"
      @keydown.esc="emit('cerrar')"
      @mousedown.self="emit('cerrar')"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 :id="`${id}-titulo`" class="modal-title fs-5">{{ titulo }}</h2>
            <button type="button" class="btn-close" aria-label="Cerrar" @click="emit('cerrar')" />
          </div>
          <div class="modal-body d-flex flex-column gap-2">
            <slot />
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show" />
  </Teleport>
</template>
