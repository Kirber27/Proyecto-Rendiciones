<script setup lang="ts">
// Proveedores (spec 11): registro de proveedores con RUT para elegirlos en las líneas de gasto.
// Todos agregan; tesorería además edita, elimina/restaura e importa desde Excel.
import { computed, onMounted, ref, watch } from 'vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import ImportarProveedores from '@/components/proveedores/ImportarProveedores.vue'
import ProveedorForm from '@/components/proveedores/ProveedorForm.vue'
import { tr } from '@/domain/formato'
import { paginar } from '@/domain/libro'
import { buscarProveedores, validarProveedor } from '@/domain/proveedores'
import { formatearRut } from '@/domain/rut'
import { useAuthStore } from '@/stores/auth'
import { useProveedoresStore } from '@/stores/proveedores'
import type { Proveedor } from '@/types/proveedores'

const auth = useAuthStore()
const store = useProveedoresStore()

const mensaje = ref<{ tipo: 'success' | 'danger'; texto: string } | null>(null)
const buscar = ref('')
const pagina = ref(1)
const guardando = ref(false)
const confirmarEliminar = ref<string | null>(null)
/** Proveedor en edición (solo tesorería) con los valores escritos. */
const edicion = ref<{ id: string; nombre: string; rut: string } | null>(null)

const lista = computed(() => buscarProveedores(store.activos, buscar.value))
const vista = computed(() => paginar(lista.value, pagina.value))
watch(buscar, () => (pagina.value = 1))

onMounted(() => store.cargar())

function avisar(tipo: 'success' | 'danger', texto: string) {
  mensaje.value = { tipo, texto }
}

function creado(p: Proveedor) {
  avisar('success', `${tr(p.nombre)} agregado. Ya se puede elegir al rendir.`)
}

function editar(p: Proveedor) {
  confirmarEliminar.value = null
  edicion.value = { id: p.id, nombre: p.nombre, rut: formatearRut(p.rut) }
}

async function ejecutar(accion: () => Promise<string>) {
  guardando.value = true
  try {
    avisar('success', await accion())
  } catch (e) {
    avisar('danger', (e as Error).message)
  } finally {
    guardando.value = false
  }
}

function guardarEdicion() {
  const e = edicion.value
  if (!e) return
  const problemas = validarProveedor(e, store.proveedores, e.id)
  if (problemas.length) return avisar('danger', problemas.join(' '))
  void ejecutar(async () => {
    const p = await store.editar(e.id, { nombre: tr(e.nombre), rut: e.rut })
    edicion.value = null
    return `${tr(p.nombre)} guardado. Las rendiciones ya enviadas conservan los datos con que se rindieron.`
  })
}

function eliminar(p: Proveedor) {
  confirmarEliminar.value = null
  void ejecutar(async () => {
    await store.eliminar(p.id)
    return `${tr(p.nombre)} eliminado de la lista. Las rendiciones que lo usan no cambian.`
  })
}

