import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { borradorDemo, catalogosDemo } from '@/dev/catalogosDemo'
import { lineaVacia } from '@/domain/rendicion'
import type { ModoEditor } from '@/types/rendicion'

const siguienteNro = vi.hoisted(() => vi.fn())
const nrosFaltantes = vi.hoisted(() => vi.fn())
const documentoRepetido = vi.hoisted(() => vi.fn())
vi.mock('@/services/rendiciones', () => ({ siguienteNro, nrosFaltantes, documentoRepetido }))
// Proveedores FICTICIOS (RUT calculados con el módulo 11)
const listarProveedores = vi.hoisted(() => vi.fn())
const crearProveedor = vi.hoisted(() => vi.fn())
vi.mock('@/services/proveedores', () => ({ listarProveedores, crearProveedor }))
const crearSubcuenta = vi.hoisted(() => vi.fn())
vi.mock('@/services/catalogos', () => ({ crearSubcuenta, leerCatalogos: vi.fn() }))
// Desmontar después de cada prueba: cancela las consultas pendientes del Nº de documento.
enableAutoUnmount(afterEach)

const { default: LineasGastos } = await import('./LineasGastos.vue')
const { default: RendicionEditor } = await import('./RendicionEditor.vue')

beforeEach(() => {
  setActivePinia(createPinia())
  listarProveedores.mockReset().mockResolvedValue([
    { id: 'pv-1', nombre: 'Ferretería Uno', rut: '12345678-5', eliminado: false },
    { id: 'pv-2', nombre: 'Bencinera Sur', rut: '76000000-0', eliminado: false },
    { id: 'pv-3', nombre: 'Cerrada', rut: '11111111-1', eliminado: true },
  ])
  siguienteNro.mockReset().mockImplementation(async (p: string) => (p === 'p-1' ? 43 : 8))
  nrosFaltantes.mockReset().mockResolvedValue([])
})

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
        .w.findAll('.gasto label')
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
    const boton = w.findAll('button').find((b) => b.text().includes('Agregar gasto'))!
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

  it('Nº de una rendición nueva: el siguiente de la persona elegida, de solo lectura', async () => {
    const { w, borrador } = montarEditor('persona', { nro: '', personaId: null })
    const nro = w.find('input.mono[readonly]')
    expect(nro.attributes('placeholder')).toBe('Elige el solicitante')
    expect(siguienteNro).not.toHaveBeenCalled()
    await w.find('select').setValue('p-1')
    await flushPromises()
    expect(siguienteNro).toHaveBeenCalledWith('p-1')
    expect(borrador.value.nro).toBe('43')
  })

  it('Nº de una rendición guardada: se conserva; si cambia la persona, el siguiente de la nueva', async () => {
    const { w, borrador } = montarEditor('aprobar', { id: 'r-1', nro: '42' })
    await flushPromises()
    expect(siguienteNro).not.toHaveBeenCalled()
    expect(borrador.value.nro).toBe('42')
    const otra = catalogosDemo.personas.find((p) => p.id !== 'p-1')!.id
    await w.find('select').setValue(otra)
    await flushPromises()
    expect(borrador.value.nro).toBe('8')
    await w.find('select').setValue('p-1')
    await flushPromises()
    expect(borrador.value.nro).toBe('42')
  })

  it('si no se puede consultar el Nº, queda vacío (lo asigna el servidor al enviar)', async () => {
    siguienteNro.mockRejectedValueOnce(new Error('sin red'))
    const { w, borrador } = montarEditor('persona', { nro: '42' })
    await flushPromises()
    expect(borrador.value.nro).toBe('')
    expect(w.find('input.mono[readonly]').attributes('placeholder')).toBe('Se asigna al enviar')
  })

  it('Nº faltantes: se avisan y se puede elegir uno; por defecto queda el siguiente', async () => {
    nrosFaltantes.mockImplementation(async (p: string) => (p === 'p-1' ? [4, 9] : []))
    const { w, borrador } = montarEditor('persona', { nro: '', personaId: null })
    await w.find('select').setValue('p-1')
    await flushPromises()
    expect(nrosFaltantes).toHaveBeenCalledWith('p-1')
    expect(w.text()).toContain('Faltan en el correlativo: 4, 9')
    const nro = w.findAll('select')[1]!
    expect(nro.findAll('option').map((o) => o.text())).toEqual([
      '43 · siguiente',
      '4 · faltante',
      '9 · faltante',
    ])
    expect(borrador.value).toMatchObject({ nro: '43', nroFaltante: false })
    await nro.setValue('4')
    expect(borrador.value).toMatchObject({ nro: '4', nroFaltante: true })
    await nro.setValue('43')
    expect(borrador.value).toMatchObject({ nro: '43', nroFaltante: false })
    // Otra persona sin faltantes: vuelve el campo de solo lectura con su siguiente
    await nro.setValue('9')
    const otra = catalogosDemo.personas.find((p) => p.id !== 'p-1')!.id
    await w.find('select').setValue(otra)
    await flushPromises()
    expect(borrador.value).toMatchObject({ nro: '8', nroFaltante: false })
    expect(w.find('input.mono[readonly]').exists()).toBe(true)
    expect(w.text()).not.toContain('Faltan en el correlativo')
  })

  it('Nº faltantes en una rendición guardada: el Nº actual por defecto', async () => {
    nrosFaltantes.mockResolvedValue([4])
    const { w, borrador } = montarEditor('libro', { id: 'r-1', nro: '42' })
    await flushPromises()
    expect(siguienteNro).not.toHaveBeenCalled()
    const nro = w.findAll('select')[1]!
    expect(nro.findAll('option').map((o) => o.text())).toEqual(['42 · actual', '4 · faltante'])
    await nro.setValue('4')
    expect(borrador.value).toMatchObject({ nro: '4', nroFaltante: true })
  })

  it('si no se pueden consultar los faltantes, sigue con el Nº por defecto', async () => {
    nrosFaltantes.mockRejectedValueOnce(new Error('sin red'))
    const { w, borrador } = montarEditor('persona')
    await flushPromises()
    expect(borrador.value.nro).toBe('43')
    expect(w.find('input.mono[readonly]').exists()).toBe(true)
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

describe('LineasGastos', () => {
  function montarTabla(conCuentas = true) {
    const lineas = ref(borradorDemo().lineas)
    const w = mount(LineasGastos, {
      props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas },
    })
    return { w, lineas }
  }

  it('al elegir subcuenta propone su cuenta', async () => {
    const { w, lineas } = montarTabla()
    await w.find('select[aria-label="Subcuenta gasto 1"]').setValue('8') // Bencina
    expect(lineas.value[0]!.subcuentaId).toBe(8)
    expect(lineas.value[0]!.cuentaId).toBe(2) // Operacionales
  })

  it('una subcuenta sin sugerencia no cambia la cuenta', async () => {
    const { w, lineas } = montarTabla()
    await w.find('select[aria-label="Subcuenta gasto 1"]').setValue('41') // TAG, sin sugerencia
    expect(lineas.value[0]!.cuentaId).toBe(9)
  })

  it('el total de la línea se recalcula al editar', async () => {
    const { w } = montarTabla()
    await w.find('input[aria-label="Monto gasto 1"]').setValue('80.389')
    expect(w.find('.gasto-total').text()).toBe('$ 80.389')
  })

  it('quitar un gasto con datos pide confirmación; quitar el único deja uno vacío', async () => {
    const { w, lineas } = montarTabla()
    await w.find('button[aria-label="Quitar gasto 1"]').trigger('click')
    expect(w.text()).toContain('¿Quitar el gasto 1?')
    expect(lineas.value[0]!.proveedor).toBe('ISP')
    const boton = (texto: string) => w.findAll('.gasto button').find((b) => b.text() === texto)!
    await boton('Cancelar').trigger('click')
    expect(w.text()).not.toContain('¿Quitar el gasto 1?')
    await w.find('button[aria-label="Quitar gasto 1"]').trigger('click')
    await boton('Quitar').trigger('click')
    expect(lineas.value).toHaveLength(1)
    expect(lineas.value[0]!.proveedor).toBe('')
    // Un gasto vacío se quita sin preguntar
    lineas.value.push(lineaVacia())
    await nextTick()
    await w.find('button[aria-label="Quitar gasto 2"]').trigger('click')
    expect(lineas.value).toHaveLength(1)
  })

  describe('proveedor', () => {
    // La lista y el modal se dibujan en <body>: se montan adjuntos al documento.
    afterEach(() => {
      document.body.innerHTML = ''
    })
    async function abrir() {
      const lineas = ref(borradorDemo().lineas)
      const w = mount(LineasGastos, {
        props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas: false },
        attachTo: document.body,
      })
      await flushPromises()
      const input = w.find('input[aria-label="Proveedor gasto 1"]')
      await input.trigger('focus')
      return { w, lineas, input }
    }
    const opciones = () =>
      [...document.querySelectorAll('[role="option"]')].map((o) =>
        [...o.children].map((c) => c.textContent!.trim()).join(' '),
      )

    it('una línea antigua muestra su texto como "(sin registrar)" y el RUT es de solo lectura', async () => {
      const { w } = await abrir()
      w.unmount()
      const lineas = ref(borradorDemo().lineas)
      const otra = mount(LineasGastos, {
        props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas: false },
      })
      await flushPromises()
      const prov = otra.find('input[aria-label="Proveedor gasto 1"]')
      expect((prov.element as HTMLInputElement).value).toBe('ISP (sin registrar)')
      expect(otra.find('input[aria-label="RUT gasto 1"]').attributes('readonly')).toBeDefined()
    })

    it('lista los activos ordenados, busca por RUT y al elegir completa nombre y RUT', async () => {
      const { w, lineas, input } = await abrir()
      expect(input.attributes('aria-expanded')).toBe('true')
      expect(opciones()).toEqual([
        'Bencinera Sur 76.000.000-0',
        'Ferretería Uno 12.345.678-5',
        '¿No está? Agrégalo',
      ])
      await input.setValue('12.345')
      expect(opciones()).toEqual(['Ferretería Uno 12.345.678-5', '¿No está? Agrégalo'])
      document.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent('mousedown'))
      await nextTick()
      expect(lineas.value[0]).toMatchObject({
        proveedorId: 'pv-1',
        proveedor: 'Ferretería Uno',
        rut: '12345678-5',
      })
      expect((w.find('input[aria-label="RUT gasto 1"]').element as HTMLInputElement).value).toBe(
        '12.345.678-5',
      )
      expect(document.querySelector('[role="listbox"]')).toBeNull()
    })

    it('se maneja con el teclado', async () => {
      const { lineas, input } = await abrir()
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'Enter' })
      expect(lineas.value[0]!.proveedorId).toBe('pv-1') // la segunda: Ferretería Uno
      await input.trigger('focus')
      await input.trigger('keydown', { key: 'Escape' })
      expect(document.querySelector('[role="listbox"]')).toBeNull()
    })

    it('"¿No está? Agrégalo" crea el proveedor en un modal y lo deja elegido', async () => {
      const { lineas, input } = await abrir()
      await input.trigger('keydown', { key: 'ArrowUp' }) // desde la primera, vuelve a "Agrégalo"
      await input.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      const modal = document.querySelector('[role="dialog"]')!
      expect(modal.textContent).toContain('Agregar proveedor')
      crearProveedor.mockResolvedValue({
        id: 'pv-9',
        nombre: 'Nuevo Taller',
        rut: '10000013-K',
        eliminado: false,
      })
      const [nombre, rut] = modal.querySelectorAll('input')
      nombre!.value = 'Nuevo Taller'
      nombre!.dispatchEvent(new Event('input'))
      rut!.value = '10000013-K'
      rut!.dispatchEvent(new Event('input'))
      modal.querySelector('form')!.dispatchEvent(new Event('submit'))
      await flushPromises()
      expect(crearProveedor).toHaveBeenCalledWith({ nombre: 'Nuevo Taller', rut: '10000013-K' })
      expect(lineas.value[0]).toMatchObject({ proveedorId: 'pv-9', rut: '10000013-K' })
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    })
  })

  it('impuesto especial: columna opcional después de Exento que suma al total', async () => {
    const { w, lineas } = montarTabla()
    const etiquetas = w.findAll('.gasto label').map((t) => t.text())
    expect(etiquetas.indexOf('Imp. especial')).toBe(etiquetas.indexOf('Monto') + 1)
    await w.find('input[aria-label="Impuesto especial gasto 1"]').setValue('1.500')
    expect(lineas.value[0]!.otros).toBe('1.500')
    expect(w.find('.gasto-total').text()).toBe('$ 71.889')
  })

  describe('nueva subcuenta', () => {
    afterEach(() => {
      document.body.innerHTML = ''
    })
    function montarSub(puedeCrearSubcuenta: boolean) {
      const lineas = ref(borradorDemo().lineas)
      const w = mount(LineasGastos, {
        props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas: true, puedeCrearSubcuenta },
        attachTo: document.body,
      })
      return { w, lineas }
    }
    const selector = (w: ReturnType<typeof mount>) => w.find('select[aria-label="Subcuenta gasto 1"]')
    const dialogo = () => document.querySelector('[role="dialog"]')
    async function escribirNombre(nombre: string) {
      const input = dialogo()!.querySelector('input')!
      input.value = nombre
      input.dispatchEvent(new Event('input'))
      dialogo()!.querySelector('form')!.dispatchEvent(new Event('submit'))
      await flushPromises()
    }

    it('solo tesorería ve "+ Nueva subcuenta…"', () => {
      expect(selector(montarSub(false).w).text()).not.toContain('Nueva subcuenta')
      expect(selector(montarSub(true).w).text()).toContain('+ Nueva subcuenta…')
    })

    it('abre el modal sin cambiar la subcuenta; al crearla queda en la línea con su cuenta', async () => {
      const { w, lineas } = montarSub(true)
      await selector(w).setValue('__nueva')
      expect(lineas.value[0]!.subcuentaId).toBe(40)
      expect((selector(w).element as HTMLSelectElement).value).toBe('40')
      expect(dialogo()!.textContent).toContain('Nueva subcuenta')
      crearSubcuenta.mockResolvedValue({ id: 99, nombre: 'Peajes urbanos', cuentaSugeridaId: 2 })
      const cuenta = dialogo()!.querySelector('select')!
      cuenta.value = '2'
      cuenta.dispatchEvent(new Event('change'))
      await escribirNombre('Peajes urbanos')
      expect(crearSubcuenta).toHaveBeenCalledWith('Peajes urbanos', 2)
      expect(lineas.value[0]).toMatchObject({ subcuentaId: 99, cuentaId: 2 })
      expect(dialogo()).toBeNull()
    })

    it('si ya existe, avisa y permite usar la existente', async () => {
      const { w, lineas } = montarSub(true)
      await selector(w).setValue('__nueva')
      await escribirNombre('bencina')
      expect(crearSubcuenta).not.toHaveBeenCalled()
      expect(dialogo()!.textContent).toContain('Ya existe la subcuenta «Bencina».')
      ;[...dialogo()!.querySelectorAll('button')]
        .find((b) => b.textContent!.includes('Usar «Bencina»'))!
        .click()
      await flushPromises()
      expect(lineas.value[0]).toMatchObject({ subcuentaId: 8, cuentaId: 2 })
    })

    it('cancelar deja la línea como estaba', async () => {
      const { w, lineas } = montarSub(true)
      await selector(w).setValue('__nueva')
      ;[...dialogo()!.querySelectorAll('button')].find((b) => b.textContent!.includes('Cancelar'))!.click()
      await flushPromises()
      expect(dialogo()).toBeNull()
      expect(lineas.value[0]!.subcuentaId).toBe(40)
    })
  })

  describe('IVA calculado', () => {
    const factura = () =>
      borradorDemo().lineas.map((l) => ({ ...l, tipo: 'Factura' as const, neto: '1.000', iva: '191', exento: '' }))
    const montarFactura = () => {
      const lineas = ref(factura())
      const w = mount(LineasGastos, {
        props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas: false },
      })
      return { w, lineas }
    }
    const iva = (w: ReturnType<typeof mount>) => w.find('input[aria-label="IVA gasto 1"]')

    it('es de solo lectura y una línea guardada conserva el suyo mientras no se toque', () => {
      const { w, lineas } = montarFactura()
      expect(iva(w).attributes('readonly')).toBeDefined()
      expect(lineas.value[0]!.iva).toBe('191')
    })

    it('se recalcula al escribir el neto', async () => {
      const { w, lineas } = montarFactura()
      await w.find('input[aria-label="Neto gasto 1"]').setValue('84.034')
      expect(lineas.value[0]!.iva).toBe('15.966')
      expect((iva(w).element as HTMLInputElement).value).toBe('15.966')
      expect(w.find('.gasto-total').text()).toBe('$ 100.000')
    })

    it('al pasar a Boleta queda en 0; al volver a Factura se recalcula', async () => {
      const { w, lineas } = montarFactura()
      const tipo = w.find('select[aria-label="Tipo gasto 1"]')
      await tipo.setValue('Boleta')
      expect(lineas.value[0]).toMatchObject({ tipo: 'Boleta', iva: '' })
      await tipo.setValue('Factura')
      expect(lineas.value[0]).toMatchObject({ tipo: 'Factura', iva: '190' })
    })
  })

  describe('Nº de documento único', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      documentoRepetido.mockReset().mockResolvedValue(false)
    })
    afterEach(() => vi.useRealTimers())

    function montarCon(lineasIniciales: ReturnType<typeof borradorDemo>['lineas'], rendicionId?: string) {
      const lineas = ref(lineasIniciales)
      const w = mount(LineasGastos, {
        props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas: false, rendicionId },
      })
      return { w, lineas }
    }
    const conDoc = (numero: string) =>
      borradorDemo().lineas.map((l) => ({ ...l, proveedorId: 'pv-1', rut: '12345678-5', numero }))
    const esperar = async () => {
      await vi.advanceTimersByTimeAsync(400)
      await flushPromises()
    }
    const doc = (w: ReturnType<typeof mount>) => w.find('input[aria-label="Nº documento gasto 1"]')

    it('formulario nuevo: consulta la base y marca en rojo si ya está cargado', async () => {
      documentoRepetido.mockResolvedValue(true)
      const { w, lineas } = montarCon(conDoc('A-1'))
      await esperar()
      expect(documentoRepetido).toHaveBeenCalledWith('12345678-5', 'Boleta', 'A-1', undefined)
      expect(lineas.value[0]!.numeroRepetido).toBe(true)
      expect(doc(w).classes()).toContain('is-invalid')
      expect(w.find('.invalid-feedback').text()).toBe(
        'Este Nº de documento ya está cargado para este proveedor.',
      )

      // Al corregir el Nº se quita la marca y se vuelve a consultar
      documentoRepetido.mockResolvedValue(false)
      await doc(w).setValue('A-2')
      expect(lineas.value[0]!.numeroRepetido).toBe(false)
      expect(doc(w).classes()).not.toContain('is-invalid')
      await esperar()
      expect(documentoRepetido).toHaveBeenLastCalledWith('12345678-5', 'Boleta', 'A-2', undefined)
      expect(documentoRepetido).toHaveBeenCalledTimes(2)
    })

    it('rendición guardada: no revisa lo que ya tenía; al cambiarlo consulta excluyéndose', async () => {
      const { w } = montarCon(conDoc('A-1'), 'r-1')
      await esperar()
      expect(documentoRepetido).not.toHaveBeenCalled()
      await doc(w).setValue('A-3')
      await esperar()
      expect(documentoRepetido).toHaveBeenCalledWith('12345678-5', 'Boleta', 'A-3', 'r-1')
    })

    it('sin RUT o sin Nº no consulta', async () => {
      montarCon(borradorDemo().lineas) // línea del historial: sin RUT
      await esperar()
      expect(documentoRepetido).not.toHaveBeenCalled()
    })

    it('repetido dentro del formulario: lo marca sin consultar', async () => {
      const lineas = [...conDoc('A-1'), ...conDoc('a-1')]
      const { w } = montarCon(lineas, 'r-1')
      await esperar()
      const segunda = w.find('input[aria-label="Nº documento gasto 2"]')
      expect(segunda.classes()).toContain('is-invalid')
      expect(w.find('.invalid-feedback').text()).toBe('Repite el Nº del gasto 1.')
      expect(doc(w).classes()).not.toContain('is-invalid')
    })
  })

  describe('colapsables', () => {
    const cuerpo = (w: ReturnType<typeof mount>, n: number) =>
      w.findAll<HTMLElement>('.accordion-body')[n]!.element.style.display !== 'none'
    const titulo = (w: ReturnType<typeof mount>, n: number) =>
      w.findAll('.accordion-button')[n]!

    it('título "Gasto N · Proveedor" con el total; sin proveedor lo dice', () => {
      const lineas = ref([borradorDemo().lineas[0]!, lineaVacia()])
      const w = mount(LineasGastos, {
        props: { modelValue: lineas.value, catalogos: catalogosDemo, conCuentas: false },
      })
      expect(titulo(w, 0).text()).toContain('Gasto 1 · ISP')
      expect(titulo(w, 0).find('.gasto-total').text()).toBe('$ 70.389')
      expect(titulo(w, 1).text()).toContain('Gasto 2 · Sin proveedor')
      expect(w.find('table').exists()).toBe(false)
    })

    it('un solo gasto queda abierto; varios, cerrados; se abren y cierran con el título', async () => {
      const uno = mount(LineasGastos, {
        props: { modelValue: borradorDemo().lineas, catalogos: catalogosDemo, conCuentas: false },
      })
      expect(cuerpo(uno, 0)).toBe(true)
      expect(titulo(uno, 0).attributes('aria-expanded')).toBe('true')

      const varios = mount(LineasGastos, {
        props: {
          modelValue: [borradorDemo().lineas[0]!, borradorDemo().lineas[0]!],
          catalogos: catalogosDemo,
          conCuentas: false,
        },
      })
      expect([cuerpo(varios, 0), cuerpo(varios, 1)]).toEqual([false, false])
      await titulo(varios, 1).trigger('click')
      expect(cuerpo(varios, 1)).toBe(true)
      expect(titulo(varios, 1).attributes('aria-expanded')).toBe('true')
      await titulo(varios, 1).trigger('click')
      expect(cuerpo(varios, 1)).toBe(false)
    })

    it('"Agregar gasto" desde el editor: el nuevo va al final, abierto y con el foco', async () => {
      const { w, borrador } = montarEditor('persona')
      const agregar = w.findAll('button').find((b) => b.text().includes('Agregar gasto'))!
      await agregar.trigger('click')
      await flushPromises()
      expect(borrador.value.lineas).toHaveLength(2)
      expect([cuerpo(w, 0), cuerpo(w, 1)]).toEqual([false, true])
      expect(titulo(w, 1).text()).toContain('Gasto 2 · Sin proveedor')
    })

    it('los gastos con problemas se marcan y se abren', async () => {
      const lineas = [borradorDemo().lineas[0]!, lineaVacia()]
      const w = mount(LineasGastos, {
        props: { modelValue: lineas, catalogos: catalogosDemo, conCuentas: false, problemas: [] },
      })
      expect(w.findAll('.gasto-problema')).toHaveLength(0)
      await w.setProps({ problemas: ['Falta la fecha.', 'Gasto 2: falta el monto.'] })
      const gastos = w.findAll('[data-test="gasto"]')
      expect(gastos[1]!.classes()).toContain('gasto-problema')
      expect(gastos[0]!.classes()).not.toContain('gasto-problema')
      expect(cuerpo(w, 1)).toBe(true)
    })

    it('boleta: "Monto" sin neto ni IVA; sin Cuenta para la persona', () => {
      const { w } = montarTabla(false)
      const etiquetas = w.findAll('.gasto label').map((t) => t.text())
      expect(etiquetas).toContain('Monto')
      expect(etiquetas).not.toContain('Neto')
      expect(etiquetas).not.toContain('Cuenta')
    })
  })

})
