<script setup lang="ts">
// Perfiles (spec 08): personas del historial y nuevas, su función, código y correo.
// Las reglas se revisan en pantalla (domain/personas.ts) y en la base (RPC); manda la base.
import { computed, onMounted, ref } from 'vue'
import PageTitle from '@/components/layout/PageTitle.vue'
import FormPersonaNueva from '@/components/perfiles/FormPersonaNueva.vue'
import AppChip from '@/components/ui/AppChip.vue'
import { fdate, norm, tr } from '@/domain/formato'
import {
  cambiarFuncion,
  puedeEliminar,
  validarCorreo,
  type PersonaGestion,
} from '@/domain/personas'
import {
  asignarRol,
  eliminarPersona,
  guardarPersona,
  listarPersonasPerfil,
  restaurarPersona,
  type PersonaPerfil,
} from '@/services/personas'
import { useAuthStore } from '@/stores/auth'
import { useCatalogosStore } from '@/stores/catalogos'
import { NOMBRE_ROL, ROLES, type Rol } from '@/types/roles'

const auth = useAuthStore()
const catalogos = useCatalogosStore()

const personas = ref<PersonaPerfil[]>([])
const cargando = ref(true)
const guardando = ref(false)
const mensaje = ref<{ tipo: 'success' | 'danger'; texto: string } | null>(null)
const buscar = ref('')
const confirmarEliminar = ref<string | null>(null)
const form = ref<InstanceType<typeof FormPersonaNueva>>()

const INFO_ROL: Record<Rol, string> = {
  administrador: 'Gestiona perfiles y ve todo',
  tesorero: 'Aprueba, ingresa, concilia y paga',
  solicitante: 'Solo sube sus rendiciones',
}

const activas = computed(() => personas.value.filter((p) => !p.eliminadaEn))
const eliminadas = computed(() => personas.value.filter((p) => p.eliminadaEn))
/** Para las reglas del dominio (todas, incluidas las eliminadas). */
const gestion = computed<PersonaGestion[]>(() =>
  personas.value.map((p) => ({ ...p, eliminada: !!p.eliminadaEn })),
)
const filas = computed(() => {
  const q = norm(buscar.value)
  return activas.value
    .filter((p) => !q || norm(p.nombre).includes(q) || norm(p.correo).includes(q))
    .sort(
      (a, b) =>
        ROLES.indexOf(a.rol) - ROLES.indexOf(b.rol) || norm(a.nombre).localeCompare(norm(b.nombre)),
    )
})
const porRol = (r: Rol) => activas.value.filter((p) => p.rol === r).length
const nombreDe = (id: string | null) => tr(personas.value.find((p) => p.id === id)?.nombre ?? '')

