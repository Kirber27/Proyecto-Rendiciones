<script setup lang="ts">
// Cuentas de usuario (auth.users) y su persona vinculada (8.6). Normalmente el vínculo es automático
// por correo; aquí se corrige a mano (p. ej. alguien que entró con otro correo).
import { computed, onMounted, ref } from 'vue'
import AppChip from '@/components/ui/AppChip.vue'
import { fdate, tr } from '@/domain/formato'
import {
  listarCuentas,
  vincularCuenta,
  type CuentaUsuario,
  type PersonaPerfil,
} from '@/services/personas'

const props = defineProps<{ personas: PersonaPerfil[]; miUsuario: string | null }>()
const emit = defineEmits<{ cambio: [texto: string]; error: [texto: string] }>()

const cuentas = ref<CuentaUsuario[]>([])
const cargando = ref(true)
const guardando = ref(false)

const sinVincular = computed(() => cuentas.value.filter((c) => !c.personaId).length)

async function cargar() {
  try {
    cuentas.value = await listarCuentas()
  } catch (e) {
    emit('error', (e as Error).message)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
defineExpose({ cargar })

async function vincular(c: CuentaUsuario, personaId: string) {
  guardando.value = true
  try {
    await vincularCuenta(c.userId, personaId || null)
    const p = props.personas.find((x) => x.id === personaId)
    emit(
      'cambio',
      p ? `Cuenta ${c.email} vinculada con ${tr(p.nombre)}.` : `Cuenta ${c.email} desvinculada.`,
    )
  } catch (e) {
    emit('error', (e as Error).message)
  } finally {
    await cargar()
    guardando.value = false
  }
}
</script>

<template>
  <details class="card" :open="sinVincular > 0">
    <summary class="card-body py-2 text-body-secondary small">
      Cuentas de usuario ({{ cuentas.length }})
      <template v-if="sinVincular"> · {{ sinVincular }} sin vincular</template>
    </summary>
    <div class="card-body pt-0 d-flex flex-column gap-2">
      <p class="small text-body-secondary mb-0">
        Cada cuenta se vincula sola con la persona que tiene su mismo correo. Corrígelo aquí si
        alguien entró con otro correo. Una cuenta sin persona no ve ningún dato.
      </p>
      <div v-if="cargando" class="small text-body-secondary">Cargando cuentas…</div>
      <div v-else class="table-wrap">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Correo de la cuenta</th>
              <th>Último ingreso</th>
              <th>Persona vinculada</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in cuentas" :key="c.userId">
              <td>
                {{ c.email }}
                <span v-if="c.userId === miUsuario" class="small text-body-secondary">(tú)</span>
              </td>
              <td class="mono">{{ c.ultimoIngreso ? fdate(c.ultimoIngreso) : '—' }}</td>
              <td class="d-flex align-items-center gap-2">
                <select
                  class="form-select form-select-sm"
                  style="width: 240px"
                  :value="c.personaId ?? ''"
                  :disabled="guardando || c.userId === miUsuario"
                  :aria-label="`Persona de la cuenta ${c.email}`"
                  @change="vincular(c, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Sin vincular</option>
                  <option v-for="p in personas" :key="p.id" :value="p.id">
                    {{ tr(p.nombre) }}
                  </option>
                </select>
                <AppChip v-if="!c.personaId" tono="warn">Sin persona</AppChip>
              </td>
            </tr>
            <tr v-if="!cuentas.length">
              <td colspan="3" class="text-center text-body-secondary py-3">Aún no hay cuentas.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </details>
</template>
