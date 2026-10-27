<script setup lang="ts">
// Zona para adjuntar los respaldos de la rendición: fotos o PDF del formulario y de las boletas
// (porta la .drop de vRendir). Descarta lo demás con un aviso; la lista la maneja quien la usa.
import { ref } from 'vue'
import { revisarArchivos } from '@/domain/respaldos'
import type { Respaldo } from '@/types/rendicion'
import RespaldosGrid from './RespaldosGrid.vue'

withDefaults(
  defineProps<{
    respaldos?: Respaldo[]
    deshabilitado?: boolean
  }>(),
  { respaldos: () => [], deshabilitado: false },
)
const emit = defineEmits<{
  agregar: [archivos: File[]]
  quitar: [indice: number]
}>()

const selector = ref<HTMLInputElement>()
const camara = ref<HTMLInputElement>()
const arrastrando = ref(false)
const aviso = ref('')

function recibir(lista: FileList | null | undefined) {
  const { aceptados, aviso: texto } = revisarArchivos(Array.from(lista ?? []))
  aviso.value = texto
  if (aceptados.length) emit('agregar', aceptados)
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
    <input
      ref="selector"
      type="file"
      accept="image/*,application/pdf"
      multiple
      hidden
      @change="alElegir"
    />
    <input
      ref="camara"
      type="file"
      accept="image/*"
      capture="environment"
      hidden
      @change="alElegir"
    />

    <div class="d-flex flex-wrap justify-content-center gap-2">
      <button
        type="button"
        class="btn btn-outline-primary"
        :disabled="deshabilitado"
        @click="selector?.click()"
      >
        <i class="bi bi-paperclip" aria-hidden="true" /> Adjuntar fotos o PDF
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary d-md-none"
        :disabled="deshabilitado"
        @click="camara?.click()"
      >
        <i class="bi bi-camera" aria-hidden="true" /> Cámara
      </button>
    </div>

    <span class="small text-body-secondary">
      Foto o PDF del formulario firmado y de cada boleta o factura (PDF hasta 10 MB). Puedes
      arrastrarlos aquí.
    </span>
    <div v-if="aviso" class="alert alert-warning py-2 mb-0 small" role="alert">{{ aviso }}</div>

    <RespaldosGrid v-if="respaldos.length" :respaldos="respaldos" @quitar="emit('quitar', $event)" />
  </div>
</template>
