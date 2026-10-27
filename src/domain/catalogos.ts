// Reglas que dependen de los catálogos (cuenta sugerida, C.C. por empresa).
import type { Empresa, Subcuenta } from '@/types/catalogos'

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
