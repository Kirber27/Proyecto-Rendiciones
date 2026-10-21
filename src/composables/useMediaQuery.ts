import { onBeforeUnmount, ref } from 'vue'

/**
 * Estado reactivo de una media query. Si el entorno no tiene matchMedia (tests),
 * devuelve `porDefecto`.
 */
export function useMediaQuery(query: string, porDefecto = true) {
  const coincide = ref(porDefecto)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return coincide

  const mq = window.matchMedia(query)
  const actualizar = () => (coincide.value = mq.matches)
  actualizar()
  mq.addEventListener('change', actualizar)
  onBeforeUnmount(() => mq.removeEventListener('change', actualizar))
  return coincide
}

/** Escritorio/tablet (≥ md de Bootstrap). */
export const useEsAncho = () => useMediaQuery('(min-width: 768px)')
