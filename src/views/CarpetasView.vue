<script setup lang="ts">
// Mis rendiciones / Carpetas (spec 05).
//  - Solicitante: su carpeta.
//  - Tesorería: índice de carpetas (/mis) y carpeta de cada persona (/mis/:personaId).
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CarpetaPersona from '@/components/carpetas/CarpetaPersona.vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { ordenarCarpetas } from '@/domain/carpeta'
import { clp, tr } from '@/domain/formato'
import {
  leerCarpeta,
  leerIndiceCarpetas,
  type DatosCarpeta,
  type ResumenIndice,
} from '@/services/carpetas'
import { useAuthStore } from '@/stores/auth'
import { useCatalogosStore } from '@/stores/catalogos'
import { usePorAprobarStore } from '@/stores/porAprobar'
import { useRendirStore } from '@/stores/rendir'

const auth = useAuthStore()
const cat = useCatalogosStore()
const porAprobar = usePorAprobarStore()
const rendir = useRendirStore()
const route = useRoute()
const router = useRouter()

const datos = ref<DatosCarpeta | null>(null)
const indice = ref<ResumenIndice | null>(null)
const cargando = ref(true)
const error = ref('')
const buscar = ref('')

/** Persona cuya carpeta se muestra (null = índice de tesorería). */
const personaId = computed<string | null>(() => {
  const p = route.params.personaId
  if (typeof p === 'string' && auth.esTesoreria) return p
  return auth.esTesoreria ? null : (auth.persona?.id ?? null)
})
const nombrePersona = computed(() =>
  tr(cat.catalogos.personas.find((p) => p.id === personaId.value)?.nombre ?? ''),
)
const cuenta = computed(() =>
  personaId.value ? datos.value?.asignacion.porPersona.get(personaId.value) : undefined,
)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    await cat.cargar()
    if (personaId.value) {
      datos.value = await leerCarpeta(personaId.value)
    } else if (auth.esTesoreria) {
      indice.value = await leerIndiceCarpetas()
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
watch(personaId, () => {
  datos.value = null
  void cargar()
})
// Tesorería: refrescar cuando cambian rendiciones (envíos y decisiones).
watch(() => porAprobar.cambios, cargar)

const carpetas = computed(() => {
  if (!indice.value) return []
  return ordenarCarpetas(
    cat.catalogos.personas.map((p) => ({
      personaId: p.id,
      nombre: p.nombre,
      rendiciones: indice.value!.conteos.get(p.id)?.rendiciones ?? 0,
      porAprobar: indice.value!.conteos.get(p.id)?.porAprobar ?? 0,
      saldo: indice.value!.asignacion.porPersona.get(p.id)?.saldo ?? 0,
    })),
    buscar.value,
  )
})

async function corregir(id: string) {
  try {
    await rendir.cargarParaCorregir(id)
    await router.push({ name: 'rendir' })
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <!-- Índice de carpetas (tesorería) -->
    <template v-if="!personaId && auth.esTesoreria">
      <PageTitle
        titulo="Carpetas por persona"
        lead="Una carpeta por persona con todas sus rendiciones y cada movimiento: enviada, aprobada, devuelta, rechazada, anulada, eliminada y pagada."
      />
      <input
        v-model="buscar"
        type="search"
        class="form-control"
        style="max-width: 280px"
        placeholder="Buscar persona"
        aria-label="Buscar persona"
      />
      <div v-if="error" class="alert alert-danger mb-0">{{ error }}</div>
      <div v-if="cargando" class="small text-body-secondary">Cargando…</div>
      <div v-else class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
        <div v-for="c in carpetas" :key="c.personaId" class="col">
          <RouterLink
            :to="{ name: 'carpeta-persona', params: { personaId: c.personaId } }"
            class="card h-100 text-reset text-decoration-none"
          >
            <div class="card-body d-flex flex-column gap-1">
              <div class="d-flex justify-content-between align-items-baseline gap-2">
                <b>{{ tr(c.nombre) }}</b>
                <AppChip v-if="c.porAprobar" tono="warn">{{ c.porAprobar }} por aprobar</AppChip>
              </div>
              <span class="small text-body-secondary">
                {{ c.rendiciones }} rendición(es)<template v-if="Math.abs(c.saldo) > 1">
                  · saldo {{ clp(c.saldo) }}</template
                >
              </span>
              <span class="small text-primary">Abrir carpeta →</span>
            </div>
          </RouterLink>
        </div>
      </div>
      <EmptyState v-if="!cargando && !carpetas.length"
        >Ninguna persona coincide con la búsqueda.</EmptyState
      >
    </template>

    <!-- Carpeta de una persona -->
    <template v-else-if="personaId">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <RouterLink
            v-if="auth.esTesoreria"
            :to="{ name: 'carpetas' }"
            class="btn btn-sm btn-outline-secondary mb-2"
          >
            ← Todas las carpetas
          </RouterLink>
          <PageTitle
            :titulo="nombrePersona || 'Mi carpeta'"
            :lead="
              auth.esTesoreria && personaId !== auth.persona?.id
                ? undefined
                : 'Tu carpeta: cada rendición que enviaste y todo lo que pasó con ella. Toca una para ver sus movimientos.'
            "
          />
        </div>
        <div v-if="cuenta" class="sum">
          <span><b>Rendido </b>{{ clp(cuenta.rendido) }}</span>
          <span><b>Pagado </b>{{ clp(cuenta.pagado) }}</span>
          <span><b>Saldo </b>{{ clp(cuenta.saldo) }}</span>
        </div>
      </div>
      <div v-if="error" class="alert alert-danger mb-0">{{ error }}</div>
      <div v-if="cargando && !datos" class="small text-body-secondary">Cargando tu carpeta…</div>
      <CarpetaPersona
        v-else-if="datos"
        :datos="datos"
        :medios-pago="cat.catalogos.mediosPago"
        :puede-corregir="personaId === auth.persona?.id"
        @corregir="corregir"
      />
    </template>

    <!-- Cuenta sin persona -->
    <template v-else>
      <PageTitle titulo="Mis rendiciones" />
      <EmptyState icono="bi-person-x">
        Tu cuenta no está vinculada a una persona. Pide a tesorería que la vincule en Perfiles.
      </EmptyState>
    </template>
  </div>
</template>
