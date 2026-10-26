<script setup lang="ts">
// Detalle de una rendición del libro: resumen de pago, PDF, anular / eliminar / restaurar, línea de
// tiempo y editor en modo libro (porta el detalle de vLibro() del prototipo).
import { computed, onMounted, ref } from 'vue'
import LineaTiempo from '@/components/rendicion/LineaTiempo.vue'
import RendicionEditor from '@/components/rendicion/RendicionEditor.vue'
import AppChip from '@/components/ui/AppChip.vue'
import { clp, fdate, hoy, tr } from '@/domain/formato'
import { entradaReporte, type FilaLibro } from '@/domain/libro'
import { modeloReporte } from '@/domain/reporte'
import { validarRendicion } from '@/domain/rendicion'
import { abrirRendicion, type RendicionAbierta } from '@/services/aprobacion'
import {
  anularAprobacion,
  editarRendicion,
  eliminarRendicion,
  restaurarRendicion,
} from '@/services/libro'
import type { Pago } from '@/services/pagos'
import { useCatalogosStore } from '@/stores/catalogos'
import type { BorradorRendicion } from '@/types/rendicion'
import type { EstadoPagoRendicion } from '@/types/pagos'

const props = defineProps<{
  fila: FilaLibro
  estadoPago: EstadoPagoRendicion
  pagos: Pago[]
}>()
const emit = defineEmits<{ cerrar: []; cambiado: [mensaje: string] }>()

const cat = useCatalogosStore()

const abierta = ref<RendicionAbierta | null>(null)
/** Copia de lo guardado: el PDF sale de aquí, no de cambios sin guardar. */
const guardado = ref<BorradorRendicion | null>(null)
const abriendo = ref(true)
const ocupado = ref(false)
const error = ref('')
const problemas = ref<string[]>([])
const confirmar = ref<'anular' | 'eliminar' | null>(null)
const nota = ref('')
const progresoPdf = ref('')

const aprobada = computed(() => props.fila.estado === 'aprobada')
const puedeAnular = computed(() => aprobada.value && props.fila.origen === 'App')
const fotos = computed(() => (abierta.value?.fotos ?? []).map((x) => ({ url: x.url })))
const pagosTexto = computed(() =>
  props.pagos.map((p) => `${p.fecha ? fdate(p.fecha) : '—'} ${clp(p.monto)}`).join(' · '),
)

async function abrir() {
  abriendo.value = true
  error.value = ''
  try {
    const a = await abrirRendicion(props.fila.id)
    // Se copia antes de volverlo reactivo (structuredClone no acepta proxies).
    guardado.value = structuredClone(a.borrador)
    abierta.value = a
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    abriendo.value = false
  }
}
onMounted(abrir)

async function accion(fn: () => Promise<string>) {
  ocupado.value = true
  error.value = ''
  try {
    emit('cambiado', await fn())
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    ocupado.value = false
  }
}

function guardar() {
  const a = abierta.value
  if (!a) return
  problemas.value = validarRendicion(a.borrador, {
    esTesoreria: true,
    personasActivas: cat.personasActivas,
  })
  if (problemas.value.length) return
  void accion(async () => {
    const folio = await editarRendicion(props.fila.id, a.borrador, a.version)
    return folio === props.fila.folio
      ? `${folio}: cambios guardados.`
      : `Cambios guardados. Nuevo folio: ${folio}.`
  })
}

function confirmarAccion() {
  const f = props.fila
  const n = nota.value.trim() || undefined
  if (confirmar.value === 'anular')
    void accion(async () => {
      await anularAprobacion(f.id, n)
      return `${f.folio}: aprobación anulada. Volvió a Por aprobar.`
    })
  else if (confirmar.value === 'eliminar')
    void accion(async () => {
      await eliminarRendicion(f.id, n)
      return `${f.folio} eliminada. Puedes restaurarla desde el filtro Eliminadas.`
    })
}

function restaurar() {
  void accion(async () => {
    await restaurarRendicion(props.fila.id)
    return `${props.fila.folio} restaurada.`
  })
}

async function descargarPdf() {
  const a = abierta.value
  if (!a || !guardado.value) return
  ocupado.value = true
  error.value = ''
  progresoPdf.value = 'Preparando el reporte…'
  try {
    const { descargarReportePdf } = await import('@/services/pdf')
    const modelo = modeloReporte(
      entradaReporte(props.fila, guardado.value, {
        catalogos: cat.catalogos,
        estadoPago: props.estadoPago,
        pagos: props.pagos,
        hoy: hoy(),
      }),
    )
    await descargarReportePdf(
      modelo,
      a.fotos.map((f) => f.url),
      { onProgreso: (t) => (progresoPdf.value = t) },
    )
  } catch (e) {
    error.value = `No se pudo generar el PDF: ${(e as Error).message}`
  } finally {
    ocupado.value = false
    progresoPdf.value = ''
  }
}
</script>

