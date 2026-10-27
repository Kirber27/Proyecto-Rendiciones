import type { Session } from '@supabase/supabase-js'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import type { Rol } from '@/types/roles'

vi.mock('@/services/catalogos', () => ({ leerCatalogos: vi.fn(async () => catalogosDemo) }))
const abrirRendicion = vi.hoisted(() => vi.fn())
vi.mock('@/services/aprobacion', () => ({
  abrirRendicion,
  urlsFirmadas: vi.fn(async () => new Map()),
}))
const enviarRendicion = vi.hoisted(() => vi.fn())
vi.mock('@/services/rendiciones', () => ({ enviarRendicion }))

const { useAuthStore } = await import('./auth')
const { useRendirStore } = await import('./rendir')

function sesion(rol: Rol, personaId = 'p-1', uid = 'u-1') {
  const auth = useAuthStore()
  auth.listo = true
  auth.session = { user: { id: uid, email: 'x@ejemplo.cl' } } as Session
  auth.persona = { id: personaId, nombre: 'Juana Pérez ', codigo: 'JPE', rol }
}
const foto = (n = 'f.jpg') => new File(['x'], n, { type: 'image/jpeg' })

beforeEach(() => {
  setActivePinia(createPinia())
  enviarRendicion.mockReset()
  localStorage.clear()
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('useRendirStore', () => {
  it('al entrar arma un formulario vacío con el solicitante fijo y la empresa por defecto', async () => {
    sesion('solicitante')
    const r = useRendirStore()
    await r.iniciar()
    expect(r.borrador).toMatchObject({ personaId: 'p-1', nro: '', empresaId: 2 }) // HGI
    expect(r.borrador!.lineas).toHaveLength(1)
    expect(r.borrador!.lineas[0]!.centroCostoId).toBe(3) // HGI.
    expect(r.aviso).toBeNull()
  })

  it('tesorería puede rendir por otra persona: el solicitante queda libre', async () => {
    sesion('tesorero')
    const r = useRendirStore()
    await r.iniciar()
    expect(r.borrador!.personaId).toBeNull()
  })

  it('un formulario vacío no se guarda en el navegador', async () => {
    sesion('solicitante')
    const r = useRendirStore()
    await r.iniciar()
    expect(localStorage.getItem('rendir:borrador:u-1')).toBeNull()
  })

  it('guarda el borrador con datos y lo recupera al volver, avisando de los adjuntos', async () => {
    sesion('solicitante')
    const r = useRendirStore()
    await r.iniciar()
    r.borrador!.nro = '8'
    expect(JSON.parse(localStorage.getItem('rendir:borrador:u-1')!).nro).toBe('8')

    setActivePinia(createPinia())
    sesion('solicitante')
    const otra = useRendirStore()
    await otra.iniciar()
    expect(otra.borrador!.nro).toBe('8')
    expect(otra.aviso!.texto).toContain('vuelve a adjuntarlos')
  })

  it('agrega y quita adjuntos', async () => {
    sesion('solicitante')
    const r = useRendirStore()
    await r.iniciar()
    r.agregarArchivos([foto('a.jpg'), foto('b.jpg')])
    expect(r.archivos.map((a) => a.file.name)).toEqual(['a.jpg', 'b.jpg'])
    r.quitarArchivo(0)
    expect(r.archivos.map((a) => a.file.name)).toEqual(['b.jpg'])
  })

  it('descartar deja un formulario vacío y borra lo guardado', async () => {
    sesion('solicitante')
    const r = useRendirStore()
    await r.iniciar()
    r.borrador!.nro = '8'
    r.agregarArchivos([foto()])
    r.descartar()
    expect(r.borrador).toMatchObject({ personaId: 'p-1', nro: '' })
    expect(r.archivos).toEqual([])
    expect(localStorage.getItem('rendir:borrador:u-1')).toBeNull()
  })

  it('al cambiar de usuario olvida lo de memoria sin borrar lo guardado del otro', async () => {
    sesion('solicitante', 'p-1', 'u-1')
    localStorage.setItem('rendir:borrador:u-2', JSON.stringify({ nro: '99' }))
    const r = useRendirStore()
    await r.iniciar()
    r.borrador!.nro = '8'
    r.agregarArchivos([foto()])
    sesion('solicitante', 'p-3', 'u-2')
    await flushPromises()
    expect(r.borrador).toBeNull()
    expect(r.archivos).toEqual([])
    expect(localStorage.getItem('rendir:borrador:u-1')).not.toBeNull() // el de u-1 sigue guardado
    expect(localStorage.getItem('rendir:borrador:u-2')).toBe('{"nro":"99"}')
  })

  it('enviar: deja el formulario vacío y muestra el mensaje de éxito; reintentos usan el mismo id', async () => {
    sesion('solicitante')
    const r = useRendirStore()
    await r.iniciar()
    r.borrador!.nro = '7'
    r.agregarArchivos([foto()])
    enviarRendicion.mockRejectedValueOnce(new Error('No se pudo guardar la foto 1.'))
    expect(await r.enviar()).toBe(false)
    expect(r.avisoEnvio).toEqual({ tipo: 'danger', texto: 'No se pudo guardar la foto 1.' })
    expect(r.borrador!.nro).toBe('7') // no se pierde nada
    expect(r.archivos).toHaveLength(1)
    enviarRendicion.mockResolvedValueOnce({ id: 'x', nro: 7, total: 15000, reenvio: false })
    expect(await r.enviar()).toBe(true)
    const [id1, id2] = enviarRendicion.mock.calls.map((c) => c[2].rendicionId)
    expect(id1).toBe(id2)
    expect(enviarRendicion.mock.calls[0]![1]).toHaveLength(1) // el adjunto
    expect(r.borrador).toMatchObject({ nro: '' })
    expect(r.archivos).toEqual([])
    expect(r.avisoEnvio!.texto).toBe(
      'Rendición Nº 7 enviada por $ 15.000. Tesorería la revisará; sigue su estado en Mis rendiciones.',
    )
    expect(localStorage.getItem('rendir:borrador:u-1')).toBeNull()
  })

  it('corregir y reenviar: carga la observada con sus respaldos y el motivo; reenvía con el mismo id', async () => {
    sesion('solicitante')
    abrirRendicion.mockResolvedValue({
      borrador: {
        id: 'r-9',
        personaId: 'p-1',
        nro: '9',
        fecha: '2026-10-01',
        empresaId: 1,
        fondo: '',
        totalFormulario: '',
        lineas: [{ exento: '5.000' }],
        respaldos: ['p-1/r-9/a.jpg'],
      },
      version: 'v',
      eventos: [],
      respaldos: [{ path: 'p-1/r-9/a.jpg', url: 'https://firmada/a.jpg', tipo: 'imagen' }],
      notaTesoreria: 'Falta la boleta del taxi',
    })
    const r = useRendirStore()
    await r.cargarParaCorregir('r-9')
    await r.iniciar() // la pantalla se abre después: no reemplaza lo cargado
    expect(r.borrador!.id).toBe('r-9')
    expect(r.guardados).toEqual([
      { path: 'p-1/r-9/a.jpg', url: 'https://firmada/a.jpg', tipo: 'imagen' },
    ])
    expect(r.aviso!.texto).toBe(
      'Tesorería pidió: «Falta la boleta del taxi». Corrige y vuelve a enviar.',
    )
    enviarRendicion.mockResolvedValueOnce({ id: 'r-9', nro: 9, total: 5000, reenvio: true })
    await r.enviar()
    expect(enviarRendicion.mock.calls[0]![2].rendicionId).toBe('r-9')
    expect(r.avisoEnvio!.texto).toContain('Rendición Nº 9 reenviada por $ 5.000')
    expect(r.guardados).toEqual([])
    expect(r.borrador!.id).toBeUndefined()
  })
})
