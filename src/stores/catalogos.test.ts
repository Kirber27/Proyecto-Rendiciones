import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogosDemo } from '@/dev/catalogosDemo'
import { aCatalogos } from '@/services/catalogos'

const leerCatalogos = vi.fn()
vi.mock('@/services/catalogos', async (original) => ({
  ...(await original<typeof import('@/services/catalogos')>()),
  leerCatalogos: () => leerCatalogos(),
}))

const { useCatalogosStore } = await import('./catalogos')

describe('aCatalogos', () => {
  it('traduce las filas de la base a tipos de dominio, conservando la grafía', () => {
    const c = aCatalogos({
      personas: [{ id: 'u1', nombre: 'David Herce ', codigo: 'DHE' }],
      empresas: [
        { id: 2, nombre: 'Hecaglobal Instruments SPA', rut: '76886693-7', centro_costo_id: 3 },
      ],
      cuentas: [{ id: 9, nombre: 'Importaciones / Export. ' }],
      subcuentas: [{ id: 40, nombre: 'Instituto Salud Publica (CDA)', cuenta_sugerida_id: 9 }],
      centrosCosto: [{ id: 3, codigo: 'HGI.' }],
      mediosPago: [{ id: 2, nombre: 'Banco Internacional HGI ' }],
    })
    expect(c).toEqual({
      personas: [{ id: 'u1', nombre: 'David Herce ', codigo: 'DHE' }],
      empresas: [
        { id: 2, nombre: 'Hecaglobal Instruments SPA', rut: '76886693-7', centroCostoId: 3 },
      ],
      cuentas: [{ id: 9, nombre: 'Importaciones / Export. ' }],
      subcuentas: [{ id: 40, nombre: 'Instituto Salud Publica (CDA)', cuentaSugeridaId: 9 }],
      centrosCosto: [{ id: 3, nombre: 'HGI.' }],
      mediosPago: [{ id: 2, nombre: 'Banco Internacional HGI ' }],
    })
  })

  it('empresa sin RUT queda con texto vacío', () => {
    const c = aCatalogos({
      personas: [],
      empresas: [{ id: 4, nombre: 'X', rut: null, centro_costo_id: null }],
      cuentas: [],
      subcuentas: [],
      centrosCosto: [],
      mediosPago: [],
    })
    expect(c.empresas[0]).toEqual({ id: 4, nombre: 'X', rut: '', centroCostoId: null })
  })
})

describe('useCatalogosStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    leerCatalogos.mockReset()
  })

  it('carga una sola vez aunque se pida varias veces', async () => {
    leerCatalogos.mockResolvedValue(catalogosDemo)
    const s = useCatalogosStore()
    await Promise.all([s.cargar(), s.cargar()])
    await s.cargar()
    expect(leerCatalogos).toHaveBeenCalledTimes(1)
    expect(s.listo).toBe(true)
    expect(s.personasActivas).toEqual(['p-1', 'p-2', 'p-3'])
  })

  it('recargar vuelve a leer; limpiar olvida todo', async () => {
    leerCatalogos.mockResolvedValue(catalogosDemo)
    const s = useCatalogosStore()
    await s.cargar()
    await s.recargar()
    expect(leerCatalogos).toHaveBeenCalledTimes(2)
    s.limpiar()
    expect(s.listo).toBe(false)
    expect(s.catalogos.personas).toEqual([])
  })

  it('si falla, deja el error y permite reintentar', async () => {
    leerCatalogos.mockRejectedValueOnce(new Error('No se pudo leer personas: sin conexión'))
    const s = useCatalogosStore()
    await s.cargar()
    expect(s.listo).toBe(false)
    expect(s.error).toContain('sin conexión')
    leerCatalogos.mockResolvedValue(catalogosDemo)
    await s.cargar()
    expect(s.listo).toBe(true)
    expect(s.error).toBe('')
  })
})
