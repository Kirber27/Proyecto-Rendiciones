import type { Session } from '@supabase/supabase-js'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorLectura, RespuestaLecturaSchema } from '@shared/lectura'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { Rol } from '@/types/roles'

const leerFotos = vi.hoisted(() => vi.fn())
vi.mock('@/services/lectura', () => ({ leerFotos, MAX_IMAGENES_LECTURA: 20 }))
vi.mock('@/lib/imagenes', () => ({
  prepararImagenes: vi.fn(async (fotos: Blob[]) => ({ imagenes: fotos, nota: 'nota' })),
}))
vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))
const enviarRendicion = vi.hoisted(() => vi.fn())
vi.mock('@/services/rendiciones', () => ({ enviarRendicion }))

const { useAuthStore } = await import('./auth')
const { useRendirStore } = await import('./rendir')

/** Respuesta FICTICIA de la IA. */
const respuesta = RespuestaLecturaSchema.parse({
  solicitante: 'Mario Soto',
  nro: 7,
  fecha: '2026-10-20',
  empresa: 'Heca Global SPA',
  lineas: [{ tipo: 'Boleta', proveedor: 'COPEC', exento: 15000, subcuenta: 'Bencina' }],
  documentos: [{}],
})

function sesion(rol: Rol, personaId = 'p-1', uid = 'u-1') {
  const auth = useAuthStore()
  auth.listo = true
  auth.session = { user: { id: uid, email: 'x@ejemplo.cl' } } as Session
  auth.persona = { id: personaId, nombre: 'Juana Pérez ', codigo: 'JPE', rol }
}
const foto = (n = 'f.jpg') => new File(['x'], n, { type: 'image/jpeg' })

beforeEach(() => {
  setActivePinia(createPinia())
  leerFotos.mockReset()
  localStorage.clear()
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('useRendirStore', () => {
  it('al agregar fotos lee solo y fija al solicitante en su persona', async () => {
    sesion('solicitante')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    expect(r.leyendo).toBe(true)
    await flushPromises()
    expect(r.leyendo).toBe(false)
    expect(r.borrador).toMatchObject({
      personaId: 'p-1',
      nro: '7',
      empresaId: 1,
      documentosLeidos: 1,
    })
    expect(r.borrador!.lineas[0]).toMatchObject({
      proveedor: 'COPEC',
      exento: '15.000',
      subcuentaId: 8,
      cuentaId: 2,
    })
    expect(r.hayFotosNuevas).toBe(false)
  })

  it('tesorería puede rendir por otra persona: usa el solicitante leído', async () => {
    sesion('tesorero')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    expect(r.borrador!.personaId).toBe('p-2') // Mario Soto en los catálogos de demo
  })

  it('con borrador, agregar fotos no relee solo: ofrece "Volver a leer"', async () => {
    sesion('solicitante')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    r.agregarFotos([foto('b.jpg')])
    expect(leerFotos).toHaveBeenCalledTimes(1)
    expect(r.hayFotosNuevas).toBe(true)
    await r.leer()
    expect(leerFotos).toHaveBeenCalledTimes(2)
    expect(r.hayFotosNuevas).toBe(false)
  })

  it('error de lectura: mensaje en español y opción de completar a mano', async () => {
    sesion('solicitante')
    leerFotos.mockRejectedValue(new ErrorLectura('rate_limited'))
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    expect(r.borrador).toBeNull()
    expect(r.avisoLectura).toMatchObject({ tipo: 'warning' })
    expect(r.avisoLectura!.texto).toContain('límite de lecturas')
    r.completarAMano()
    expect(r.borrador).toMatchObject({ personaId: 'p-1', nro: '' })
    expect(r.borrador!.lineas).toHaveLength(1)
  })

  it('más de 20 fotos: avisa que solo se leyeron las primeras', async () => {
    sesion('solicitante')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos(Array.from({ length: 21 }, (_, i) => foto(`${i}.jpg`)))
    await flushPromises()
    expect(r.borrador!.dudas.at(-1)).toContain('primeras 20 fotos')
  })

  it('guarda el borrador en el navegador y lo recupera', async () => {
    sesion('solicitante')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    r.borrador!.nro = '8'
    expect(JSON.parse(localStorage.getItem('rendir:borrador:u-1')!).nro).toBe('8')

    setActivePinia(createPinia())
    sesion('solicitante')
    const otra = useRendirStore()
    otra.recuperar()
    expect(otra.borrador!.nro).toBe('8')
    expect(otra.avisoLectura!.texto).toContain('Recuperamos')
  })

  it('descartar borra todo, también lo guardado', async () => {
    sesion('solicitante')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    r.descartar()
    expect(r.borrador).toBeNull()
    expect(r.fotos).toEqual([])
    expect(localStorage.getItem('rendir:borrador:u-1')).toBeNull()
  })

  it('al cambiar de usuario olvida lo de memoria sin borrar lo guardado del otro', async () => {
    sesion('solicitante', 'p-1', 'u-1')
    localStorage.setItem('rendir:borrador:u-2', JSON.stringify({ nro: '99' }))
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    sesion('solicitante', 'p-3', 'u-2')
    await flushPromises()
    expect(r.borrador).toBeNull()
    expect(r.fotos).toEqual([])
    expect(localStorage.getItem('rendir:borrador:u-1')).not.toBeNull() // el de u-1 sigue guardado
    expect(localStorage.getItem('rendir:borrador:u-2')).toBe('{"nro":"99"}')
  })

  it('enviar: limpia todo y muestra el mensaje de éxito; reintentos usan el mismo id', async () => {
    sesion('solicitante')
    leerFotos.mockResolvedValue(respuesta)
    const r = useRendirStore()
    r.agregarFotos([foto()])
    await flushPromises()
    enviarRendicion.mockRejectedValueOnce(new Error('No se pudo guardar la foto 1.'))
    expect(await r.enviar()).toBe(false)
    expect(r.avisoEnvio).toEqual({ tipo: 'danger', texto: 'No se pudo guardar la foto 1.' })
    expect(r.borrador).not.toBeNull() // no se pierde nada
    enviarRendicion.mockResolvedValueOnce({ id: 'x', nro: 7, total: 15000, reenvio: false })
    expect(await r.enviar()).toBe(true)
    const [id1, id2] = enviarRendicion.mock.calls.map((c) => c[2].rendicionId)
    expect(id1).toBe(id2)
    expect(r.borrador).toBeNull()
    expect(r.fotos).toEqual([])
    expect(r.avisoEnvio!.texto).toBe(
      'Rendición Nº 7 enviada por $ 15.000. Tesorería la revisará; sigue su estado en Mis rendiciones.',
    )
    expect(localStorage.getItem('rendir:borrador:u-1')).toBeNull()
  })
})