function restaurar(p: Proveedor) {
  void ejecutar(async () => {
    await store.eliminar(p.id, false)
    return `${tr(p.nombre)} restaurado.`
  })
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle
      titulo="Proveedores"
      lead="Los proveedores que se eligen en cada gasto, con su RUT. Si al rendir no encuentras uno, agrégalo aquí."
    />

    <div
      v-if="mensaje"
      :class="['alert', `alert-${mensaje.tipo}`, 'mb-0']"
      role="status"
      aria-live="polite"
    >
      {{ mensaje.texto }}
    </div>

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <h2 class="mb-0">Agregar proveedor</h2>
        <ProveedorForm @creado="creado" />
      </div>
    </section>

    <ImportarProveedores v-if="auth.esTesoreria" @importado="avisar('success', $event)" />

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h2 class="mb-0">Proveedores ({{ store.activos.length }})</h2>
          <input
            v-model="buscar"
            type="search"
            class="form-control"
            style="max-width: 280px"
            placeholder="Buscar nombre o RUT"
            aria-label="Buscar nombre o RUT"
          />
        </div>

        <div v-if="store.error" class="alert alert-danger mb-0" role="alert">
          No se pudo cargar la lista: {{ store.error }}
        </div>
        <div v-else-if="!store.listo" class="text-body-secondary small">Cargando proveedores…</div>
        <template v-else>
          <div class="table-wrap">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th v-if="auth.esTesoreria"><span class="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in vista.items" :key="p.id">
                  <template v-if="edicion?.id === p.id">
                    <td>
                      <input
                        v-model="edicion.nombre"
                        class="form-control form-control-sm"
                        :aria-label="`Nombre de ${tr(p.nombre)}`"
                      />
                    </td>
                    <td>
                      <input
                        v-model="edicion.rut"
                        class="form-control form-control-sm mono"
                        style="width: 150px"
                        :aria-label="`RUT de ${tr(p.nombre)}`"
                      />
                    </td>
                    <td class="text-nowrap">
                      <button
                        type="button"
                        class="btn btn-sm btn-primary me-1"
                        :disabled="guardando"
                        @click="guardarEdicion"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary"
                        @click="edicion = null"
                      >
                        Cancelar
                      </button>
                    </td>
                  </template>
                  <template v-else>
                    <td>{{ tr(p.nombre) }}</td>
                    <td class="mono text-nowrap">{{ formatearRut(p.rut) }}</td>
                    <td v-if="auth.esTesoreria" class="text-nowrap text-end">
                      <template v-if="confirmarEliminar === p.id">
                        <span class="small text-body-secondary me-2">¿Eliminar?</span>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-danger me-1"
                          @click="eliminar(p)"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary"
                          @click="confirmarEliminar = null"
                        >
                          No
                        </button>
                      </template>
                      <template v-else>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary me-1"
                          :disabled="guardando"
                          :aria-label="`Editar ${tr(p.nombre)}`"
                          @click="editar(p)"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-danger"
                          :disabled="guardando"
                          :aria-label="`Eliminar ${tr(p.nombre)}`"
                          @click="confirmarEliminar = p.id"
                        >
                          Eliminar
                        </button>
                      </template>
                    </td>
                  </template>
                </tr>
                <tr v-if="!lista.length">
                  <td :colspan="auth.esTesoreria ? 3 : 2" class="text-center text-body-secondary py-3">
                    {{
                      buscar
                        ? 'Ningún proveedor coincide con la búsqueda.'
                        : 'Aún no hay proveedores. Agrega el primero arriba.'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <nav
            v-if="vista.paginas > 1"
            class="d-flex align-items-center gap-2 small"
            aria-label="Páginas de proveedores"
          >
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="vista.pagina <= 1"
              @click="pagina = vista.pagina - 1"
            >
              ← Anterior
            </button>
            <span class="text-body-secondary">
              Página {{ vista.pagina }} de {{ vista.paginas }} · {{ lista.length }} proveedores
            </span>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="vista.pagina >= vista.paginas"
              @click="pagina = vista.pagina + 1"
            >
              Siguiente →
            </button>
          </nav>
        </template>
      </div>
    </section>

    <details v-if="auth.esTesoreria && store.eliminados.length" class="card">
      <summary class="card-body py-2 text-body-secondary small">
        Proveedores eliminados ({{ store.eliminados.length }})
      </summary>
      <div class="card-body pt-0 d-flex flex-column gap-2">
        <div
          v-for="p in store.eliminados"
          :key="p.id"
          class="d-flex flex-wrap align-items-center gap-3"
        >
          <span>{{ tr(p.nombre) }}</span>
          <span class="mono small text-body-secondary">{{ formatearRut(p.rut) }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="guardando"
            :aria-label="`Restaurar ${tr(p.nombre)}`"
            @click="restaurar(p)"
          >
            Restaurar
          </button>
        </div>
      </div>
    </details>
  </div>
</template>
