/** Elemento de catálogo. `nombre` con la grafía exacta de la base (se muestra con `tr()`). */
export interface OpcionCatalogo {
  id: number
  nombre: string
}

export interface Subcuenta extends OpcionCatalogo {
  /** Cuenta que se propone al elegir esta subcuenta (subcuenta_a_cuenta.json). */
  cuentaSugeridaId: number | null
}

export interface Empresa extends OpcionCatalogo {
  rut: string
  /** C.C. por defecto de las líneas de esta empresa. */
  centroCostoId: number | null
}

export interface PersonaOpcion {
  id: string
  nombre: string
  codigo: string
}

/** Todo lo que el editor de rendición necesita para sus listas. */
export interface Catalogos {
  personas: PersonaOpcion[]
  empresas: Empresa[]
  cuentas: OpcionCatalogo[]
  subcuentas: Subcuenta[]
  centrosCosto: OpcionCatalogo[]
  /** Bancos, cajas y "No Genera Pago" (para pagos y cartolas). */
  mediosPago: OpcionCatalogo[]
}
