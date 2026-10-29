<script setup lang="ts">
// Selector de proveedor con búsqueda (combobox accesible) para las líneas de gasto (spec 11, R2.7–R2.9).
// Muestra el elegido; al escribir filtra por nombre o RUT. Al final ofrece agregar uno nuevo en un
// modal sin salir del formulario. La lista se dibuja en <body> con posición fija para que no la
// recorte el contenedor del formulario.
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import ProveedorForm from '@/components/proveedores/ProveedorForm.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { tr } from '@/domain/formato'
import { buscarProveedores } from '@/domain/proveedores'
import { formatearRut } from '@/domain/rut'
import { useProveedoresStore } from '@/stores/proveedores'
import type { Proveedor } from '@/types/proveedores'

const props = defineProps<{
  proveedorId: string | null
  /** Nombre guardado en la línea (líneas del historial sin proveedor de la lista). */
  texto: string
  etiqueta: string
  chico?: boolean
  /** Id del campo, para enlazarlo con su <label>. */
  inputId?: string
}>()
const emit = defineEmits<{ elegir: [p: Proveedor] }>()

/** Cuántas opciones se dibujan a la vez (la búsqueda acota el resto). */
const MAXIMO = 30

const store = useProveedoresStore()
const id = useId()
const input = ref<HTMLInputElement | null>(null)
const abierto = ref(false)
const consulta = ref('')
const activo = ref(0)
const modalAbierto = ref(false)
const posicion = ref({ top: 0, left: 0, width: 0 })

onMounted(() => store.cargar())

const elegido = computed(() => store.proveedores.find((p) => p.id === props.proveedorId) ?? null)
const mostrado = computed(() => {
  if (elegido.value) return tr(elegido.value.nombre)
  if (tr(props.texto)) return `${tr(props.texto)} (sin registrar)`
  return ''
})
const opciones = computed(() => buscarProveedores(store.activos, consulta.value).slice(0, MAXIMO))
/** Índice de "Agregar proveedor" (va después de las opciones). */
const indiceAgregar = computed(() => opciones.value.length)

function ubicar() {
  const r = input.value?.getBoundingClientRect()
  if (r) posicion.value = { top: r.bottom + 2, left: r.left, width: Math.max(r.width, 280) }
}

function abrir() {
  if (abierto.value) return
  consulta.value = ''
  activo.value = 0
  ubicar()
  abierto.value = true
}

function cerrar() {
  abierto.value = false
  consulta.value = ''
}

function escribir(e: Event) {
  consulta.value = (e.target as HTMLInputElement).value
  activo.value = 0
  if (!abierto.value) {
    ubicar()
    abierto.value = true
  }
}

function elegir(p: Proveedor) {
  emit('elegir', p)
  cerrar()
}

function teclas(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!abierto.value) return abrir()
    const total = indiceAgregar.value + 1
    activo.value = (activo.value + (e.key === 'ArrowDown' ? 1 : -1) + total) % total
  } else if (e.key === 'Enter' && abierto.value) {
    e.preventDefault()
    const p = opciones.value[activo.value]
    if (p) elegir(p)
    else abrirModal()
  } else if (e.key === 'Escape' && abierto.value) {
    e.preventDefault()
    cerrar()
  }
}

// Mientras la lista está abierta, sigue al campo si la página o la tabla se desplazan.
watch(abierto, (si) => {
  const accion = si ? 'addEventListener' : 'removeEventListener'
  window[accion]('scroll', ubicar, true)
  window[accion]('resize', ubicar)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', ubicar, true)
  window.removeEventListener('resize', ubicar)
})

function abrirModal() {
  cerrar()
  modalAbierto.value = true
}

function cerrarModal() {
  modalAbierto.value = false
  input.value?.focus()
}

function creado(p: Proveedor) {
  modalAbierto.value = false
  emit('elegir', p)
  input.value?.focus()
}
</script>

<template>
  <input
    :id="inputId"
    ref="input"
    :class="['form-control', chico && 'form-control-sm']"
    role="combobox"
    aria-autocomplete="list"
    :aria-expanded="abierto"
    :aria-controls="`${id}-lista`"
    :aria-activedescendant="abierto ? `${id}-op-${activo}` : undefined"
    :aria-label="etiqueta"
    :value="abierto ? consulta : mostrado"
    :placeholder="abierto ? 'Busca por nombre o RUT' : 'Elegir…'"
    autocomplete="off"
    @focus="abrir"
    @click="abrir"
    @input="escribir"
    @keydown="teclas"
    @blur="cerrar"
  />
  <Teleport to="body">
    <ul
      v-if="abierto"
      :id="`${id}-lista`"
      class="proveedor-lista list-unstyled mb-0"
      role="listbox"
      :aria-label="`Proveedores para ${etiqueta}`"
      :style="{
        top: `${posicion.top}px`,
        left: `${posicion.left}px`,
        width: `${posicion.width}px`,
      }"
    >
      <li v-if="!store.listo" class="px-2 py-1 small text-body-secondary">Cargando proveedores…</li>
      <li
        v-for="(p, i) in opciones"
        :id="`${id}-op-${i}`"
        :key="p.id"
        role="option"
        :aria-selected="i === activo"
        :class="['proveedor-op', i === activo && 'activo']"
        @mousedown.prevent="elegir(p)"
        @mousemove="activo = i"
      >
        <span>{{ tr(p.nombre) }}</span>
        <span class="mono small text-body-secondary">{{ formatearRut(p.rut) }}</span>
      </li>
      <li v-if="store.listo && !opciones.length" class="px-2 py-1 small text-body-secondary">
        {{ consulta ? 'Ningún proveedor coincide.' : 'Aún no hay proveedores.' }}
      </li>
      <li
        :id="`${id}-op-${indiceAgregar}`"
        role="option"
        :aria-selected="activo === indiceAgregar"
        :class="['proveedor-op proveedor-agregar', activo === indiceAgregar && 'activo']"
        @mousedown.prevent="abrirModal"
        @mousemove="activo = indiceAgregar"
      >
        <span><i class="bi bi-plus-lg" aria-hidden="true" /> ¿No está? Agrégalo</span>
      </li>
    </ul>
  </Teleport>

  <AppModal v-if="modalAbierto" titulo="Agregar proveedor" @cerrar="cerrarModal">
    <p class="small text-body-secondary mb-0">
      Queda en la lista de Proveedores para todos y se elige en esta línea.
    </p>
    <ProveedorForm @creado="creado" />
  </AppModal>
</template>

<style scoped lang="scss">
.proveedor-lista {
  position: fixed;
  z-index: 1060;
  max-height: 280px;
  overflow-y: auto;
  background: var(--app-surface);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  padding: 4px 0;
}
.proveedor-op {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  &.activo {
    background: var(--bs-primary-bg-subtle);
  }
}
.proveedor-agregar {
  border-top: 1px solid var(--bs-border-color);
  color: var(--bs-primary);
}
</style>
