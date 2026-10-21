<script setup lang="ts">
import { ref } from 'vue'
import AppLightbox from '@/components/ui/AppLightbox.vue'
import type { Respaldo } from '@/types/rendicion'

defineProps<{ fotos: Respaldo[] }>()
const emit = defineEmits<{ quitar: [indice: number] }>()

const zoom = ref<string | null>(null)
</script>

<template>
  <div class="thumbs">
    <figure v-for="(f, i) in fotos" :key="f.url">
      <img :src="f.url" :alt="`Respaldo ${i + 1}`" @click="zoom = f.url" />
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
