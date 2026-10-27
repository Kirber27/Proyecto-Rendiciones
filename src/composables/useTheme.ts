import { readonly, ref } from 'vue'

export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro'
export type Tema = 'light' | 'dark'

export const CLAVE_TEMA = 'tema'
const ORDEN: PreferenciaTema[] = ['sistema', 'claro', 'oscuro']

const preferencia = ref<PreferenciaTema>('sistema')
const tema = ref<Tema>('light')
let iniciado = false

function leerGuardada(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE_TEMA)
    return v === 'claro' || v === 'oscuro' ? v : 'sistema'
  } catch {
    return 'sistema'
  }
}

function sistemaOscuro(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

export function resolverTema(p: PreferenciaTema, oscuroSistema: boolean): Tema {
  if (p === 'claro') return 'light'
  if (p === 'oscuro') return 'dark'
  return oscuroSistema ? 'dark' : 'light'
}

function aplicar() {
  tema.value = resolverTema(preferencia.value, sistemaOscuro())
  document.documentElement.dataset.bsTheme = tema.value
}

function elegir(p: PreferenciaTema) {
  preferencia.value = p
  try {
    if (p === 'sistema') localStorage.removeItem(CLAVE_TEMA)
    else localStorage.setItem(CLAVE_TEMA, p)
  } catch {
    // Sin almacenamiento (modo privado): el tema dura solo esta visita.
  }
  aplicar()
}

function siguiente() {
  elegir(ORDEN[(ORDEN.indexOf(preferencia.value) + 1) % ORDEN.length]!)
}

/** Tema claro/oscuro: sigue al sistema por defecto y recuerda la elección en el navegador. */
export function useTheme() {
  if (!iniciado) {
    iniciado = true
    preferencia.value = leerGuardada()
    aplicar()
    if (typeof window.matchMedia === 'function') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => preferencia.value === 'sistema' && aplicar())
    }
  }
  return { preferencia: readonly(preferencia), tema: readonly(tema), elegir, siguiente }
}
