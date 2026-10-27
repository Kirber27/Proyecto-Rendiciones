import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonaPerfil } from '@/services/personas'

// Personas FICTICIAS
const base: PersonaPerfil[] = [
  {
    id: 'a',
    nombre: 'Kira Admin',
    codigo: 'KAD',
    correo: 'kira@ejemplo.cl',
    rol: 'administrador',
    vinculada: true,
    esNueva: true,
    eliminadaEn: null,
    rendiciones: 0,
  },
  {
    id: 't',
    nombre: 'Tomás Tesorero',
    codigo: 'TTE',
    correo: null,
    rol: 'tesorero',
    vinculada: false,
    esNueva: false,
    eliminadaEn: null,
    rendiciones: 3,
  },
  {
    id: 's',
    nombre: 'Sara Solicitante ',
    codigo: 'SSO',
    correo: 'sara@ejemplo.cl',
    rol: 'solicitante',
    vinculada: false,
    esNueva: false,
    eliminadaEn: null,
    rendiciones: 12,
  },
  {
    id: 'e',
    nombre: 'Elena Eliminada',
    codigo: 'EEL',
    correo: null,
    rol: 'solicitante',
    vinculada: false,
    esNueva: false,
    eliminadaEn: '2026-10-01T10:00:00Z',
    rendiciones: 1,
  },
]
const servicio = vi.hoisted(() => ({
  listarPersonasPerfil: vi.fn(),
  guardarPersona: vi.fn(),
  asignarRol: vi.fn(),
  eliminarPersona: vi.fn(),
  restaurarPersona: vi.fn(),
  listarCuentas: vi.fn(),
  vincularCuenta: vi.fn(),
}))
vi.mock('@/services/personas', () => servicio)
const cuentas = vi.hoisted(() => ({ crearCuenta: vi.fn(), nuevaClave: vi.fn() }))
vi.mock('@/services/cuentas', () => cuentas)
vi.mock('@/services/catalogos', () => ({
  leerCatalogos: vi.fn().mockResolvedValue({ personas: [] }),
}))

const { default: PerfilesView } = await import('./PerfilesView.vue')

async function montar() {
  const w = mount(PerfilesView)
  await flushPromises()
  return w
}
const filas = (w: Awaited<ReturnType<typeof montar>>) =>
  w.find('table').findAll('tbody tr').map((tr) => tr.find('td').text())
const mensaje = (w: Awaited<ReturnType<typeof montar>>) => w.find('[role="status"]').text()

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(servicio).forEach((f) => f.mockReset())
  Object.values(cuentas).forEach((f) => f.mockReset())
  servicio.listarPersonasPerfil.mockResolvedValue(structuredClone(base))
  servicio.listarCuentas.mockResolvedValue([
    {
      userId: 'u-a',
      email: 'kira@ejemplo.cl',
      ultimoIngreso: '2026-10-26T10:00:00Z',
      personaId: 'a',
      personaNombre: 'Kira Admin',
    },
    {
      userId: 'u-x',
      email: 'otro.correo@ejemplo.cl',
      ultimoIngreso: null,
      personaId: null,
      personaNombre: null,
    },
  ])
})

