<script setup lang="ts">
// Agregar persona nueva (porta el formulario de vConfig). El código se sugiere mientras no se edite.
import { computed, ref, watch } from 'vue'
import { sugerirCodigo, validarPersonaNueva, type PersonaGestion } from '@/domain/personas'
import { tr } from '@/domain/formato'
import { NOMBRE_ROL, ROLES, type Rol } from '@/types/roles'

const props = defineProps<{ personas: PersonaGestion[]; guardando: boolean }>()
const emit = defineEmits<{
  agregar: [p: { nombre: string; correo: string; codigo: string; rol: Rol }]
}>()

const nombre = ref('')
const correo = ref('')
const codigo = ref('')
const rol = ref<Rol>('solicitante')
const codigoTocado = ref(false)
const problemas = ref<string[]>([])

const usados = computed(() => props.personas.map((p) => p.codigo))
watch(nombre, (n) => {
  if (!codigoTocado.value) codigo.value = tr(n).includes(' ') ? sugerirCodigo(n, usados.value) : ''
})

function agregar() {
  problemas.value = validarPersonaNueva(
    { nombre: nombre.value, correo: correo.value, codigo: codigo.value },
    props.personas,
  )
  if (problemas.value.length) return
  emit('agregar', {
    nombre: tr(nombre.value),
    correo: correo.value.trim().toLowerCase(),
    codigo: codigo.value.trim().toUpperCase(),
    rol: rol.value,
  })
}

/** Lo llama la pantalla cuando la persona quedó guardada. */
function limpiar() {
  nombre.value = ''
  correo.value = ''
  codigo.value = ''
  rol.value = 'solicitante'
  codigoTocado.value = false
  problemas.value = []
}
defineExpose({ limpiar })
</script>

<template>
  <section class="card">
    <form class="card-body d-flex flex-column gap-3" @submit.prevent="agregar">
      <div>
        <h2 class="mb-1">Agregar persona nueva</h2>
        <p class="small text-body-secondary mb-0">
          Para quienes llegan a Heca. Queda disponible de inmediato en el formulario de rendición y
          en todas las listas. Con su correo registrado ya puede ingresar.
        </p>
      </div>
      <div class="row g-3">
        <div class="col-12 col-md-6 col-lg-4">
          <label class="label-caps" for="np-nombre">Nombre</label>
          <input
            id="np-nombre"
            v-model="nombre"
            class="form-control"
            placeholder="Nombre y apellido"
            autocomplete="off"
          />
        </div>
        <div class="col-12 col-md-6 col-lg-4">
          <label class="label-caps" for="np-correo">Correo</label>
          <input
            id="np-correo"
            v-model="correo"
            type="email"
            class="form-control"
            placeholder="nombre@hecaglobal.com"
            autocomplete="off"
          />
        </div>
        <div class="col-6 col-lg-2">
          <label class="label-caps" for="np-codigo">Código</label>
          <input
            id="np-codigo"
            v-model="codigo"
            class="form-control mono text-uppercase"
            maxlength="4"
            placeholder="Ej: JPE"
            @input="codigoTocado = true"
          />
        </div>
        <div class="col-6 col-lg-2">
          <label class="label-caps" for="np-rol">Función</label>
          <select id="np-rol" v-model="rol" class="form-select">
            <option v-for="r in ROLES" :key="r" :value="r">{{ NOMBRE_ROL[r] }}</option>
          </select>
        </div>
      </div>
      <div v-if="problemas.length" class="alert alert-danger py-2 mb-0 small" role="alert">
        <ul class="mb-0 ps-3">
          <li v-for="p in problemas" :key="p">{{ p }}</li>
        </ul>
      </div>
      <div>
        <button type="submit" class="btn btn-primary" :disabled="guardando">
          {{ guardando ? 'Agregando…' : 'Agregar persona' }}
        </button>
      </div>
    </form>
  </section>
</template>