<template>
  <section class="d-flex flex-column gap-3" aria-label="Detalle de la rendición">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <h2 class="mb-0">{{ fila.folio }} · {{ tr(fila.personaNombre) }} · Nº {{ fila.nro }}</h2>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <AppChip v-if="aprobada" :estado="estadoPago.estado" />
        <AppChip v-else estado="Eliminada" />
        <button
          v-if="aprobada"
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="ocupado || !abierta"
          @click="descargarPdf"
        >
          <i class="bi bi-file-earmark-pdf" aria-hidden="true" /> Descargar reporte PDF
        </button>
        <button
          v-if="puedeAnular"
          type="button"
          class="btn btn-sm btn-outline-danger"
          :disabled="ocupado"
          @click="confirmar = 'anular'"
        >
          Anular aprobación
        </button>
        <button
          v-if="aprobada"
          type="button"
          class="btn btn-sm btn-outline-danger"
          :disabled="ocupado"
          @click="confirmar = 'eliminar'"
        >
          Eliminar
        </button>
        <button
          v-else
          type="button"
          class="btn btn-sm btn-success"
          :disabled="ocupado"
          @click="restaurar"
        >
          Restaurar
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('cerrar')">
          Cerrar
        </button>
      </div>
    </div>

    <div v-if="progresoPdf" class="small text-body-secondary" role="status">{{ progresoPdf }}</div>

    <!-- Confirmación en línea -->
    <div
      v-if="confirmar"
      class="alert alert-danger mb-0 d-flex flex-wrap align-items-center gap-2"
      role="alert"
    >
      <span class="flex-grow-1">
        <template v-if="confirmar === 'anular'">
          Se quita del libro y vuelve a Por aprobar con sus fotos, para revisarla de nuevo.
        </template>
        <template v-else>
          ¿Eliminar {{ fila.folio }}? Sale del libro y la persona la verá como Eliminada. Queda en
          el historial y se puede restaurar.
        </template>
      </span>
      <input
        v-model="nota"
        class="form-control form-control-sm"
        style="max-width: 260px"
        placeholder="Motivo (opcional)"
        aria-label="Motivo"
        autocomplete="off"
      />
      <button
        type="button"
        class="btn btn-sm btn-danger"
        :disabled="ocupado"
        @click="confirmarAccion"
      >
        {{ confirmar === 'anular' ? 'Sí, anular aprobación' : 'Sí, eliminar' }}
      </button>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="confirmar = null">
        Cancelar
      </button>
    </div>

    <div v-if="error" class="alert alert-danger mb-0" role="alert">{{ error }}</div>

    <div class="sum">
      <span><b>Total </b>{{ clp(fila.total) }}</span>
      <template v-if="aprobada">
        <span><b>Pagado </b>{{ clp(estadoPago.pagado) }}</span>
        <span><b>Saldo </b>{{ clp(estadoPago.saldo) }}</span>
      </template>
      <span v-if="fila.origen === 'App' && fila.decididoEn"
        ><b>Aprobada </b>{{ fdate(fila.decididoEn) }}</span
      >
      <span v-else><b>Origen </b>{{ fila.origen }}</span>
      <span v-if="pagos.length"><b>Pagos vinculados </b>{{ pagosTexto }}</span>
    </div>

    <div v-if="abriendo" class="small text-body-secondary">Abriendo la rendición…</div>
    <template v-else-if="abierta">
      <details class="card">
        <summary class="card-body py-2 small text-body-secondary">
          Movimientos ({{ abierta.eventos.length }})
        </summary>
        <div class="card-body pt-0"><LineaTiempo :eventos="abierta.eventos" /></div>
      </details>

      <RendicionEditor
        v-if="aprobada"
        v-model="abierta.borrador"
        modo="libro"
        :catalogos="cat.catalogos"
        :fotos="fotos"
        :problemas="problemas"
      >
        <template #acciones>
          <button type="button" class="btn btn-primary" :disabled="ocupado" @click="guardar">
            {{ ocupado && !progresoPdf ? 'Guardando…' : 'Guardar cambios' }}
          </button>
          <button type="button" class="btn btn-outline-secondary" @click="emit('cerrar')">
            Cancelar
          </button>
        </template>
      </RendicionEditor>
    </template>
  </section>
</template>
