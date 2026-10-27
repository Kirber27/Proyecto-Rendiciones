// La API de Supabase devuelve como máximo 1.000 filas por consulta (`max_rows`): las listas que pueden
// crecer se piden por páginas con `.range()`. La consulta debe ordenar por una clave única para que
// las páginas no se traslapen.

/** Filas por página (igual al `max_rows` por defecto de Supabase). */
export const FILAS_POR_PAGINA = 1000

type Respuesta<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Trae todas las filas de una consulta pidiendo página por página.
 * `pagina(desde, hasta)` arma la consulta con `.range(desde, hasta)`.
 */
export async function traerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>,
  tamano = FILAS_POR_PAGINA,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1)
    if (error) throw new Error(error.message)
    filas.push(...(data ?? []))
    if ((data?.length ?? 0) < tamano) return filas
  }
}
