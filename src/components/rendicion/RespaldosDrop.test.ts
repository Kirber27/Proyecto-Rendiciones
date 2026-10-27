import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RespaldosDrop from './RespaldosDrop.vue'

const archivo = (nombre: string, type: string) => new File(['x'], nombre, { type })

/** Simula elegir archivos en el input (jsdom no permite asignar `files` directamente). */
async function elegir(w: ReturnType<typeof mount>, archivos: File[]) {
  const input = w.find('input[type="file"]:not([capture])')
  Object.defineProperty(input.element, 'files', { value: archivos, configurable: true })
  await input.trigger('change')
}

describe('RespaldosDrop', () => {
  it('emite imágenes y PDF; avisa por lo demás', async () => {
    const w = mount(RespaldosDrop)
    await elegir(w, [
      archivo('form.jpg', 'image/jpeg'),
      archivo('boleta.pdf', 'application/pdf'),
      archivo('notas.docx', 'application/msword'),
    ])
    const emitido = w.emitted('agregar')![0]![0] as File[]
    expect(emitido.map((f) => f.name)).toEqual(['form.jpg', 'boleta.pdf'])
    expect(w.find('[role="alert"]').text()).toBe('«notas.docx» no es imagen ni PDF y no se agregó.')
  })

  it('el selector acepta PDF; la cámara solo fotos', () => {
    const w = mount(RespaldosDrop)
    expect(w.find('input:not([capture])').attributes('accept')).toBe('image/*,application/pdf')
    expect(w.find('input[capture]').attributes('accept')).toBe('image/*')
  })

  it('acepta archivos arrastrados', async () => {
    const w = mount(RespaldosDrop)
    await w.find('.drop').trigger('dragover')
    expect(w.find('.drop').classes()).toContain('drop-activa')
    await w
      .find('.drop')
      .trigger('drop', { dataTransfer: { files: [archivo('b.png', 'image/png')] } })
    expect(w.find('.drop').classes()).not.toContain('drop-activa')
    expect((w.emitted('agregar')![0]![0] as File[])[0]!.name).toBe('b.png')
  })

  it('muestra los respaldos y emite quitar', async () => {
    const w = mount(RespaldosDrop, {
      props: { respaldos: [{ url: 'blob:1', tipo: 'imagen', quitable: true }] },
    })
    await w.find('.thumb-quitar').trigger('click')
    expect(w.emitted('quitar')![0]).toEqual([0])
  })

  it('un PDF se muestra como ficha con su nombre que abre el archivo', () => {
    const w = mount(RespaldosDrop, {
      props: {
        respaldos: [
          { url: 'blob:1', tipo: 'imagen' },
          { url: 'blob:2', tipo: 'pdf', nombre: 'boleta-luz.pdf', quitable: true },
        ],
      },
    })
    const ficha = w.find('a.thumb-pdf')
    expect(ficha.attributes()).toMatchObject({
      href: 'blob:2',
      target: '_blank',
      rel: 'noopener',
      'aria-label': 'Abrir respaldo 2 (PDF)',
    })
    expect(ficha.text()).toBe('boleta-luz.pdf')
    expect(w.findAll('img')).toHaveLength(1)
    expect(w.findAll('.thumb-quitar')).toHaveLength(1)
  })

  it('deshabilitado no deja adjuntar', () => {
    const w = mount(RespaldosDrop, { props: { deshabilitado: true } })
    expect(w.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })
})
