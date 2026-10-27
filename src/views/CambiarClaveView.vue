<script setup lang="ts">
// Cambiar contraseña (spec 10). Obligatorio si la cuenta tiene una contraseña temporal (el router no
// deja ir a otra pantalla); si no, voluntario desde el encabezado y pide la contraseña actual.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/layout/PageTitle.vue'
import { LARGO_MINIMO_CLAVE, validarCambioClave } from '@/domain/acceso'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

/** Se fija al abrir: al guardar la marca cambia, pero el texto de la pantalla no debe saltar. */
const obligatorio = ref(auth.debeCambiarClave)
const actual = ref('')
const nueva = ref('')
const repetida = ref('')
const ver = ref(false)
const problemas = ref<string[]>([])
const guardando = ref(false)
const listo = ref(false)

async function guardar() {
  listo.value = false
  problemas.value = validarCambioClave({
    nueva: nueva.value,
    repetida: repetida.value,
    actual: actual.value,
    pideActual: !obligatorio.value,
  })
  if (problemas.value.length) return
  guardando.value = true
  try {
    await auth.cambiarClave(nueva.value, obligatorio.value ? undefined : actual.value)
    if (obligatorio.value) {
      await router.replace('/')
      return
    }
    actual.value = nueva.value = repetida.value = ''
    listo.value = true
  } catch (e) {
    problemas.value = [(e as Error).message]
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="mx-auto d-flex flex-column gap-3" style="max-width: 440px">
    <PageTitle
      :titulo="obligatorio ? 'Elige tu contraseña' : 'Cambiar contraseña'"
      :lead="
        obligatorio
          ? 'Entraste con una contraseña temporal. Elige una propia para seguir: desde ahora entrarás con ella.'
          : 'Escribe tu contraseña actual y la nueva.'
      "
    />

    <form class="card" novalidate @submit.prevent="guardar">
      <div class="card-body d-flex flex-column gap-3">
        <div v-if="!obligatorio">
          <label class="label-caps" for="clave-actual">Contraseña actual</label>
          <input
            id="clave-actual"
            v-model="actual"
            :type="ver ? 'text' : 'password'"
            class="form-control"
            autocomplete="current-password"
          />
        </div>
        <div>
          <label class="label-caps" for="clave-nueva">Contraseña nueva</label>
          <input
            id="clave-nueva"
            v-model="nueva"
            :type="ver ? 'text' : 'password'"
            class="form-control"
            autocomplete="new-password"
            aria-describedby="clave-ayuda"
          />
          <div id="clave-ayuda" class="form-text">Al menos {{ LARGO_MINIMO_CLAVE }} caracteres.</div>
        </div>
        <div>
          <label class="label-caps" for="clave-repetida">Repite la contraseña nueva</label>
          <input
            id="clave-repetida"
            v-model="repetida"
            :type="ver ? 'text' : 'password'"
            class="form-control"
            autocomplete="new-password"
          />
        </div>
        <div class="form-check">
          <input id="ver-claves" v-model="ver" type="checkbox" class="form-check-input" />
          <label class="form-check-label" for="ver-claves">Mostrar contraseñas</label>
        </div>

        <div v-if="problemas.length" class="alert alert-danger py-2 mb-0 small" role="alert">
          <ul class="mb-0 ps-3">
            <li v-for="(p, i) in problemas" :key="i">{{ p }}</li>
          </ul>
        </div>
        <div v-if="listo" class="alert alert-success py-2 mb-0 small" role="status">
          Contraseña cambiada. La próxima vez entra con la nueva.
        </div>

        <div class="d-flex flex-wrap gap-2">
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar contraseña' }}
          </button>
          <RouterLink v-if="!obligatorio" to="/" class="btn btn-outline-secondary">Volver</RouterLink>
        </div>
      </div>
    </form>
  </div>
</template>
