import type { Rol } from '@/types/roles'

/** Roles de una ruta: '*' = cualquier usuario con sesión. */
export type RolesRuta = Rol[] | '*'

export function puedeEntrar(roles: RolesRuta | undefined, rol: Rol): boolean {
  if (!roles || roles === '*') return true
  return roles.includes(rol)
}
