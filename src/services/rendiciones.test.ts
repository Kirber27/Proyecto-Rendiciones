import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lineaVacia } from '@/domain/rendicion'
import type { BorradorRendicion } from '@/types/rendicion'

const sb = vi.hoisted(() => ({ upload: vi.fn(), rpc: vi.fn(), nro: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: sb.upload }) },
    rpc: sb.rpc,
    // Lectura del Nº asignado por el servidor tras enviar.
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: sb.nro }) }) }),
  },
}))
vi.mock('@/lib/imagenes', () => ({ reducirImagen: vi.fn(async (f: Blob) => f) }))
const { enviarRendicion, rutaRespaldo, siguienteNro } = await import('./rendiciones')

const PERSONA = 'p-1'
const borrador = (c: Partial<BorradorRendicion> = {}): BorradorRendicion => ({
  personaId: PERSONA,
  nro: '12',
  fecha: '2026-10-20',
  empresaId: 2,
  fondo: '',
  totalFormulario: '',
  lineas: [lineaVacia({ exento: '15.000' }), lineaVacia({ exento: '5.000' })],
  respaldos: [],
  ...c,
})
const foto = (id: string) => ({ id, file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }) })
const pdf = (id: string) => ({
  id,
  file: new File(['%PDF'], `${id}.pdf`, { type: 'application/pdf' }),
})

beforeEach(() => {
  sb.upload.mockReset().mockResolvedValue({ error: null })
  sb.rpc.mockReset().mockResolvedValue({ data: 'r-1', error: null })
  sb.nro.mockReset().mockResolvedValue({ data: { nro: 12 }, error: null })
})

describe('enviarRendicion', () => {
  it('sube cada foto a <persona>/<rendición>/<foto>.jpg y envía con sus rutas', async () => {
    const subidas = new Map<string, string>()
    const progreso: string[] = []
    const r = await enviarRendicion(borrador(), [foto('a'), foto('b')], {
      rendicionId: 'r-1',
      subidas,
      onProgreso: (t) => progreso.push(t),
    })
    expect(sb.upload).toHaveBeenCalledTimes(2)
    expect(sb.upload.mock.calls[0]![0]).toBe('p-1/r-1/a.jpg')
    const p = sb.rpc.mock.calls[0]![1].p
    expect(p).toMatchObject({ id: 'r-1', persona_id: 'p-1', nro: 12 })
    expect(p.respaldos).toEqual(['p-1/r-1/a.jpg', 'p-1/r-1/b.jpg'])
    expect(r).toEqual({ id: 'r-1', nro: 12, total: 20000, reenvio: false })
    expect(progreso).toEqual([
      'Guardando respaldo 1 de 2…',
      'Guardando respaldo 2 de 2…',
      'Enviando…',
    ])
  })

  it('los PDF se suben sin reducir, como .pdf y application/pdf', async () => {
    const { reducirImagen } = await import('@/lib/imagenes')
    vi.mocked(reducirImagen).mockClear()
    const archivo = pdf('c')
    await enviarRendicion(borrador(), [foto('a'), archivo], {
      rendicionId: 'r-1',
      subidas: new Map(),
    })
    expect(reducirImagen).toHaveBeenCalledTimes(1) // solo la foto
    expect(sb.upload.mock.calls[0]![2]).toMatchObject({ contentType: 'image/jpeg' })
    expect(sb.upload.mock.calls[1]).toEqual([
      'p-1/r-1/c.pdf',
      archivo.file,
      { contentType: 'application/pdf', upsert: false },
    ])
    expect(sb.rpc.mock.calls[0]![1].p.respaldos).toEqual(['p-1/r-1/a.jpg', 'p-1/r-1/c.pdf'])
  })

  it('reintenta una vez; "ya existe" cuenta como subida', async () => {
    sb.upload
      .mockResolvedValueOnce({ error: { message: 'red' } })
      .mockResolvedValueOnce({ error: null })
    sb.upload.mockResolvedValueOnce({ error: { message: 'The resource already exists' } })
    await enviarRendicion(borrador(), [foto('a'), foto('b')], {
      rendicionId: 'r-1',
      subidas: new Map(),
    })
    expect(sb.upload).toHaveBeenCalledTimes(3)
    expect(sb.rpc).toHaveBeenCalledTimes(1)
  })

  it('si una foto no sube, no envía y avisa cuál; el reintento solo sube la que faltó', async () => {
    const subidas = new Map<string, string>()
    sb.upload
      .mockResolvedValueOnce({ error: null }) // a
      .mockResolvedValueOnce({ error: { message: 'red' } }) // b, intento 1
      .mockResolvedValueOnce({ error: { message: 'red' } }) // b, intento 2
    await expect(
      enviarRendicion(borrador(), [foto('a'), foto('b')], { rendicionId: 'r-1', subidas }),
    ).rejects.toThrow('No se pudo guardar el respaldo 2')
    expect(sb.rpc).not.toHaveBeenCalled()

    sb.upload.mockReset().mockResolvedValue({ error: null })
    await enviarRendicion(borrador(), [foto('a'), foto('b')], { rendicionId: 'r-1', subidas })
    expect(sb.upload).toHaveBeenCalledTimes(1)
    expect(sb.upload.mock.calls[0]![0]).toBe(rutaRespaldo('p-1', 'r-1', 'b'))
  })

  it('reenvío: conserva los respaldos ya guardados y lo informa', async () => {
    const r = await enviarRendicion(
      borrador({ id: 'r-9', respaldos: ['p-1/r-9/viejo.jpg'] }),
      [foto('n')],
      {
        rendicionId: 'r-9',
        subidas: new Map(),
      },
    )
    expect(sb.rpc.mock.calls[0]![1].p.respaldos).toEqual(['p-1/r-9/viejo.jpg', 'p-1/r-9/n.jpg'])
    expect(r.reenvio).toBe(true)
  })

  it('el error de la base se muestra tal cual', async () => {
    sb.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Esta rendición ya fue revisada y no se puede reenviar.' },
    })
    await expect(
      enviarRendicion(borrador(), [], { rendicionId: 'r-1', subidas: new Map() }),
    ).rejects.toThrow('ya fue revisada')
  })
})

describe('Nº correlativo', () => {
  it('enviar devuelve el Nº que asignó el servidor', async () => {
    sb.nro.mockResolvedValueOnce({ data: { nro: 15 }, error: null })
    const r = await enviarRendicion(borrador(), [foto('a')], {
      rendicionId: 'r-1',
      subidas: new Map(),
    })
    expect(r.nro).toBe(15)
  })

  it('siguienteNro consulta la RPC de la persona', async () => {
    sb.rpc.mockResolvedValueOnce({ data: 7, error: null })
    expect(await siguienteNro('p-1')).toBe(7)
    expect(sb.rpc).toHaveBeenCalledWith('siguiente_nro', { p_persona: 'p-1' })
    sb.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Solo puedes ver tu propio correlativo.' } })
    await expect(siguienteNro('p-2')).rejects.toThrow('Solo puedes ver tu propio correlativo.')
  })
})
