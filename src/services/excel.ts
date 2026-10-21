// Escritura del Excel de rendiciones con SheetJS (se carga solo cuando se exporta).
import {
  ANCHOS_EXCEL,
  COLUMNAS_FECHA,
  COLUMNAS_MONTO,
  ENCABEZADOS_EXCEL,
  type CeldaExcel,
} from '@/domain/exportar'
import { descargar } from '@/lib/descargar'

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Arma el libro con la hoja "Rendiciones" (encabezados, formatos de fecha y miles, anchos). */
export async function construirLibroExcel(filas: readonly CeldaExcel[][]): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const aoa: CeldaExcel[][] = [[...ENCABEZADOS_EXCEL], ...filas]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  for (let fila = 1; fila < aoa.length; fila++) {
    for (const c of COLUMNAS_FECHA) {
      const celda = ws[XLSX.utils.encode_cell({ r: fila, c })]
      if (celda) celda.z = 'dd-mm-yyyy'
    }
    for (const c of COLUMNAS_MONTO) {
      const celda = ws[XLSX.utils.encode_cell({ r: fila, c })]
      if (celda) celda.z = '#,##0'
    }
  }
  ws['!cols'] = ANCHOS_EXCEL.map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rendiciones')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

/** Genera y descarga el Excel. */
export async function descargarExcel(filas: readonly CeldaExcel[][], nombre: string) {
  const datos = await construirLibroExcel(filas)
  descargar(new Blob([datos], { type: TIPO_XLSX }), nombre)
}
