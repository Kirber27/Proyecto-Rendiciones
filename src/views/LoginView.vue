<script setup lang="ts">
// Ingreso con correo y contraseña (spec 10). Las cuentas y las contraseñas nuevas las entrega el
// administrador desde Perfiles: la app no envía correos.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import { correoValido } from '@/domain/personas'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const correo = ref('')
const clave = ref('')
const verClave = ref(false)
const olvido = ref(false)
const entrando = ref(false)
const error = ref('')

const destino = computed(() => {
  const v = route.query.volver
  return typeof v === 'string' && v.startsWith('/') ? v : '/'
})

async function entrar() {
  error.value = ''
  if (!correo.value.trim() || !clave.value) {
    error.value = 'Escribe tu correo y tu contraseña.'
    return
  }
  if (!correoValido(correo.value)) {
    error.value = 'Escribe un correo válido.'
    return
  }
  entrando.value = true
  try {
    await auth.entrar(correo.value, clave.value)
    // Si entró con una contraseña temporal, el router lo lleva a elegir una propia.
    await router.replace(destino.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    entrando.value = false
  }
}
</script>

<template>
  <div class="app-wrap">
    <div class="d-flex justify-content-end pt-2"><ThemeToggle /></div>
    <main class="mx-auto py-4 d-flex flex-column gap-4" style="max-width: 420px">
      <div class="brand">
        <b>Rendiciones Heca</b>
        <small>POE-GLO-FIN-003 · RENDICIÓN DE GASTOS</small>
      </div>

      <section class="card">
        <form class="card-body d-flex flex-column gap-3" novalidate @submit.prevent="entrar">
          <div>
            <h1 class="h2 mb-1">Ingresar</h1>
            <p class="lead-muted small">Con tu correo de Heca y tu contraseña.</p>
          </div>
          <div>
            <label class="label-caps" for="correo">Correo</label>
            <input
              id="correo"
              v-model="correo"
              type="email"
              class="form-control"
              autocomplete="username"
              inputmode="email"
              placeholder="nombre@hecaglobal.com"
              required
              autofocus
            />
          </div>
          <div>
            <label class="label-caps" for="clave">Contraseña</label>
            <div class="input-group">
              <input
                id="clave"
                v-model="clave"
                :type="verClave ? 'text' : 'password'"
                class="form-control"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="btn btn-outline-secondary"
                :aria-label="verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                :aria-pressed="verClave"
                @click="verClave = !verClave"
              >
                <i :class="['bi', verClave ? 'bi-eye-slash' : 'bi-eye']" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div v-if="error" class="alert alert-danger py-2 mb-0 small" role="alert">
            {{ error }}
          </div>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="entrando">
            {{ entrando ? 'Entrando…' : 'Entrar' }}
          </button>
          <button
            type="button"
            class="btn btn-link btn-sm px-0 align-self-start"
            :aria-expanded="olvido"
            aria-controls="ayuda-clave"
            @click="olvido = !olvido"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <div v-if="olvido" id="ayuda-clave" class="alert alert-info py-2 mb-0 small">
            Pide al administrador que te asigne una contraseña nueva en Perfiles. Te la entrega él (no
            llega por correo) y, al entrar con ella, eliges una propia.
          </div>
        </form>
      </section>

      <p class="small text-body-secondary text-center mb-0">
        ¿Aún no tienes cuenta? Pide al administrador que la cree en Perfiles.
      </p>
    </main>
  </div>
</template>
