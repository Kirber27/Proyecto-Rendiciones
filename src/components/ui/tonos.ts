/** Color de chip por estado o evento (EST_CHIP / EV_CHIP del prototipo, ver steering/ui.md). */
export type Tono = 'ok' | 'warn' | 'bad' | 'info' | 'muted'

const TONOS: Record<string, Tono> = {
  Aprobada: 'ok',
  Pagada: 'ok',
  Pago: 'ok',
  Cuadra: 'ok',
  'Pago parcial': 'warn',
  Reenviada: 'warn',
  'Aprobación anulada': 'warn',
  Anticipo: 'warn',
  Observada: 'bad',
  Rechazada: 'bad',
  Eliminada: 'bad',
  'No cuadra': 'bad',
  'En revisión': 'info',
  Enviada: 'info',
  'Pendiente de pago': 'info',
  'Sin monto': 'muted',
  'Ingresada (historial)': 'muted',
  'No genera pago': 'muted',
  'Devolución de la persona': 'muted',
}

export function tonoDe(estado: string | null | undefined): Tono {
  return (estado && TONOS[estado]) || 'muted'
}
