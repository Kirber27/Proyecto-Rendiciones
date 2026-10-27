<script setup lang="ts">
// Monto en pesos: acepta "70389", "70.389" o "$ 70.389"; al salir del campo lo deja como "70.389".
import { miles, num } from '@/domain/formato'

const valor = defineModel<string | number | null | undefined>({ default: '' })
defineOptions({ inheritAttrs: false })

function formatear() {
  const s = String(valor.value ?? '').trim()
  if (!s) return
  const n = num(s)
  // Solo enteros se reformatean; con decimales se deja lo que escribió la persona.
  if (Number.isInteger(n)) valor.value = (n < 0 ? '-' : '') + miles(n)
}
</script>

<template>
  <input
    v-bind="$attrs"
    :value="valor ?? ''"
    class="form-control num"
    inputmode="numeric"
    autocomplete="off"
    @input="valor = ($event.target as HTMLInputElement).value"
    @blur="formatear"
  />
</template>
