<script setup lang="ts">
// Rendir gastos (spec 02): sube fotos → la IA arma la rendición → la persona revisa y envía.
import { computed, onMounted, ref } from 'vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import FotoDrop from '@/components/rendicion/FotoDrop.vue'
import RendicionEditor from '@/components/rendicion/RendicionEditor.vue'
import { separarImagenes } from '@/domain/recortes'
import { validarRendicion } from '@/domain/rendicion'
import { useAuthStore } from '@/stores/auth'
import { useCatalogosStore } from '@/stores/catalogos'
import { useRendirStore } from '@/stores/rendir'

const auth = useAuthStore()
const cat = useCatalogosStore()
const rendir = useRendirStore()

const problemas = ref<string[]>([])
const confirmarDescartar = ref(false)
const selectorExtra = ref<HTMLInputElement>()

onMounted(() => {
  void cat.cargar()
  rendir.recuperar()
})

const fotosEditor = computed(() =>
  rendir.fotos.map((f) => ({ url: f.url, quitable: !rendir.leyendo })),
)

function agregarDesdeEditor(e: Event) {
  const input = e.target as HTMLInputElement
  const { imagenes } = separarImagenes(Array.from(input.files ?? []))
  if (imagenes.length) rendir.agregarFotos(imagenes)
  input.value = ''
}

async function enviar() {
  if (!rendir.borrador) return
  problemas.value = validarRendicion(rendir.borrador, {
    esTesoreria: false, // la persona no elige cuenta ni C.C.: lo hace tesorería al aprobar
    personasActivas: cat.personasActivas,
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
      lead="Sube la foto del formulario firmado y de cada boleta o factura. La página lee los datos sola; revisas que estén bien y envías. Tesorería la aprueba y la ingresa."
    />

    <div v-if="cat.error" class="alert alert-danger mb-0">{{ cat.error }}</div>

    <!-- Paso 1: subir fotos -->
    <template v-if="!rendir.borrador">
      <div class="steps">
        <div><b>1. Sube las fotos</b>Formulario completo y legible, más boletas y facturas.</div>
        <div><b>2. Revisa</b>Los datos aparecen solos. Corrige si algo se leyó mal.</div>
        <div><b>3. Envía</b>Tesorería la aprueba, la ingresa y te avisa aquí cuando se paga.</div>
      </div>

      <FotoDrop
        :fotos="rendir.fotos.map((f) => ({ url: f.url, quitable: true }))"
        :leyendo="rendir.leyendo"
        :deshabilitado="!cat.listo"
        @agregar="rendir.agregarFotos"
        @quitar="rendir.quitarFoto"
        @detener="rendir.cancelarLectura"
      />

      <div
        v-if="rendir.avisoLectura"
        :class="['alert', `alert-${rendir.avisoLectura.tipo}`, 'mb-0']"
        role="alert"
      >
        {{ rendir.avisoLectura.texto }}
        <div v-if="rendir.fotos.length && !rendir.leyendo" class="d-flex flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="rendir.leer()">
            Intentar de nuevo
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="rendir.descartar()"
          >
            Empezar de nuevo
          </button>
          <button type="button" class="btn btn-sm btn-link" @click="rendir.completarAMano()">
            Completar a mano
          </button>
        </div>
      </div>
      <div
        v-if="rendir.avisoEnvio"
        :class="['alert', `alert-${rendir.avisoEnvio.tipo}`, 'mb-0']"
        role="status"
      >
        {{ rendir.avisoEnvio.texto }}
      </div>
    </template>

    <!-- Pasos 2 y 3: revisar y enviar -->
    <template v-else>
      <div
        v-if="rendir.avisoLectura"
        :class="['alert', `alert-${rendir.avisoLectura.tipo}`, 'mb-0']"
        role="alert"
      >
        {{ rendir.avisoLectura.texto }}
      </div>
      <div v-if="rendir.leyendo" class="alert alert-primary mb-0 reading" role="status">
        <span class="dot" aria-hidden="true" />
        <b>Volviendo a leer las fotos…</b>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          @click="rendir.cancelarLectura()"
        >
          Detener
        </button>
      </div>

      <RendicionEditor
        v-model="rendir.borrador"
        modo="persona"
        :catalogos="cat.catalogos"
        :fotos="fotosEditor"
        :solicitante-fijo="!!rendir.personaFija"
        :problemas="problemas"
        @quitar-foto="rendir.quitarFoto"
      >
        <template #acciones>
          <button
            type="button"
            class="btn btn-primary btn-lg"
            :disabled="rendir.leyendo || rendir.enviando"
            @click="enviar"
          >
            {{ rendir.enviando ? rendir.progresoEnvio || 'Enviando…' : 'Enviar rendición' }}
          </button>
          <input
            ref="selectorExtra"
            type="file"
            accept="image/*"
            multiple
            hidden
            @change="agregarDesdeEditor"
          />
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="rendir.leyendo"
            @click="selectorExtra?.click()"
          >
            <i class="bi bi-images" aria-hidden="true" /> Agregar fotos
          </button>
          <button
            v-if="rendir.fotos.length"
            type="button"
            :class="[
              'btn',
              rendir.hayFotosNuevas ? 'btn-outline-primary' : 'btn-outline-secondary',
            ]"
            :disabled="rendir.leyendo"
            @click="rendir.leer()"
          >
            Volver a leer las fotos
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
            @click="confirmarDescartar = true"
          >
            Descartar
          </button>
        </template>
      </RendicionEditor>

      <div
        v-if="rendir.avisoEnvio"
        :class="['alert', `alert-${rendir.avisoEnvio.tipo}`, 'mb-0']"
        role="status"
      >
        {{ rendir.avisoEnvio.texto }}
      </div>
      <p v-if="!auth.persona" class="small text-body-secondary mb-0">
        Tu cuenta no está vinculada a una persona: no podrás enviar hasta que tesorería la vincule.
      </p>
    </template>
  </div>
</template>
