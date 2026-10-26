<script setup lang="ts">
// Por aprobar (spec 03): bandeja de rendiciones en revisión y decisión de tesorería.
import { computed, onMounted, ref, watch } from 'vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import LineaTiempo from '@/components/rendicion/LineaTiempo.vue'
import RendicionEditor from '@/components/rendicion/RendicionEditor.vue'
import AppChip from '@/components/ui/AppChip.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { clp, fdate, tr } from '@/domain/formato'
import { cuadra, validarRendicion } from '@/domain/rendicion'
import {
  abrirRendicion,
  aprobarRendicion,
  foliosExistentes,
  listarPorAprobar,
  observarRendicion,
  rechazarRendicion,
  type FilaBandeja,
  type RendicionAbierta,
} from '@/services/aprobacion'
import { useCatalogosStore } from '@/stores/catalogos'
import { usePorAprobarStore } from '@/stores/porAprobar'

const cat = useCatalogosStore()
const porAprobar = usePorAprobarStore()

const filas = ref<FilaBandeja[]>([])
const duplicados = ref(new Set<string>())
const cargando = ref(true)
const seleccion = ref<FilaBandeja | null>(null)
const abierta = ref<RendicionAbierta | null>(null)
const abriendo = ref(false)
const nota = ref('')
const problemas = ref<string[]>([])
const guardando = ref(false)
const mensaje = ref<{ tipo: 'success' | 'danger' | 'info'; texto: string } | null>(null)
const confirmarRechazo = ref(false)

async function cargar() {
  try {
    filas.value = await listarPorAprobar()
    duplicados.value = await foliosExistentes([
      ...new Set(filas.value.map((f) => f.folioPropuesto)),
    ])
  } catch (e) {
    mensaje.value = { tipo: 'danger', texto: (e as Error).message }
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  void cat.cargar()
  void cargar()
})

// Llega un envío nuevo o alguien más decidió: refrescar la bandeja.
watch(
  () => porAprobar.cambios,
  async () => {
    await cargar()
    if (
      seleccion.value &&
      !filas.value.some((f) => f.id === seleccion.value!.id) &&
      !guardando.value
    ) {
      cerrar()
      mensaje.value = {
        tipo: 'info',
        texto: 'La rendición que revisabas ya no está en la bandeja.',
      }
    }
  },
)

async function abrir(f: FilaBandeja) {
  seleccion.value = f
  abierta.value = null
  abriendo.value = true
  nota.value = ''
  problemas.value = []
  confirmarRechazo.value = false
  mensaje.value = null
  try {
    abierta.value = await abrirRendicion(f.id)
  } catch (e) {
    mensaje.value = { tipo: 'danger', texto: (e as Error).message }
    seleccion.value = null
  } finally {
    abriendo.value = false
  }
}

function cerrar() {
  seleccion.value = null
  abierta.value = null
  problemas.value = []
  nota.value = ''
  confirmarRechazo.value = false
}

async function decidir(accion: () => Promise<string>) {
  guardando.value = true
  try {
    const texto = await accion()
    cerrar()
    mensaje.value = { tipo: 'success', texto }
    await Promise.all([cargar(), porAprobar.actualizar()])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    mensaje.value = { tipo: 'danger', texto: (e as Error).message }
  } finally {
    guardando.value = false
  }
}

function aprobar() {
  const a = abierta.value
  const f = seleccion.value
  if (!a || !f) return
  problemas.value = validarRendicion(a.borrador, {
    esTesoreria: true,
    personasActivas: cat.personasActivas,
  })
  if (problemas.value.length) return
  void decidir(async () => {
    const folio = await aprobarRendicion(f.id, a.borrador, a.version)
    return `${folio} aprobada e ingresada al libro.`
  })
}

function observar() {
  const a = abierta.value
  const f = seleccion.value
  if (!a || !f) return
  if (!nota.value.trim()) {
    problemas.value = ['Escribe el motivo de la observación: la persona lo verá para corregir.']
    return
  }
  void decidir(async () => {
    await observarRendicion(f.id, nota.value, a.version)
    return `Rendición Nº ${f.nro} de ${tr(f.personaNombre)} devuelta para corregir.`
  })
}

function rechazar() {
  const a = abierta.value
  const f = seleccion.value
  if (!a || !f) return
  void decidir(async () => {
    await rechazarRendicion(f.id, nota.value, a.version)
    return `Rendición Nº ${f.nro} de ${tr(f.personaNombre)} rechazada.`
  })
}