describe('PerfilesView', () => {
  it('lista activas por función y nombre, con tarjetas de conteo y eliminadas aparte', async () => {
    const w = await montar()
    expect(filas(w)).toEqual(['Kira Admin', 'Tomás Tesorero', 'Sara Solicitante'])
    expect(w.text()).toContain('Personas (3)')
    expect(w.text()).toContain('Personas eliminadas (1)')
    const chips = w.findAll('.chip').map((c) => c.text())
    expect(chips.slice(0, 3)).toEqual(['1', '1', '1']) // tarjetas por función
    expect(chips.slice(3, 5)).toEqual(['Con cuenta', 'Sin correo']) // columna Cuenta
    expect(w.find('button[aria-label="Nueva contraseña para Kira Admin"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Crear cuenta para Sara Solicitante"]').exists()).toBe(true)
    expect(w.find('button[aria-label^="Crear cuenta para Tomás"]').exists()).toBe(false) // sin correo
  })

  it('crear cuenta: muestra la contraseña temporal una vez, con Copiar', async () => {
    cuentas.crearCuenta.mockResolvedValue('K7QM-4XPR-2HTW')
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    const w = await montar()
    await w.find('button[aria-label="Crear cuenta para Sara Solicitante"]').trigger('click')
    await flushPromises()
    expect(cuentas.crearCuenta).toHaveBeenCalledWith('s')
    expect(mensaje(w)).toBe('Cuenta de Sara Solicitante creada.')
    const panel = w.find('[aria-label="Contraseña temporal"]')
    expect(panel.text()).toContain('Sara Solicitante')
    expect(panel.text()).toContain('sara@ejemplo.cl')
    expect(panel.find('code').text()).toBe('K7QM-4XPR-2HTW')
    await panel.findAll('button').find((b) => b.text() === 'Copiar')!.trigger('click')
    await flushPromises()
    expect(escribir).toHaveBeenCalledWith('K7QM-4XPR-2HTW')
    expect(panel.text()).toContain('Copiada')
    await w.find('button[aria-label="Cerrar contraseña temporal"]').trigger('click')
    expect(w.find('[aria-label="Contraseña temporal"]').exists()).toBe(false)
  })

  it('nueva contraseña pide confirmación en línea; un error de la función se muestra', async () => {
    cuentas.nuevaClave.mockResolvedValueOnce('ABCD-EFGH-JKMN')
    const w = await montar()
    await w.find('button[aria-label="Nueva contraseña para Kira Admin"]').trigger('click')
    expect(w.text()).toContain('La actual deja de servir.')
    expect(cuentas.nuevaClave).not.toHaveBeenCalled()
    await w.findAll('button').find((b) => b.text() === 'Sí, nueva')!.trigger('click')
    await flushPromises()
    expect(cuentas.nuevaClave).toHaveBeenCalledWith('a')
    expect(mensaje(w)).toContain('Kira Admin tiene una contraseña nueva')
    expect(w.find('[aria-label="Contraseña temporal"] code').text()).toBe('ABCD-EFGH-JKMN')

    cuentas.nuevaClave.mockRejectedValueOnce(new Error('Solo un administrador puede crear cuentas o asignar contraseñas.'))
    await w.find('button[aria-label="Nueva contraseña para Kira Admin"]').trigger('click')
    await w.findAll('button').find((b) => b.text() === 'Sí, nueva')!.trigger('click')
    await flushPromises()
    expect(mensaje(w)).toContain('Solo un administrador')
    expect(w.find('[aria-label="Contraseña temporal"]').exists()).toBe(false) // no queda la anterior
  })

  it('busca por nombre o correo sin tildes', async () => {
    const w = await montar()
    await w.find('input[type="search"]').setValue('tomas')
    expect(filas(w)).toEqual(['Tomás Tesorero'])
    await w.find('input[type="search"]').setValue('SARA@')
    expect(filas(w)).toEqual(['Sara Solicitante'])
  })

  it('guardar correo llama al servicio y avisa', async () => {
    const w = await montar()
    const input = w.find('input[aria-label="Correo de Tomás Tesorero"]')
    await input.setValue('Tomas@Ejemplo.cl')
    await input.trigger('change')
    await flushPromises()
    expect(servicio.guardarPersona).toHaveBeenCalledWith({
      id: 't',
      nombre: 'Tomás Tesorero',
      codigo: 'TTE',
      correo: 'tomas@ejemplo.cl',
    })
    expect(mensaje(w)).toContain('Correo de Tomás Tesorero guardado')
  })

  it('un correo repetido se avisa sin llamar al servicio', async () => {
    const w = await montar()
    const input = w.find('input[aria-label="Correo de Tomás Tesorero"]')
    await input.setValue('sara@ejemplo.cl')
    await input.trigger('change')
    expect(servicio.guardarPersona).not.toHaveBeenCalled()
    expect(mensaje(w)).toBe('Ese correo ya lo usa otra persona.')
  })

  it('nombrar Tesorero avisa quién pasa a Solicitante', async () => {
    servicio.asignarRol.mockResolvedValue('t')
    const w = await montar()
    await w.find('select[aria-label="Función de Sara Solicitante"]').setValue('tesorero')
    await flushPromises()
    expect(servicio.asignarRol).toHaveBeenCalledWith('s', 'tesorero')
    expect(mensaje(w)).toBe(
      'Sara Solicitante ahora es Tesorero. Tomás Tesorero pasa a Solicitante.',
    )
  })

  it('no deja quitar al último Administrador (sin llamar a la base)', async () => {
    const w = await montar()
    await w.find('select[aria-label="Función de Kira Admin"]').setValue('solicitante')
    await flushPromises()
    expect(servicio.asignarRol).not.toHaveBeenCalled()
    expect(mensaje(w)).toBe('Debe quedar al menos un Administrador.')
  })

  it('eliminar pide confirmación en línea', async () => {
    const w = await montar()
    await w.find('button[aria-label="Eliminar a Sara Solicitante"]').trigger('click')
    expect(w.text()).toContain('Su historial se mantiene.')
    expect(servicio.eliminarPersona).not.toHaveBeenCalled()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Sí, eliminar')!
      .trigger('click')
    await flushPromises()
    expect(servicio.eliminarPersona).toHaveBeenCalledWith('s')
  })

  it('agregar persona: valida, guarda y asigna la función si no es Solicitante', async () => {
    servicio.guardarPersona.mockResolvedValue('nuevo-id')
    const w = await montar()
    await w.find('#np-nombre').setValue('Nora Nueva')
    expect((w.find('#np-codigo').element as HTMLInputElement).value).toBe('NNU')
    await w.find('#np-correo').setValue('nora@ejemplo.cl')
    await w.find('#np-rol').setValue('administrador')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(servicio.guardarPersona).toHaveBeenCalledWith({
      nombre: 'Nora Nueva',
      codigo: 'NNU',
      correo: 'nora@ejemplo.cl',
    })
    expect(servicio.asignarRol).toHaveBeenCalledWith('nuevo-id', 'administrador')
    expect(mensaje(w)).toBe('Nora Nueva agregado como Administrador.')
  })

  it('agregar persona con problemas muestra todos sin llamar al servicio', async () => {
    const w = await montar()
    await w.find('#np-nombre').setValue('Sola')
    await w.find('#np-codigo').setValue('SSO')
    await w.find('form').trigger('submit')
    expect(servicio.guardarPersona).not.toHaveBeenCalled()
    expect(w.text()).toContain('Escribe nombre y apellido.')
    expect(w.text()).toContain('El código SSO ya lo usa otra persona.')
  })

  it('si la base rechaza, muestra su mensaje', async () => {
    servicio.restaurarPersona.mockRejectedValue(
      new Error('La persona no existe o no estaba eliminada.'),
    )
    const w = await montar()
    await w.find('details summary').trigger('click')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Restaurar')!
      .trigger('click')
    await flushPromises()
    expect(mensaje(w)).toBe('La persona no existe o no estaba eliminada.')
  })

  it('cuentas: se abren si hay alguna sin vincular y se vinculan a mano', async () => {
    const w = await montar()
    const det = w.findAll('details').find((d) => d.text().includes('Cuentas de usuario'))!
    expect(det.attributes('open')).toBeDefined()
    expect(det.text()).toContain('1 sin vincular')
    await w.find('select[aria-label="Persona de la cuenta otro.correo@ejemplo.cl"]').setValue('s')
    await flushPromises()
    expect(servicio.vincularCuenta).toHaveBeenCalledWith('u-x', 's')
    expect(mensaje(w)).toBe('Cuenta otro.correo@ejemplo.cl vinculada con Sara Solicitante.')
  })

  it('cuentas: elegir "Sin vincular" desvincula', async () => {
    const w = await montar()
    await w.find('select[aria-label="Persona de la cuenta otro.correo@ejemplo.cl"]').setValue('')
    await flushPromises()
    expect(servicio.vincularCuenta).toHaveBeenCalledWith('u-x', null)
  })
})
