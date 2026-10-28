<script setup lang="ts">
// Rendir gastos (spec 02): la persona completa el formulario, adjunta los respaldos y envía.
import { computed, onMounted, ref } from 'vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import RendicionEditor from '@/components/rendicion/RendicionEditor.vue'
import RespaldosDrop from '@/components/rendicion/RespaldosDrop.vue'
import { validarRendicion } from '@/domain/rendicion'
import { useAuthStore } from '@/stores/auth'
import { useCatalogosStore } from '@/stores/catalogos'
import { useRendirStore } from '@/stores/rendir'
import type { Respaldo } from '@/types/rendicion'

const auth = useAuthStore()
const cat = useCatalogosStore()
const rendir = useRendirStore()

const problemas = ref<string[]>([])
const confirmarDescartar = ref(false)

onMounted(() => void rendir.iniciar())

// Respaldos ya guardados (corrección de una observada) primero, sin quitar; luego los nuevos.
const respaldos = computed<Respaldo[]>(() => [
  ...rendir.guardados.map((g) => ({ url: g.url, tipo: g.tipo, quitable: false })),
  ...rendir.archivos.map((a) => ({
    url: a.url,
    tipo: a.tipo,
    nombre: a.file.name,
    quitable: !rendir.enviando,
  })),
])
function quitar(indice: number) {
  rendir.quitarArchivo(indice - rendir.guardados.length)
}

async function enviar() {
  if (!rendir.borrador) return
  problemas.value = validarRendicion(rendir.borrador, {
    esTesoreria: false, // la persona no elige cuenta ni C.C.: lo hace tesorería al aprobar
    exigirProveedor: true,
    personasActivas: cat.personasActivas,
    respaldos: respaldos.value.length,
  })
  if (problemas.value.length) return
  if (await rendir.enviar()) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function descartar() {
  rendir.descartar()
  problemas.value = []
  confirmarDescartar.value = false
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle
      titulo="Rendir gastos"
      lead="Completa los datos del formulario y una línea por cada boleta o factura, adjunta las fotos o PDF de respaldo y envía. Tesorería la aprueba y la ingresa."
    />

    <div class="steps">
      <div><b>1. Completa el formulario</b>Nº, fecha, empresa y cada gasto con su monto.</div>
      <div><b>2. Adjunta los respaldos</b>Foto o PDF del formulario firmado y de las boletas.</div>
      <div><b>3. Envía</b>Tesorería la aprueba, la ingresa y te avisa aquí cuando se paga.</div>
    </div>

    <div v-if="cat.error" class="alert alert-danger mb-0">{{ cat.error }}</div>
    <div
      v-if="rendir.avisoEnvio"
      :class="['alert', `alert-${rendir.avisoEnvio.tipo}`, 'mb-0']"
      role="status"
    >
      {{ rendir.avisoEnvio.texto }}
    </div>
    <div v-if="rendir.aviso" :class="['alert', `alert-${rendir.aviso.tipo}`, 'mb-0']" role="alert">
      {{ rendir.aviso.texto }}
    </div>

    <p v-if="!rendir.borrador && !cat.error" class="text-body-secondary mb-0">Cargando…</p>

    <RendicionEditor
      v-if="rendir.borrador"
      v-model="rendir.borrador"
      modo="persona"
      :catalogos="cat.catalogos"
      :respaldos="respaldos"
      :solicitante-fijo="!!rendir.personaFija"
      :problemas="problemas"
    >
      <template #respaldos>
        <RespaldosDrop
          :respaldos="respaldos"
          :deshabilitado="rendir.enviando"
          @agregar="rendir.agregarArchivos"
          @quitar="quitar"
        />
      </template>
      <template #acciones>
        <button
          type="button"
          class="btn btn-primary btn-lg"
          :disabled="rendir.enviando"
          @click="enviar"
        >
          {{ rendir.enviando ? rendir.progresoEnvio || 'Enviando…' : 'Enviar rendición' }}
        </button>
        <span v-if="confirmarDescartar" class="d-flex align-items-center gap-2">
          <span class="small text-body-secondary">¿Descartar esta rendición?</span>
          <button type="button" class="btn btn-sm btn-outline-danger" @click="descartar">
            Sí, descartar
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="confirmarDescartar = false"
          >
            No
          </button>
        </span>
        <button
          v-else
          type="button"
          class="btn btn-outline-secondary"
          :disabled="rendir.enviando"
          @click="confirmarDescartar = true"
        >
          Descartar
        </button>
      </template>
    </RendicionEditor>

    <p v-if="rendir.borrador && !auth.persona" class="small text-body-secondary mb-0">
      Tu cuenta no está vinculada a una persona: no podrás enviar hasta que tesorería la vincule.
    </p>
  </div>
</template>
