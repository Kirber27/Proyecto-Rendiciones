import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FotoDrop from './FotoDrop.vue'

const archivo = (nombre: string, type: string) => new File(['x'], nombre, { type })

/** Simula elegir archivos en el input (jsdom no permite asignar `files` directamente). */
async function elegir(w: ReturnType<typeof mount>, archivos: File[]) {
  const input = w.find('input[type="file"]:not([capture])')
  Object.defineProperty(input.element, 'files', { value: archivos, configurable: true })
  await input.trigger('change')
}

describe('FotoDrop', () => {
  it('emite solo las imágenes y avisa por los PDF', async () => {
    const w = mount(FotoDrop)
    await elegir(w, [archivo('form.jpg', 'image/jpeg'), archivo('boleta.pdf', 'application/pdf')])
    const emitido = w.emitted('agregar')![0]![0] as File[]
    expect(emitido.map((f) => f.name)).toEqual(['form.jpg'])
    expect(w.find('[role="alert"]').text()).toContain('sube un pantallazo')
  })

  it('si todo es PDF no emite nada', async () => {
    const w = mount(FotoDrop)
    await elegir(w, [archivo('a.pdf', 'application/pdf'), archivo('b.pdf', 'application/pdf')])
    expect(w.emitted('agregar')).toBeUndefined()
    expect(w.find('[role="alert"]').text()).toContain('2 archivos no son imágenes')
  })

  it('acepta archivos arrastrados', async () => {
    const w = mount(FotoDrop)
    await w.find('.drop').trigger('dragover')
    expect(w.find('.drop').classes()).toContain('drop-activa')
    await w
      .find('.drop')
      .trigger('drop', { dataTransfer: { files: [archivo('b.png', 'image/png')] } })
    expect(w.find('.drop').classes()).not.toContain('drop-activa')
    expect((w.emitted('agregar')![0]![0] as File[])[0]!.name).toBe('b.png')
  })

  it('mientras lee muestra "Leyendo…" con Detener y no deja quitar fotos', async () => {
    const w = mount(FotoDrop, {
      props: { leyendo: true, fotos: [{ url: 'blob:1', quitable: true }] },
    })
    expect(w.text()).toContain('Leyendo la rendición…')
    expect(w.find('.thumb-quitar').exists()).toBe(false)
    await w.find('[role="status"] button').trigger('click')
    expect(w.emitted('detener')).toHaveLength(1)
  })

  it('muestra las miniaturas y emite quitar', async () => {
    const w = mount(FotoDrop, { props: { fotos: [{ url: 'blob:1', quitable: true }] } })
    await w.find('.thumb-quitar').trigger('click')
    expect(w.emitted('quitar')![0]).toEqual([0])
  })
})
