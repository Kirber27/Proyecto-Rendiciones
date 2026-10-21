<script setup lang="ts">
// Zona para sacar o subir las fotos del formulario y las boletas (porta la .drop de vRendir).
// Solo recibe imágenes; los PDF se descartan con un aviso. La lista de fotos la maneja quien la usa.
import { ref } from 'vue'
import { separarImagenes } from '@/domain/recortes'
import type { Respaldo } from '@/types/rendicion'
import RespaldosGrid from './RespaldosGrid.vue'

withDefaults(
  defineProps<{
    fotos?: Respaldo[]
    leyendo?: boolean
    deshabilitado?: boolean
  }>(),
  { fotos: () => [], leyendo: false, deshabilitado: false },
)
const emit = defineEmits<{
  agregar: [archivos: File[]]
  quitar: [indice: number]
  detener: []
}>()

const selector = ref<HTMLInputElement>()
const camara = ref<HTMLInputElement>()
const arrastrando = ref(false)
const aviso = ref('')

function recibir(lista: FileList | null | undefined) {
  const { imagenes, descartados } = separarImagenes(Array.from(lista ?? []))
  aviso.value = descartados
    ? `${descartados === 1 ? 'Un archivo no es imagen' : `${descartados} archivos no son imágenes`} y no se agregó. Si la boleta llegó en PDF, sube un pantallazo.`
    : ''
  if (imagenes.length) emit('agregar', imagenes)
}

function alElegir(e: Event) {
  const input = e.target as HTMLInputElement
  recibir(input.files)
  input.value = '' // permite volver a elegir el mismo archivo
}

function alSoltar(e: DragEvent) {
  arrastrando.value = false
  recibir(e.dataTransfer?.files)
}
</script>

<template>
  <div
    class="drop"
    :class="{ 'drop-activa': arrastrando }"
    @dragover.prevent="arrastrando = true"
    @dragleave="arrastrando = false"
    @drop.prevent="alSoltar"
  >
    <input ref="selector" type="file" accept="image/*" multiple hidden @change="alElegir" />
    <input
      ref="camara"
      type="file"
      accept="image/*"
      capture="environment"
      hidden
      @change="alElegir"
    />

    <div v-if="leyendo" class="reading" role="status">
      <span class="dot" aria-hidden="true" />
      <b>Leyendo la rendición…</b>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('detener')">
        Detener
      </button>
    </div>
    <div v-else class="d-flex flex-wrap justify-content-center gap-2">
      <button
        type="button"
        class="btn btn-primary btn-lg"
        :disabled="deshabilitado"
        @click="selector?.click()"
      >
        <i class="bi bi-images" aria-hidden="true" /> Sacar o subir fotos
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary btn-lg d-md-none"
        :disabled="deshabilitado"
        @click="camara?.click()"
      >
        <i class="bi bi-camera" aria-hidden="true" /> Cámara
      </button>
    </div>

    <span class="small text-body-secondary">
      JPG, PNG o WebP. Puedes arrastrarlas aquí. Si la boleta llegó en PDF, sube un pantallazo.
    </span>
    <div v-if="aviso" class="alert alert-warning py-2 mb-0 small" role="alert">{{ aviso }}</div>

    <RespaldosGrid
      v-if="fotos.length"
      :fotos="fotos.map((f) => ({ ...f, quitable: f.quitable && !leyendo }))"
      @quitar="emit('quitar', $event)"
    />
  </div>
</template>
