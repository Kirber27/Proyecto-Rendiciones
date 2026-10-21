import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { TESORERIA, type Rol } from '@/types/roles'
import { puedeEntrar, type RolesRuta } from './permisos'

declare module 'vue-router' {
  interface RouteMeta {
    /** Quién puede entrar. Sin valor = cualquiera con sesión. */
    roles?: RolesRuta
    /** Ruta sin sesión (ingreso). */
    publica?: boolean
    /** Si es pestaña del encabezado: su texto (puede depender del rol) y su orden. */
    pestana?: { texto: string | ((rol: Rol) => string); orden: number }
  }
}

const SOLO_TESORERIA = TESORERIA
const INICIO = '/rendir'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: INICIO },
  {
    path: '/rendir',
    name: 'rendir',
    component: () => import('@/views/RendirView.vue'),
    meta: { roles: '*', pestana: { texto: 'Rendir gastos', orden: 1 } },
  },
  {
    path: '/mis',
    name: 'carpetas',
    component: () => import('@/views/CarpetasView.vue'),
    meta: {
      roles: '*',
      pestana: {
        texto: (rol) => (TESORERIA.includes(rol) ? 'Carpetas' : 'Mis rendiciones'),
        orden: 2,
      },
    },
  },
  {
    path: '/mis/:personaId',
    name: 'carpeta-persona',
    component: () => import('@/views/CarpetasView.vue'),
    meta: { roles: SOLO_TESORERIA },
  },
  {
    path: '/aprobar',
    name: 'aprobar',
    component: () => import('@/views/PorAprobarView.vue'),
    meta: { roles: SOLO_TESORERIA, pestana: { texto: 'Por aprobar', orden: 3 } },
  },
  {
    path: '/libro',
    name: 'libro',
    component: () => import('@/views/LibroView.vue'),
    meta: { roles: SOLO_TESORERIA, pestana: { texto: 'Rendiciones', orden: 4 } },
  },
  {
    path: '/personas',
    name: 'personas',
    component: () => import('@/views/PersonasView.vue'),
    meta: { roles: SOLO_TESORERIA, pestana: { texto: 'Personas', orden: 5 } },
  },
  {
    path: '/banco',
    name: 'banco',
    component: () => import('@/views/BancoView.vue'),
    meta: { roles: SOLO_TESORERIA, pestana: { texto: 'Banco', orden: 6 } },
  },
  {
    path: '/perfiles',
    name: 'perfiles',
    component: () => import('@/views/PerfilesView.vue'),
    meta: { roles: ['administrador'], pestana: { texto: 'Perfiles', orden: 7 } },
  },
  {
    path: '/ingresar',
    name: 'ingresar',
    component: () => import('@/views/LoginView.vue'),
    meta: { publica: true },
  },
  ...(import.meta.env.DEV
    ? [{ path: '/_estilos', name: 'estilos', component: () => import('@/views/EstilosView.vue') }]
    : []),
  { path: '/:pathMatch(.*)*', redirect: INICIO },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  if (to.meta.publica) return true
  // La verificación de sesión (sin sesión → /ingresar) se agrega en la tarea 1.8.
  const auth = useAuthStore()
  return puedeEntrar(to.meta.roles, auth.rol) ? true : INICIO
})
