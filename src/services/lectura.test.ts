import { FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorLectura, ESQUEMA_SALIDA, LineaSchema, RespuestaLecturaSchema } from '@shared/lectura'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))
const { aBase64, leerFotos } = await import('./lectura')

const jpg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' })
const errorHttp = (cuerpo: unknown, status = 400) =>
  new FunctionsHttpError(new Response(JSON.stringify(cuerpo), { status }))

describe('aBase64', () => {
  it('codifica bytes (también archivos grandes, por trozos)', async () => {
    expect(await aBase64(jpg())).toBe('/9j/4A==')
    const grande = new Blob([new Uint8Array(200_000).fill(65)])
    expect((await aBase64(grande)).slice(0, 8)).toBe('QUFBQUFB')
  })
})

describe('leerFotos', () => {
  beforeEach(() => invoke.mockReset())

  it('envía las imágenes en base64 y valida la respuesta', async () => {
    invoke.mockResolvedValue({ data: { respuesta: { nro: 42, lineas: [] } }, error: null })
    const r = await leerFotos([jpg()], 'nota')
    expect(invoke).toHaveBeenCalledWith('leer-rendicion', {
      body: { imagenes: [{ media_type: 'image/jpeg', data: '/9j/4A==' }], nota: 'nota' },
      signal: undefined,
    })
    expect(r.nro).toBe(42)
  })

  it('traduce el código de error que devuelve la función', async () => {
    invoke.mockResolvedValue({ data: null, error: errorHttp({ code: 'rate_limited' }, 429) })
    await expect(leerFotos([jpg()], '')).rejects.toMatchObject({ codigo: 'rate_limited' })
    invoke.mockResolvedValue({ data: null, error: errorHttp({ code: 'raro' }) })
    await expect(leerFotos([jpg()], '')).rejects.toMatchObject({ codigo: 'error' })
  })

  it('respuesta sin forma válida → invalid_json', async () => {
    invoke.mockResolvedValue({ data: { respuesta: { lineas: 'x' } }, error: null })
    await expect(leerFotos([jpg()], '')).rejects.toBeInstanceOf(ErrorLectura)
    await expect(leerFotos([jpg()], '')).rejects.toMatchObject({ codigo: 'invalid_json' })
  })

  it('detener → cancelled', async () => {
    const c = new AbortController()
    c.abort()
    await expect(leerFotos([jpg()], '', c.signal)).rejects.toMatchObject({ codigo: 'cancelled' })
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('ESQUEMA_SALIDA (structured outputs)', () => {
  type Nodo = {
    type?: string
    properties?: Record<string, Nodo>
    required?: string[]
    additionalProperties?: boolean
    items?: Nodo
    anyOf?: Nodo[]
  }
  const objetos = (n: Nodo): Nodo[] => [
    ...(n.type === 'object' ? [n] : []),
    ...Object.values(n.properties ?? {}).flatMap(objetos),
    ...(n.items ? objetos(n.items) : []),
    ...(n.anyOf ?? []).flatMap(objetos),
  ]

  it('cada objeto exige todos sus campos y no admite propiedades extra', () => {
    for (const o of objetos(ESQUEMA_SALIDA as Nodo)) {
      expect(o.additionalProperties).toBe(false)
      expect(o.required).toEqual(Object.keys(o.properties ?? {}))
    }
  })

  it('tiene los mismos campos que el validador tolerante', () => {
    const raiz = ESQUEMA_SALIDA as Nodo
    expect(Object.keys(raiz.properties!).sort()).toEqual(
      Object.keys(RespuestaLecturaSchema.shape).sort(),
    )
    const linea = raiz.properties!.lineas!.items!
    const lineaZod = LineaSchema.shape
    expect(Object.keys(linea.properties!).sort()).toEqual(Object.keys(lineaZod).sort())
  })

  it('un JSON con la forma del esquema pasa el validador', () => {
    const ejemplo = {
      documentos: [
        {
          foto: 1,
          tipo: 'Boleta',
          proveedor: 'ISP',
          numero: '1',
          fecha: '2026-10-14',
          monto: 70389,
        },
      ],
      solicitante: 'X',
      nro: null,
      fecha: '2026-10-14',
      empresa: 'Y',
      fondo: '',
      totalFormulario: null,
      lineas: [
        {
          fecha: '',
          tipo: 'Factura',
          proveedor: '',
          rut: '',
          numero: '',
          neto: 1,
          iva: 0,
          exento: 0,
          detalle: '',
          subcuenta: '',
        },
      ],
      dudas: [],
    }
    expect(RespuestaLecturaSchema.safeParse(ejemplo).success).toBe(true)
  })
})
