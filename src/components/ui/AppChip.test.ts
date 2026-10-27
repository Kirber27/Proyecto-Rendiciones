import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppChip from './AppChip.vue'
import { tonoDe } from './tonos'

describe('tonoDe', () => {
  it('asigna el color de cada estado', () => {
    expect(tonoDe('Pagada')).toBe('ok')
    expect(tonoDe('Pago parcial')).toBe('warn')
    expect(tonoDe('Observada')).toBe('bad')
    expect(tonoDe('En revisión')).toBe('info')
    expect(tonoDe('Desconocido')).toBe('muted')
    expect(tonoDe(null)).toBe('muted')
  })
})

describe('AppChip', () => {
  it('pinta el estado con su tono', () => {
    const w = mount(AppChip, { props: { estado: 'Rechazada' } })
    expect(w.text()).toBe('Rechazada')
    expect(w.classes()).toContain('chip-bad')
  })
  it('acepta tono explícito y contenido propio', () => {
    const w = mount(AppChip, { props: { tono: 'warn' }, slots: { default: 'Diferencia $ 100' } })
    expect(w.text()).toBe('Diferencia $ 100')
    expect(w.classes()).toContain('chip-warn')
  })
  it('sin estado muestra una raya', () => {
    expect(mount(AppChip).text()).toBe('—')
  })
})
