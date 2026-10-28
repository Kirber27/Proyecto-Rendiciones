// Proveedores (spec 11): validación del alta/edición, búsqueda e importación desde Excel.
// La base vuelve a validar todo (crear_proveedor / editar_proveedor / importar_proveedores).
import type { MapeoProveedores, Proveedor, ProveedorBase } from '@/types/proveedores'
import { norm, tr } from './formato'
import { normalizarRut, rutValido } from './rut'

type Fila = readonly unknown[]

/** Problema con el RUT, o null si es válido. */
function problemaRut(rut: string): string | null {
  if (!tr(rut)) return 'Escribe el RUT.'
  if (!rutValido(rut)) return 'El RUT no es válido. Revisa el número y el dígito verificador.'
  return null
}

/** Mensaje si el RUT ya está en otro proveedor (mismo texto que la base). */
export function rutRepetido(
  rut: string,
  existentes: readonly Proveedor[],
  excluirId?: string,
): string | null {
  const n = normalizarRut(rut)
  const otro = existentes.find((p) => p.rut === n && p.id !== excluirId)
  if (!otro) return null
  const eliminado = otro.eliminado ? ' Está eliminado: tesorería puede restaurarlo.' : ''
  return `Ese RUT ya está registrado como «${tr(otro.nombre)}».${eliminado}`
}

/** Problemas para agregar o editar un proveedor (lista vacía = se puede guardar). */
export function validarProveedor(
  p: ProveedorBase,
  existentes: readonly Proveedor[],
  excluirId?: string,
): string[] {
  const problemas: string[] = []
  if (!tr(p.nombre)) problemas.push('Escribe el nombre del proveedor.')
  const rut = problemaRut(p.rut)
  if (rut) problemas.push(rut)
  else {
    const repetido = rutRepetido(p.rut, existentes, excluirId)
    if (repetido) problemas.push(repetido)
  }
  return problemas
}

/** Solo los dígitos (y K) de un texto: para buscar un RUT escrito con o sin puntos. */
const digitosRut = (s: string) => s.toUpperCase().replace(/[^0-9K]/g, '')

/** Busca por nombre (sin tildes ni mayúsculas) o por RUT (con o sin puntos). Ordena por nombre. */
export function buscarProveedores<T extends ProveedorBase>(lista: readonly T[], q: string): T[] {
  const texto = norm(q)
  const rut = digitosRut(q)
  return lista
    .filter(
      (p) =>
        !texto ||
        norm(p.nombre).includes(texto) ||
        (rut.length >= 3 && digitosRut(p.rut).includes(rut)),
    )
    .sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)))
}

// ---------- Importación desde Excel ----------

/** Cómo reconocer cada columna por su encabezado. */
export const PATRONES_PROVEEDORES: Record<keyof MapeoProveedores, RegExp> = {
  dv: /^d\.?\s*v\.?$|d[ií]gito/i,
  rut: /\brut\b/i,
  nombre: /raz[oó]n|nombre|proveedor/i,
}

/**
 * Fila de encabezados = primera que tenga una celda con "RUT" (puede haber títulos arriba);
 * si no hay, la primera fila. Adivina las columnas; una columna no se usa para dos datos.
 */
export function leerFilasProveedores(filas: readonly Fila[]): {
  /** Nº de fila del Excel (desde 1) de la primera fila de datos. */
  primeraFila: number
  encabezados: string[]
  datos: Fila[]
  mapeo: MapeoProveedores
} {
  let indice = filas.findIndex((f) => f.some((c) => PATRONES_PROVEEDORES.rut.test(String(c ?? ''))))
  if (indice < 0) indice = 0
  const encabezados = (filas[indice] ?? []).map((x) => String(x ?? '').trim())
  const mapeo: MapeoProveedores = { nombre: -1, rut: -1, dv: -1 }
  const usadas = new Set<number>()
  for (const campo of ['dv', 'rut', 'nombre'] as const) {
    const j = encabezados.findIndex((h, i) => PATRONES_PROVEEDORES[campo].test(h) && !usadas.has(i))
    mapeo[campo] = j
    if (j >= 0) usadas.add(j)
  }
  return { primeraFila: indice + 2, encabezados, datos: filas.slice(indice + 1), mapeo }
}

export interface FilaImportada extends ProveedorBase {
  /** Nº de fila en el Excel. */
  fila: number
}
export interface ProveedorExistente extends FilaImportada {
  /** Nombre con que ya está registrado ese RUT. */
  registrado: string
  /** El nombre del archivo es distinto al registrado (se informa; no se cambia). */
  distinto: boolean
}
export interface FilaConError extends FilaImportada {
  motivo: string
}
export interface VistaPreviaImportacion {
  nuevos: FilaImportada[]
  existentes: ProveedorExistente[]
  errores: FilaConError[]
}

const texto = (fila: Fila, j: number) => (j >= 0 ? tr(String(fila[j] ?? '')) : '')

/**
 * Clasifica las filas del archivo: nuevos (se agregan), ya existentes (mismo RUT; no se tocan) y con
 * error (sin nombre, RUT inválido o repetido dentro del archivo). Las filas vacías se ignoran.
 */
export function previsualizarImportacion(
  datos: readonly Fila[],
  mapeo: MapeoProveedores,
  existentes: readonly Proveedor[],
  primeraFila = 2,
): VistaPreviaImportacion {
  const r: VistaPreviaImportacion = { nuevos: [], existentes: [], errores: [] }
  const porRut = new Map(existentes.map((p) => [p.rut, p]))
  const vistos = new Map<string, number>()
  for (const [i, f] of datos.entries()) {
    const nombre = texto(f, mapeo.nombre)
    const dv = texto(f, mapeo.dv)
    const rutEscrito = texto(f, mapeo.rut)
    if (!nombre && !rutEscrito) continue
    const fila = i + primeraFila
    const rutCompleto = dv ? `${rutEscrito}-${dv}` : rutEscrito
    if (!nombre) {
      r.errores.push({ fila, nombre, rut: rutCompleto, motivo: 'Falta el nombre.' })
      continue
    }
    if (!rutValido(rutCompleto)) {
      const motivo = rutEscrito ? 'RUT inválido.' : 'Falta el RUT.'
      r.errores.push({ fila, nombre, rut: rutCompleto, motivo })
      continue
    }
    const rut = normalizarRut(rutCompleto)
    const antes = vistos.get(rut)
    if (antes) {
      r.errores.push({ fila, nombre, rut, motivo: `RUT repetido en el archivo (fila ${antes}).` })
      continue
    }
    vistos.set(rut, fila)
    const ya = porRut.get(rut)
    if (ya) {
      const registrado = tr(ya.nombre)
      r.existentes.push({ fila, nombre, rut, registrado, distinto: norm(registrado) !== norm(nombre) })
    } else r.nuevos.push({ fila, nombre, rut })
  }
  return r
}
