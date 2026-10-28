import { describe, expect, it } from 'vitest'
import type { Proveedor } from '@/types/proveedores'
import {
  buscarProveedores,
  leerFilasProveedores,
  previsualizarImportacion,
  validarProveedor,
} from '../proveedores'

// Datos FICTICIOS (RUT calculados con el módulo 11).
const existentes: Proveedor[] = [
  { id: 'a', nombre: 'Ferretería Uno', rut: '12345678-5', eliminado: false },
  { id: 'b', nombre: 'Taller Dos', rut: '11111111-1', eliminado: true },
]

describe('validarProveedor', () => {
  it('un proveedor nuevo con RUT válido no tiene problemas', () => {
    expect(validarProveedor({ nombre: 'Nuevo', rut: '10.000.013-k' }, existentes)).toEqual([])
  })
  it('exige nombre y RUT', () => {
    expect(validarProveedor({ nombre: ' ', rut: '' }, existentes)).toEqual([
      'Escribe el nombre del proveedor.',
      'Escribe el RUT.',
    ])
  })
  it('RUT con dígito verificador incorrecto', () => {
    expect(validarProveedor({ nombre: 'X', rut: '12.345.678-4' }, existentes)).toEqual([
      'El RUT no es válido. Revisa el número y el dígito verificador.',
    ])
  })
  it('RUT ya registrado (escrito de otra forma); si está eliminado lo dice', () => {
    expect(validarProveedor({ nombre: 'X', rut: '123456785' }, existentes)).toEqual([
      'Ese RUT ya está registrado como «Ferretería Uno».',
    ])
    expect(validarProveedor({ nombre: 'X', rut: '11.111.111-1' }, existentes)[0]).toContain(
      'Está eliminado: tesorería puede restaurarlo.',
    )
  })
  it('al editar no choca consigo mismo', () => {
    expect(validarProveedor({ nombre: 'Ferretería 1', rut: '12345678-5' }, existentes, 'a')).toEqual(
      [],
    )
  })
})

describe('buscarProveedores', () => {
  it('por nombre sin tildes ni mayúsculas, ordenado', () => {
    expect(buscarProveedores(existentes, 'FERRETERIA').map((p) => p.id)).toEqual(['a'])
    expect(buscarProveedores(existentes, '').map((p) => p.id)).toEqual(['a', 'b'])
  })
  it('por RUT con o sin puntos', () => {
    expect(buscarProveedores(existentes, '12.345').map((p) => p.id)).toEqual(['a'])
    expect(buscarProveedores(existentes, '111111111').map((p) => p.id)).toEqual(['b'])
  })
})

describe('leerFilasProveedores', () => {
  it('salta los títulos hasta la fila con "RUT" y adivina las columnas', () => {
    const r = leerFilasProveedores([
      ['Listado de proveedores'],
      [],
      ['Razón social', 'RUT', 'DV', 'Giro'],
      ['Uno', '12345678', '5', 'x'],
    ])
    expect(r.encabezados).toEqual(['Razón social', 'RUT', 'DV', 'Giro'])
    expect(r.mapeo).toEqual({ nombre: 0, rut: 1, dv: 2 })
    expect(r.primeraFila).toBe(4)
    expect(r.datos).toHaveLength(1)
  })
  it('sin columna DV ni encabezado reconocible', () => {
    expect(leerFilasProveedores([['Proveedor', 'Rut proveedor']]).mapeo).toEqual({
      nombre: 0,
      rut: 1,
      dv: -1,
    })
    expect(leerFilasProveedores([['a', 'b']]).mapeo).toEqual({ nombre: -1, rut: -1, dv: -1 })
  })
})

describe('previsualizarImportacion', () => {
  const mapeo = { nombre: 0, rut: 1, dv: -1 }
  it('separa nuevos, existentes y errores, con el Nº de fila del Excel', () => {
    const r = previsualizarImportacion(
      [
        ['Nuevo Uno', '10.000.013-K'],
        ['Ferreteria Uno', 123456785], // existente, mismo nombre sin tilde
        ['Otro nombre', '12345678-5'], // repetido en el archivo
        ['', '76000000-0'],
        ['Malo', '1-1'],
        ['Sin RUT', ''],
        ['', ''], // vacía: se ignora
        ['Nuevo Dos', '76.000.000-0'],
      ],
      mapeo,
      existentes,
      2,
    )
    expect(r.nuevos).toEqual([
      { fila: 2, nombre: 'Nuevo Uno', rut: '10000013-K' },
      { fila: 9, nombre: 'Nuevo Dos', rut: '76000000-0' },
    ])
    expect(r.existentes).toEqual([
      {
        fila: 3,
        nombre: 'Ferreteria Uno',
        rut: '12345678-5',
        registrado: 'Ferretería Uno',
        distinto: false,
      },
    ])
    expect(r.errores.map((e) => [e.fila, e.motivo])).toEqual([
      [4, 'RUT repetido en el archivo (fila 3).'],
      [5, 'Falta el nombre.'],
      [6, 'RUT inválido.'],
      [7, 'Falta el RUT.'],
    ])
  })
  it('une el RUT con el DV de otra columna e informa nombres distintos', () => {
    const r = previsualizarImportacion(
      [['Ferretería Uno Ltda', '12.345.678', '5']],
      { nombre: 0, rut: 1, dv: 2 },
      existentes,
    )
    expect(r.existentes[0]).toMatchObject({ rut: '12345678-5', distinto: true })
  })
})
