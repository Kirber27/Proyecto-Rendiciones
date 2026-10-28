// Reglas que dependen de los catálogos (cuenta sugerida, C.C. por empresa, subcuenta nueva).
import type { Empresa, Subcuenta } from '@/types/catalogos'
import { norm, tr } from './formato'

/** Cuenta propuesta para una subcuenta, o null si no tiene sugerencia. */
export function cuentaSugerida(
  subcuentaId: number | null,
  subcuentas: readonly Subcuenta[],
): number | null {
  if (subcuentaId == null) return null
  return subcuentas.find((s) => s.id === subcuentaId)?.cuentaSugeridaId ?? null
}

/** C.C. por defecto de una empresa (HG, HGI., SS…), o null. */
export function centroCostoDeEmpresa(
  empresaId: number | null,
  empresas: readonly Empresa[],
): number | null {
  if (empresaId == null) return null
  return empresas.find((e) => e.id === empresaId)?.centroCostoId ?? null
}

/**
 * Subcuenta nueva (spec 11, R6): nombre obligatorio y que no exista otra igual sin importar tildes,
 * mayúsculas ni espacios (la base revisa lo mismo, incluidas las inactivas).
 * Devuelve el problema y, si es un duplicado, la subcuenta existente para elegirla.
 */
export function validarSubcuentaNueva(
  nombre: string,
  subcuentas: readonly Subcuenta[],
): { problema: string; existente?: Subcuenta } | null {
  if (!tr(nombre)) return { problema: 'Escribe el nombre de la subcuenta.' }
  const existente = subcuentas.find((s) => norm(s.nombre) === norm(nombre))
  if (existente) {
    return { problema: `Ya existe la subcuenta «${tr(existente.nombre)}».`, existente }
  }
  return null
}
