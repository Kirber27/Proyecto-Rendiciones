<script setup lang="ts">
// Miniaturas de respaldos: las fotos se amplían en el visor; los PDF se abren en otra pestaña.
import { ref } from 'vue'
import AppLightbox from '@/components/ui/AppLightbox.vue'
import type { Respaldo } from '@/types/rendicion'

defineProps<{ respaldos: Respaldo[] }>()
const emit = defineEmits<{ quitar: [indice: number] }>()

const zoom = ref<string | null>(null)
</script>

<template>
  <div class="thumbs">
    <figure v-for="(f, i) in respaldos" :key="f.url">
      <a
        v-if="f.tipo === 'pdf'"
        class="thumb-pdf"
        :href="f.url"
        target="_blank"
        rel="noopener"
        :aria-label="`Abrir respaldo ${i + 1} (PDF)`"
        :title="f.nombre"
      >
        <i class="bi bi-file-earmark-pdf" aria-hidden="true" />
        <span>{{ f.nombre ?? 'PDF' }}</span>
      </a>
      <img v-else :src="f.url" :alt="`Respaldo ${i + 1}`" @click="zoom = f.url" />
      <button
        v-if="f.quitable"
        type="button"
        class="thumb-quitar"
        :aria-label="`Quitar respaldo ${i + 1}`"
        @click="emit('quitar', i)"
      >
        ×
      </button>
    </figure>
  </div>
  <AppLightbox v-model="zoom" />
</template>
