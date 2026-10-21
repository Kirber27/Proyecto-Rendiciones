/** Descarga un archivo generado en el navegador (Excel, PDF…). */
export function descargar(datos: Blob, nombre: string) {
  const url = URL.createObjectURL(datos)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.append(a)
  a.click()
  a.remove()
  // Se libera después para que el navegador alcance a iniciar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
