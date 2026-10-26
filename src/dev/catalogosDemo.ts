// Catálogos de ejemplo para /_estilos y tests, mientras no existe la base (tarea 1.9).
// Las listas contables usan la grafía real (CLAUDE/datos/lists.json, con espacios finales);
// las personas son FICTICIAS.
import type { Catalogos } from '@/types/catalogos'
import { lineaVacia } from '@/domain/rendicion'
import type { BorradorRendicion } from '@/types/rendicion'

export const catalogosDemo: Catalogos = {
  personas: [
    { id: 'p-1', nombre: 'Juana Pérez ', codigo: 'JPE' },
    { id: 'p-2', nombre: 'Mario Soto', codigo: 'MSO' },
    { id: 'p-3', nombre: 'Laura Rojas', codigo: 'LRO' },
  ],
  empresas: [
    { id: 1, nombre: 'Heca Global SPA', rut: '76723245-4', centroCostoId: 1 },
    { id: 2, nombre: 'Hecaglobal Instruments SPA', rut: '76886693-7', centroCostoId: 3 },
    { id: 3, nombre: 'Siga Sonriendo SPA', rut: '77422425-4', centroCostoId: 4 },
    { id: 4, nombre: 'Sonrie Pro Financial SPA', rut: '77219167-7', centroCostoId: null },
  ],
  centrosCosto: [
    { id: 1, nombre: 'HG' },
    { id: 2, nombre: 'HC' },
    { id: 3, nombre: 'HGI.' },
    { id: 4, nombre: 'SS' },
    { id: 5, nombre: 'CS' },
  ],
  cuentas: [
    { id: 1, nombre: 'Oficina' },
    { id: 2, nombre: 'Operacionales' },
    { id: 4, nombre: 'Viajes ' },
    { id: 5, nombre: 'Extras' },
    { id: 9, nombre: 'Importaciones / Export. ' },
  ],
  subcuentas: [
    { id: 7, nombre: 'Artículos de Oficina ', cuentaSugeridaId: 1 },
    { id: 8, nombre: 'Bencina', cuentaSugeridaId: 2 },
    { id: 9, nombre: 'Estacionamiento', cuentaSugeridaId: 2 },
    { id: 12, nombre: 'Taxi - Uber', cuentaSugeridaId: 2 },
    { id: 14, nombre: 'Comidas y Bebidas ', cuentaSugeridaId: 2 },
    { id: 29, nombre: 'Hospedaje', cuentaSugeridaId: 4 },
    { id: 40, nombre: 'Instituto Salud Publica (CDA)', cuentaSugeridaId: 9 },
    { id: 41, nombre: 'TAG ', cuentaSugeridaId: null },
  ],
  mediosPago: [
    { id: 1, nombre: 'Banco Estado HGI' },
    { id: 2, nombre: 'Banco Internacional HGI ' },
    { id: 3, nombre: 'No Genera Pago ' },
  ],
}

/** Borrador de ejemplo: caso de prueba documentado (Nº 42, boleta ISP de $70.389). */
export function borradorDemo(): BorradorRendicion {
  return {
    personaId: 'p-1',
    nro: '42',
    fecha: '2026-10-14',
    empresaId: 2,
    fondo: 'FONDOS POR RENDIR CDA',
    totalFormulario: '70.389',
    documentosLeidos: 1,
    dudas: ['El RUT del proveedor no se lee bien en la boleta.'],
    respaldos: [],
    lineas: [
      lineaVacia({
        fecha: '2026-10-14',
        tipo: 'Boleta',
        proveedor: 'ISP',
        numero: '2026101400444231',
        exento: '70.389',
        detalle: 'CDA IMP ADEOR 07',
        subcuentaId: 40,
        cuentaId: 9,
        centroCostoId: 3,
      }),
    ],
  }
}
