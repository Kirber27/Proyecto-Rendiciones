<script setup lang="ts">
// Ingreso con correo + código de un solo uso (OTP). Solo entran correos registrados en Perfiles
// (lo valida el Auth Hook en Supabase). El enlace del correo también sirve.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import { correoValido } from '@/domain/personas'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const paso = ref<'correo' | 'codigo'>('correo')
const correo = ref('')
const codigo = ref('')
const enviando = ref(false)
const error = ref('')

const destino = computed(() => {
  const v = route.query.volver
  return typeof v === 'string' && v.startsWith('/') ? v : '/'
})

// Si la sesión llega por el enlace del correo (o en otra pestaña), seguir de inmediato.
watch(
  () => auth.conSesion,
  (si) => si && router.replace(destino.value),
)

async function enviarCodigo() {
  error.value = ''
  if (!correo.value.trim() || !correoValido(correo.value)) {
    error.value = 'Escribe un correo válido.'
    return
  }
  enviando.value = true
  try {
    await auth.pedirCodigo(correo.value)
    paso.value = 'codigo'
    codigo.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    enviando.value = false
  }
}

async function entrar() {
  error.value = ''
  if (codigo.value.replace(/\D/g, '').length < 6) {
    error.value = 'Escribe el código que llegó a tu correo.'
    return
  }
  enviando.value = true
  try {
    await auth.verificarCodigo(correo.value, codigo.value)
    await router.replace(destino.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    enviando.value = false
  }
}

function cambiarCorreo() {
  paso.value = 'correo'
  error.value = ''
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
        <form
          v-if="paso === 'correo'"
          class="card-body d-flex flex-column gap-3"
          @submit.prevent="enviarCodigo"
        >
          <div>
            <h1 class="h2 mb-1">Ingresar</h1>
            <p class="lead-muted small">Te enviaremos un código a tu correo de Heca.</p>
          </div>
          <div>
            <label class="label-caps" for="correo">Correo</label>
            <input
              id="correo"
              v-model="correo"
              type="email"
              class="form-control"
              autocomplete="email"
              inputmode="email"
              placeholder="nombre@hecaglobal.com"
              required
              autofocus
            />
          </div>
          <div v-if="error" class="alert alert-danger py-2 mb-0 small" role="alert">
            {{ error }}
          </div>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="enviando">
            {{ enviando ? 'Enviando…' : 'Enviar código' }}
          </button>
        </form>

        <form v-else class="card-body d-flex flex-column gap-3" @submit.prevent="entrar">
          <div>
            <h1 class="h2 mb-1">Revisa tu correo</h1>
            <p class="lead-muted small">
              Enviamos un código a <b>{{ correo }}</b
              >. Escríbelo aquí o toca el enlace del correo.
            </p>
          </div>
          <div>
            <label class="label-caps" for="codigo">Código</label>
            <input
              id="codigo"
              v-model="codigo"
              class="form-control form-control-lg mono text-center"
              autocomplete="one-time-code"
              inputmode="numeric"
              maxlength="10"
              placeholder="000000"
              required
              autofocus
            />
          </div>
          <div v-if="error" class="alert alert-danger py-2 mb-0 small" role="alert">
            {{ error }}
          </div>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="enviando">
            {{ enviando ? 'Verificando…' : 'Entrar' }}
          </button>
          <div class="d-flex justify-content-between">
            <button type="button" class="btn btn-link btn-sm px-0" @click="cambiarCorreo">
              Usar otro correo
            </button>
            <button
              type="button"
              class="btn btn-link btn-sm px-0"
              :disabled="enviando"
              @click="enviarCodigo"
            >
              Enviar otro código
            </button>
          </div>
        </form>
      </section>

      <p class="small text-body-secondary text-center mb-0">
        ¿No puedes entrar? Pide a tesorería que registre tu correo en Perfiles.
      </p>
    </main>
  </div>
</template>
