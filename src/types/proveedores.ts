/** Proveedor tal como se escribe o importa (RUT escrito de cualquier forma). */
export interface ProveedorBase {
  nombre: string
  rut: string
}

/** Proveedor registrado (RUT normalizado: 12345678-5). */
export interface Proveedor extends ProveedorBase {
  id: string
  /** Eliminado: no aparece para elegir (solo tesorería lo ve, para restaurarlo). */
  eliminado: boolean
}

/** Columnas del Excel de proveedores (índice; -1 = no tiene). */
export interface MapeoProveedores {
  nombre: number
  rut: number
  /** Dígito verificador en columna aparte (algunos sistemas lo exportan así). */
  dv: number
}