async function cargar() {
  try {
    personas.value = await listarPersonasPerfil()
  } catch (e) {
    avisar('danger', (e as Error).message)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

function avisar(tipo: 'success' | 'danger', texto: string) {
  mensaje.value = { tipo, texto }
}

/** Después de cada cambio: refrescar la lista, los catálogos y, si me afecta, mi propia sesión. */
async function refrescar(afectadas: (string | null)[] = []) {
  await Promise.all([cargar(), catalogos.recargar()])
  if (auth.persona && afectadas.includes(auth.persona.id)) await auth.cargarPersona()
}

async function ejecutar(accion: () => Promise<string>, afectadas: (string | null)[] = []) {
  guardando.value = true
  try {
    const texto = await accion()
    await refrescar(afectadas)
    avisar('success', texto)
  } catch (e) {
    avisar('danger', (e as Error).message)
    await cargar() // volver a mostrar lo que hay realmente en la base
  } finally {
    guardando.value = false
  }
}

function cambiarCorreo(p: PersonaPerfil, valor: string) {
  const correo = valor.trim().toLowerCase()
  if (correo === (p.correo ?? '')) return
  const problema = validarCorreo(p.id, correo, gestion.value)
  if (problema) return avisar('danger', problema)
  void ejecutar(async () => {
    await guardarPersona({ id: p.id, nombre: p.nombre, codigo: p.codigo, correo })
    return correo
      ? `Correo de ${tr(p.nombre)} guardado. Ya puede ingresar.`
      : `Correo de ${tr(p.nombre)} borrado.`
  })
}

function cambiarRol(p: PersonaPerfil, rol: Rol) {
  const r = cambiarFuncion(p.id, rol, gestion.value)
  if (!r.ok) {
    avisar('danger', r.error)
    void cargar()
    return
  }
  void ejecutar(async () => {
    const degradado = await asignarRol(p.id, rol)
    const extra = degradado ? ` ${nombreDe(degradado)} pasa a Solicitante.` : ''
    return `${tr(p.nombre)} ahora es ${NOMBRE_ROL[rol]}.${extra}`
  }, [p.id, r.degradar])
}

function pedirEliminar(p: PersonaPerfil) {
  const problema = puedeEliminar(p.id, gestion.value)
  if (problema) return avisar('danger', problema)
  confirmarEliminar.value = p.id
}

function eliminar(p: PersonaPerfil) {
  confirmarEliminar.value = null
  void ejecutar(async () => {
    await eliminarPersona(p.id)
    return `${tr(p.nombre)} eliminado de las listas. Su historial se mantiene.`
  }, [p.id])
}

function restaurar(p: PersonaPerfil) {
  void ejecutar(async () => {
    await restaurarPersona(p.id)
    return `${tr(p.nombre)} restaurado.`
  })
}

function agregar(n: { nombre: string; correo: string; codigo: string; rol: Rol }) {
  void ejecutar(async () => {
    const id = await guardarPersona({ nombre: n.nombre, codigo: n.codigo, correo: n.correo })
    if (n.rol !== 'solicitante') await asignarRol(id, n.rol)
    form.value?.limpiar()
    return `${n.nombre} agregado como ${NOMBRE_ROL[n.rol]}.`
  })
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <PageTitle
      titulo="Perfiles"
      lead="Todas las personas que rinden, las del historial y las nuevas. Asigna a cada una su función y su correo: con el correo registrado puede ingresar a la app."
    />

    <div class="row row-cols-1 row-cols-md-3 g-3">
      <div v-for="r in ROLES" :key="r" class="col">
        <div class="card h-100">
          <div class="card-body d-flex flex-column gap-1">
            <div class="d-flex justify-content-between align-items-baseline">
              <b>{{ NOMBRE_ROL[r] }}</b>
              <AppChip :tono="r === 'solicitante' ? 'muted' : r === 'tesorero' ? 'ok' : 'info'">
                {{ porRol(r) }}
              </AppChip>
            </div>
            <span class="small text-body-secondary">{{ INFO_ROL[r] }}</span>
          </div>
        </div>
      </div>
    </div>

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
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h2 class="mb-0">Personas ({{ activas.length }})</h2>
          <input
            v-model="buscar"
            type="search"
            class="form-control"
            style="max-width: 280px"
            placeholder="Buscar persona o correo"
            aria-label="Buscar persona o correo"
          />
        </div>

        <div v-if="cargando" class="text-body-secondary small">Cargando personas…</div>
        <div v-else class="table-wrap">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Código</th>
                <th>Correo</th>
                <th>Función</th>
                <th class="n">Rendiciones</th>
                <th>Origen</th>
                <th>Cuenta</th>
                <th><span class="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in filas" :key="p.id">
                <td>
                  {{ tr(p.nombre) }}
                  <span v-if="p.id === auth.persona?.id" class="small text-body-secondary"
                    >(tú)</span
                  >
                </td>
                <td class="mono">{{ p.codigo }}</td>
                <td>
                  <input
                    type="email"
                    class="form-control form-control-sm"
                    style="width: 240px"
                    :value="p.correo ?? ''"
                    :disabled="guardando"
                    placeholder="correo@hecaglobal.com"
                    :aria-label="`Correo de ${tr(p.nombre)}`"
                    @change="cambiarCorreo(p, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <select
                    class="form-select form-select-sm"
                    style="width: 150px"
                    :value="p.rol"
                    :disabled="guardando"
                    :aria-label="`Función de ${tr(p.nombre)}`"
                    @change="cambiarRol(p, ($event.target as HTMLSelectElement).value as Rol)"
                  >
                    <option v-for="r in ROLES" :key="r" :value="r">{{ NOMBRE_ROL[r] }}</option>
                  </select>
                </td>
                <td class="n">{{ p.rendiciones || '' }}</td>
                <td class="small text-body-secondary">{{ p.esNueva ? 'Nueva' : 'Historial' }}</td>
                <td>
                  <AppChip v-if="p.vinculada" tono="ok">Vinculada</AppChip>
                  <AppChip v-else-if="p.correo" tono="muted">Sin ingresar</AppChip>
                  <AppChip v-else tono="warn">Sin correo</AppChip>
                </td>
                <td class="text-nowrap">
                  <template v-if="confirmarEliminar === p.id">
                    <span class="small text-body-secondary me-2">
                      {{ p.rendiciones ? 'Su historial se mantiene.' : '¿Eliminar?' }}
                    </span>
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
                  <button
                    v-else
                    type="button"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="guardando"
                    :aria-label="`Eliminar a ${tr(p.nombre)}`"
                    @click="pedirEliminar(p)"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
              <tr v-if="!filas.length">
                <td colspan="8" class="text-center text-body-secondary py-3">
                  Ninguna persona coincide con la búsqueda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <details v-if="eliminadas.length" class="card">
      <summary class="card-body py-2 text-body-secondary small">
        Personas eliminadas ({{ eliminadas.length }})
      </summary>
      <div class="card-body pt-0 d-flex flex-column gap-2">
        <div v-for="p in eliminadas" :key="p.id" class="d-flex flex-wrap align-items-center gap-3">
          <span style="min-width: 220px">{{ tr(p.nombre) }}</span>
          <span class="small text-body-secondary">Eliminada el {{ fdate(p.eliminadaEn) }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="guardando"
            @click="restaurar(p)"
          >
            Restaurar
          </button>
        </div>
      </div>
    </details>

    <FormPersonaNueva ref="form" :personas="gestion" :guardando="guardando" @agregar="agregar" />

    <p class="small text-body-secondary mb-0">
      Al registrar el correo de una persona, puede entrar con un código que le llega a ese correo.
      Su función decide qué pestañas ve; los permisos reales los aplica la base de datos.
    </p>
  </div>
</template>
