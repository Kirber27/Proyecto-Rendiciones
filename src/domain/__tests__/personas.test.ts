import { describe, expect, it } from 'vitest'
import type { Rol } from '@/types/roles'
import {
  cambiarFuncion,
  correoValido,
  puedeEliminar,
  sugerirCodigo,
  validarCorreo,
  validarPersonaNueva,
  type PersonaGestion,
} from '../personas'
import { norm, tr } from '../formato'

// Personas FICTICIAS
const persona = (
  id: string,
  nombre: string,
  codigo: string,
  rol: Rol = 'solicitante',
  c: Partial<PersonaGestion> = {},
): PersonaGestion => ({
  id,
  nombre,
  codigo,
  correo: null,
  rol,
  eliminada: false,
  ...c,
})
const personas = [
  persona('1', 'Juana Pérez ', 'JPE', 'administrador', { correo: 'juana@hecaglobal.com' }),
  persona('2', 'Mario Soto', 'MSO', 'tesorero'),
  persona('3', 'Laura Rojas', 'LRO'),
  persona('4', 'Pedro Antiguo', 'PAN', 'solicitante', { eliminada: true }),
]

describe('sugerirCodigo', () => {
  it('inicial del nombre + 2 letras del apellido, sin tildes', () => {
    expect(sugerirCodigo('Juana Pérez', [])).toBe('JPE')
    expect(sugerirCodigo('Álvaro Ñúñez', [])).toBe('ANU')
    expect(sugerirCodigo('  ana   jocelyn  schnell ', [])).toBe('AJO')
  })
  it('si está usado cambia la tercera letra', () => {
    expect(sugerirCodigo('Juan Pérez', ['JPE'])).toBe('JPA')
    expect(sugerirCodigo('Juan Pérez', ['JPE', 'JPA', 'JPB'])).toBe('JPC')
  })
  it('con una sola palabra usa esa palabra', () => {
    expect(sugerirCodigo('Alg', [])).toBe('AAL')
  })
})

// Paridad con sugerirCodigo() del prototipo (copiado tal cual, con la lista de usados como parámetro)
// prettier-ignore
const sugerirOriginal = (nombre: string, usadosLista: string[]) => { const p=tr(nombre).split(" "); const base=norm((p[0]||"")[0]+(p[1]||p[0]||"").slice(0,2)).toUpperCase().replace(/[^A-Z]/g,""); const usados=new Set(usadosLista); if(!usados.has(base)) return base; for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ"){ const k=base.slice(0,2)+c; if(!usados.has(k)) return k; } return base; }

describe('paridad sugerirCodigo', () => {
  it.each([
    ['Juana Pérez', []],
    ['Juan Pérez', ['JPE']],
    ['Ana Jocelyn  Schnell', ['AJO', 'AJA']],
    ['Arleen Cedeño', []],
    ['Edgar hernandez', ['EHE']],
    ['ALG', []],
    ['Rodrigo Ibañez ', []],
    ['Ñandú Ñuñoa', []],
  ] as [string, string[]][])('%s', (nombre, usados) => {
    expect(sugerirCodigo(nombre, usados)).toBe(sugerirOriginal(nombre, usados))
  })
})

describe('correos', () => {
  it('correoValido: vacío vale; si viene, usuario@dominio.tld', () => {
    expect(correoValido('')).toBe(true)
    expect(correoValido(null)).toBe(true)
    expect(correoValido('a@b.cl')).toBe(true)
    expect(correoValido(' a@b.cl ')).toBe(true)
    expect(correoValido('a@b')).toBe(false)
    expect(correoValido('a b@c.cl')).toBe(false)
  })
  it('validarCorreo: único entre personas (sin importar mayúsculas)', () => {
    expect(validarCorreo('3', 'JUANA@hecaglobal.com', personas)).toBe(
      'Ese correo ya lo usa otra persona.',
    )
    expect(validarCorreo('1', 'juana@hecaglobal.com', personas)).toBeNull() // el suyo
    expect(validarCorreo('3', 'laura@hecaglobal', personas)).toBe(
      'Ese correo no tiene un formato válido.',
    )
    expect(validarCorreo('3', '', personas)).toBeNull()
  })
})

describe('validarPersonaNueva', () => {
  const ok = { nombre: 'Ana Muñoz', correo: 'ana@hecaglobal.com', codigo: 'AMU' }

  it('una persona nueva válida no tiene problemas', () => {
    expect(validarPersonaNueva(ok, personas)).toEqual([])
    expect(validarPersonaNueva({ ...ok, correo: '', codigo: 'amu' }, personas)).toEqual([]) // código en minúscula se normaliza
  })

  it('exige nombre y apellido', () => {
    expect(validarPersonaNueva({ ...ok, nombre: ' Ana ' }, personas)).toEqual([
      'Escribe nombre y apellido.',
    ])
  })

  it('no repite personas (por nombre normalizado) y avisa si está eliminada', () => {
    expect(validarPersonaNueva({ ...ok, nombre: 'juana  PEREZ' }, personas)).toEqual([
      'Esa persona ya está en la lista.',
    ])
    expect(validarPersonaNueva({ ...ok, nombre: 'Pedro Antiguo' }, personas)).toEqual([
      'Esa persona está eliminada: restáurala desde "Personas eliminadas".',
    ])
  })

  it('valida correo (formato y único) y código (2 a 4 letras, único)', () => {
    expect(validarPersonaNueva({ ...ok, correo: 'ana@', codigo: 'A1' }, personas)).toEqual([
      'Ese correo no tiene un formato válido.',
      'El código debe tener entre 2 y 4 letras.',
    ])
    expect(
      validarPersonaNueva({ ...ok, correo: 'Juana@HecaGlobal.com', codigo: 'MSO' }, personas),
    ).toEqual(['Ese correo ya lo usa otra persona.', 'El código MSO ya lo usa otra persona.'])
    expect(validarPersonaNueva({ ...ok, codigo: 'ABCDE' }, personas)).toEqual([
      'El código debe tener entre 2 y 4 letras.',
    ])
  })
})

describe('funciones', () => {
  it('nombrar Tesorero degrada al anterior', () => {
    expect(cambiarFuncion('3', 'tesorero', personas)).toEqual({ ok: true, degradar: '2' })
    expect(cambiarFuncion('2', 'tesorero', personas)).toEqual({ ok: true, degradar: null })
    expect(cambiarFuncion('3', 'administrador', personas)).toEqual({ ok: true, degradar: null })
  })

  it('debe quedar al menos un Administrador', () => {
    expect(cambiarFuncion('1', 'solicitante', personas)).toEqual({
      ok: false,
      error: 'Debe quedar al menos un Administrador.',
    })
    const conDos = [...personas, persona('5', 'Otra Admin', 'OAD', 'administrador')]
    expect(cambiarFuncion('1', 'solicitante', conDos)).toEqual({ ok: true, degradar: null })
    // Un administrador eliminado no cuenta
    const conEliminado = [
      ...personas,
      persona('5', 'Otra Admin', 'OAD', 'administrador', { eliminada: true }),
    ]
    expect(cambiarFuncion('1', 'solicitante', conEliminado).ok).toBe(false)
  })

  it('puedeEliminar: no al último Administrador', () => {
    expect(puedeEliminar('1', personas)).toBe('Debe quedar al menos un Administrador.')
    expect(puedeEliminar('3', personas)).toBeNull()
    expect(puedeEliminar('x', personas)).toBe('La persona no existe.')
  })
})
