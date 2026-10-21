/** Funciones de la app. Mismo orden y valores que el enum `rol_app` de la base. */
export const ROLES = ['administrador', 'tesorero', 'solicitante'] as const
export type Rol = (typeof ROLES)[number]

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: 'Administrador',
  tesorero: 'Tesorero',
  solicitante: 'Solicitante',
}

/** Tesorería = Tesorero o Administrador. */
export const TESORERIA: Rol[] = ['tesorero', 'administrador']