const cuadreFila = (f: FilaBandeja) => cuadra(f.total, f.totalFormulario)
const fotos = computed(() => (abierta.value?.fotos ?? []).map((x) => ({ url: x.url })))
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle
      titulo="Por aprobar"
      lead="Rendiciones enviadas que esperan tu revisión. Solo al aprobarlas entran al libro de rendiciones."
    />

    <div v-if="mensaje" :class="['alert', `alert-${mensaje.tipo}`, 'mb-0']" role="status">
      {{ mensaje.texto }}
    </div>

    <div v-if="cargando" class="small text-body-secondary">Cargando…</div>
    <EmptyState v-else-if="!filas.length && !seleccion" icono="bi-inbox">
      No hay rendiciones esperando aprobación.
    </EmptyState>
    <div v-else-if="filas.length" class="table-wrap">
      <table class="table table-hover table-click mb-0">
        <thead>
          <tr>
            <th>Enviada</th>
            <th>Solicitante</th>
            <th>Nº</th>
            <th>Fecha</th>
            <th class="n">Gastos</th>
            <th class="n">Total</th>
            <th>Formulario</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="f in filas"
            :key="f.id"
            tabindex="0"
            :class="{ 'fila-sel': seleccion?.id === f.id }"
            @click="abrir(f)"
            @keydown.enter="abrir(f)"
          >
            <td class="mono">{{ fdate(f.enviadoEn) }}</td>
            <td>
              {{ tr(f.personaNombre) }}
              <div v-if="duplicados.has(f.folioPropuesto)" class="small neg">
                Ya existe {{ f.folioPropuesto }} en el libro
              </div>
            </td>
            <td class="mono">{{ f.nro }}</td>
            <td class="mono">{{ fdate(f.fecha) }}</td>
            <td class="n">{{ f.nLineas }}</td>
            <td class="n">{{ clp(f.total) }}</td>
            <td>
              <AppChip v-if="cuadreFila(f) == null" tono="muted">—</AppChip>
              <AppChip v-else-if="cuadreFila(f)" estado="Cuadra" />
              <AppChip v-else estado="No cuadra" />
            </td>
            <td><AppChip :estado="f.marca" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Revisión -->
    <section v-if="seleccion" class="d-flex flex-column gap-3" aria-label="Revisión">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h2 class="mb-0">Revisar: {{ tr(seleccion.personaNombre) }} · Nº {{ seleccion.nro }}</h2>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="cerrar">
          Cerrar
        </button>
      </div>
      <div v-if="abriendo" class="small text-body-secondary">Abriendo la rendición…</div>
      <template v-else-if="abierta">
        <details class="card" open>
          <summary class="card-body py-2 small text-body-secondary">
            Movimientos ({{ abierta.eventos.length }})
          </summary>
          <div class="card-body pt-0"><LineaTiempo :eventos="abierta.eventos" /></div>
        </details>

        <RendicionEditor
          v-model="abierta.borrador"
          modo="aprobar"
          :catalogos="cat.catalogos"
          :fotos="fotos"
          :problemas="problemas"
        >
          <template #acciones>
            <button
              type="button"
              class="btn btn-success btn-lg"
              :disabled="guardando"
              @click="aprobar"
            >
              {{ guardando ? 'Guardando…' : 'Aprobar e ingresar' }}
            </button>
            <div class="d-flex flex-column" style="min-width: 260px">
              <label class="label-caps" for="nota-obs">Observación</label>
              <input
                id="nota-obs"
                v-model="nota"
                class="form-control"
                placeholder="Motivo (lo verá la persona)"
                autocomplete="off"
              />
            </div>
            <button
              type="button"
              class="btn btn-outline-danger"
              :disabled="guardando"
              @click="observar"
            >
              Devolver para corregir
            </button>
            <span v-if="confirmarRechazo" class="d-flex align-items-center gap-2">
              <span class="small text-body-secondary">¿Rechazar? No se podrá reenviar.</span>
              <button
                type="button"
                class="btn btn-sm btn-danger"
                :disabled="guardando"
                @click="rechazar"
              >
                Sí, rechazar
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="confirmarRechazo = false"
              >
                No
              </button>
            </span>
            <button
              v-else
              type="button"
              class="btn btn-outline-danger"
              :disabled="guardando"
              @click="confirmarRechazo = true"
            >
              Rechazar
            </button>
          </template>
        </RendicionEditor>
      </template>
    </section>
  </div>
</template>
