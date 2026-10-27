<script setup lang="ts">
// Visor de imagen a pantalla completa. Se cierra con clic o Escape.
import { onBeforeUnmount, watch } from 'vue'

const src = defineModel<string | null>({ default: null })
defineProps<{ alt?: string }>()

function cerrar() {
  src.value = null
}
function alTeclear(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrar()
}

watch(src, (v) => {
  if (v) window.addEventListener('keydown', alTeclear)
  else window.removeEventListener('keydown', alTeclear)
})
onBeforeUnmount(() => window.removeEventListener('keydown', alTeclear))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="src"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada. Toca para cerrar."
      @click="cerrar"
    >
      <img :src="src" :alt="alt ?? 'Respaldo de la rendición'" />
    </div>
  </Teleport>
</template>
