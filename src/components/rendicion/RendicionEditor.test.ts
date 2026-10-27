import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { borradorDemo, catalogosDemo } from '@/dev/catalogosDemo'
import type { ModoEditor } from '@/types/rendicion'
import LineasTable from './LineasTable.vue'
import RendicionEditor from './RendicionEditor.vue'

function montarEditor(modo: ModoEditor, cambios = {}) {
  const borrador = ref({ ...borradorDemo(), ...cambios })
  const w = mount(RendicionEditor, {
    props: {
      modelValue: borrador.value,
      'onUpdate:modelValue': (v: typeof borrador.value) => (borrador.value = v),
      modo,
      catalogos: catalogosDemo,
    },
    slots: { acciones: '<button class="accion">Enviar</button>' },
  })
  return { w, borrador }
}

describe('MoneyInput', () => {
  it('al salir del campo deja el monto con punto de miles', async () => {
    const w = mount(MoneyInput, { props: { modelValue: '' } })
    const input = w.find('input')
    await input.setValue('$70389')
    await input.trigger('blur')
    const emitidos = w.emitted('update:modelValue')!
    expect(emitidos.at(-1)).toEqual(['70.389'])
  })
  it('respeta montos con decimales y vacíos', async () => {
    const w = mount(MoneyInput, { props: { modelValue: '1.234,50' } })
    await w.find('input').trigger('blur')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('RendicionEditor', () => {
  it('modo persona oculta Cuenta y C.C.; aprobar los muestra', () => {
    const cabeceras = (modo: ModoEditor) =>
      montarEditor(modo)
        .w.findAll('th')
        .map((t) => t.text())
    expect(cabeceras('persona')).not.toContain('Cuenta')
    expect(cabeceras('persona')).not.toContain('C.C.')
    expect(cabeceras('aprobar')).toEqual(expect.arrayContaining(['Cuenta', 'C.C.']))
  })

  it('muestra el cuadre', () => {
    const { w } = montarEditor('persona')
    expect(w.find('.sum').text()).toContain('Cuadra')
  })

  it('respaldos: por defecto los muestra; el slot #respaldos los reemplaza', () => {
    const base = { modelValue: borradorDemo(), modo: 'aprobar' as const, catalogos: catalogosDemo }
    expect(mount(RendicionEditor, { props: base }).text()).not.toContain('Respaldos')
    const conFotos = mount(RendicionEditor, {
      props: { ...base, respaldos: [{ url: 'blob:1', tipo: 'imagen' }] },
    })
    expect(conFotos.text()).toContain('Respaldos (1)')
    expect(conFotos.find('.thumbs img').exists()).toBe(true)
    const conSlot = mount(RendicionEditor, {
      props: base,
      slots: { respaldos: '<div class="zona">Adjuntar</div>' },
    })
    expect(conSlot.text()).toContain('Respaldos (0)')
    expect(conSlot.find('.zona').exists()).toBe(true)
  })

  it('el cuadre muestra la diferencia cuando no calza', () => {
    const { w } = montarEditor('persona', { totalFormulario: '80.389' })
    expect(w.find('.sum').text()).toContain('Diferencia -$ 10.000')
  })

  it('agregar línea hereda la fecha del formulario y el C.C. de la empresa', async () => {
    const { w, borrador } = montarEditor('aprobar', { fecha: '2026-10-20', empresaId: 1 })
    const boton = w.findAll('button').find((b) => b.text().includes('Agregar línea'))!
    await boton.trigger('click')
    const nueva = borrador.value.lineas.at(-1)!
    expect(borrador.value.lineas).toHaveLength(2)
    expect(nueva.fecha).toBe('2026-10-20')
    expect(nueva.centroCostoId).toBe(1) // HG
  })

  it('muestra los problemas y el slot de acciones', () => {
    const w = mount(RendicionEditor, {
      props: {
        modelValue: borradorDemo(),
        modo: 'persona',
        catalogos: catalogosDemo,
        problemas: ['Falta la fecha.'],
      },
      slots: { acciones: '<button class="accion">Enviar</button>' },
    })
    expect(w.find('[role="alert"]').text()).toContain('Falta la fecha.')
    expect(w.find('button.accion').exists()).toBe(true)
  })

  it('el solicitante fijo no se puede cambiar', () => {
    const w = mount(RendicionEditor, {
      props: {
        modelValue: borradorDemo(),
        modo: 'persona',
        catalogos: catalogosDemo,
        solicitanteFijo: true,
      },
    })
    expect(w.find('select').attributes('disabled')).toBeDefined()
  })
})

describe('LineasTable', () => {
  function montarTabla(conCuentas = true) {
    const lineas = ref(borradorDemo().lineas)
    const w = mount(LineasTable, {
      props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas },
    })
    return { w, lineas }
  }

  it('al elegir subcuenta propone su cuenta', async () => {
    const { w, lineas } = montarTabla()
    await w.find('select[aria-label="Subcuenta línea 1"]').setValue('8') // Bencina
    expect(lineas.value[0]!.subcuentaId).toBe(8)
    expect(lineas.value[0]!.cuentaId).toBe(2) // Operacionales
  })

  it('una subcuenta sin sugerencia no cambia la cuenta', async () => {
    const { w, lineas } = montarTabla()
    await w.find('select[aria-label="Subcuenta línea 1"]').setValue('41') // TAG, sin sugerencia
    expect(lineas.value[0]!.cuentaId).toBe(9)
  })

  it('el total de la línea se recalcula al editar', async () => {
    const { w } = montarTabla()
    await w.find('input[aria-label="Neto línea 1"]').setValue('10.000')
    expect(w.find('td.n').text()).toBe('$ 80.389')
  })

  it('quitar la única línea deja una vacía', async () => {
    const { w, lineas } = montarTabla()
    await w.find('button[aria-label="Quitar línea 1"]').trigger('click')
    expect(lineas.value).toHaveLength(1)
    expect(lineas.value[0]!.proveedor).toBe('')
  })

  describe('en el celular', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('muestra tarjetas con "Monto" en vez de neto/IVA para boletas', async () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
      )
      const { w } = montarTabla(false)
      await nextTick()
      expect(w.find('table').exists()).toBe(false)
      expect(w.text()).toContain('Gasto 1')
      expect(w.text()).toContain('Monto')
      expect(w.text()).not.toContain('Neto')
      expect(w.text()).not.toContain('Cuenta')
    })
  })
})
