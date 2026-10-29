# 12 · Ajustes de UI — Diseño

## Resumen de cambios

| Punto | Dominio | Componentes / estilos |
| --- | --- | --- |
| 1 Gastos en colapsables | `validarRendicion`: "Gasto N" | `LineasTable` → `LineasGastos` |
| 2 Botones 48 px | — | `_bootstrap-vars.scss`, `_components.scss` |
| 3 Orden y separadores | `ordenarLibro` (nuevo, `domain/libro.ts`) | `LibroView`, `ThOrden` (nuevo, `components/ui/`) |
| 4 Paginación | `paginar` (sin cambios) + `TAMANOS_PAGINA_LIBRO` | `TablaPaginacion` (nuevo, `components/ui/`) |
| 5 Detalle en su vista | — | ruta `/libro/:id?`, `LibroView`, `DetalleLibro` |

Sin migraciones. Cada tarea termina con `build`, `lint` y `test` en verde.

## 1. Gastos en colapsables

- `LineasTable.vue` se renombra a **`LineasGastos.vue`** (ya no es una tabla) y deja de usar `useEsAncho`: un solo marcado para todos los anchos. Toda la lógica (proveedor, IVA, subcuenta nueva, `useDocumentoRepetido`) se queda ahí, y cada gasto se dibuja en el mismo archivo: separarlo en un `GastoColapsable` obligaba a reenviar seis eventos sin ganar claridad.
- Colapsable sin JS de Bootstrap: estado en Vue (`abiertos: Set<LineaBorrador>`, por referencia de la línea para que sobreviva a quitar y renumerar). Marcado con las clases de `.accordion` de Bootstrap (`accordion-item`, `accordion-button`, `collapsed`) para heredar estilos y modo oscuro; el cuerpo con `v-show`. Sin animación (cumple `prefers-reduced-motion` por defecto).
- Título: `Gasto {{ i + 1 }} · {{ tr(l.proveedor) || 'Sin proveedor' }}` + total (`clp(totalLinea(l))`) a la derecha + ícono `bi-exclamation-circle` si tiene problema.
- Problemas por gasto: `problemasDeLinea(l, i, repetidos, ctx)` arma los mensajes "Gasto N: …" (la usa `validarRendicion`) y `gastosConProblemas(problemas)` devuelve los índices, en el mismo módulo que el prefijo. El editor pasa a `LineasGastos` la misma lista que ya muestra (solo tras intentar enviar/aprobar), así las tres pantallas no cambian. Además se marca en vivo el gasto con Nº de documento repetido.
- Cuerpo: `row g-3` con `col-6 col-md-3` (Fecha, Tipo, RUT, Nº doc., montos) y `col-12 col-md-6` (Proveedor, Detalle, Subcuenta); Cuenta y C.C. `col-md-4` / `col-md-2`. Neto e IVA solo en facturas (o si la línea ya trae neto, del historial); el exento se llama "Monto" en los demás tipos, como en la tarjeta del celular. Etiquetas `label-caps` con `for`. Al final, alineado a la derecha, "Quitar gasto" (`btn-outline-danger`) con confirmación en línea si `tieneDatosLinea(l)`.
- "Agregar gasto" (antes "Agregar línea") se mueve **debajo del último gasto**, antes del cuadre. `LineasGastos` emite `agregar` (el editor crea la línea con la fecha y el C.C. de la empresa) y, al ver que el mismo arreglo creció, abre solo el nuevo y enfoca su fecha (`nextTick` + `focus()`).
- Apertura inicial (R1.5): al montar o al cambiar de borrador, `abiertos` = la única línea, o las que tengan problemas.
- `RendicionEditor` cambia el import y el texto del botón; `CuadreTotales` queda igual, después de la lista.
- Tests: se reescriben los de `LineasTable` en `LineasGastos.test.ts` (mismos casos: proveedor, IVA, subcuenta nueva, documento repetido) + título, agregar abre y enfoca, quitar con confirmación, apertura inicial.

## 2. Botones de 48 px

```scss
// _bootstrap-vars.scss
$btn-line-height: 1.25;
$btn-padding-y: 0.5rem;      // el alto lo fija min-height
$btn-padding-y-sm: 0.5rem;
$btn-padding-y-lg: 0.5rem;

// _components.scss
.btn:not(.btn-link) {   // btn-close no es .btn
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}
```

- `min-height` (no `height`) para que un texto en dos líneas no se corte en el celular.
- Exclusiones (R2.3): `btn-close` y `.thumb-quitar` no son `.btn`; `btn-link` queda fuera por el selector. No hace falta una clase propia.
- Filas con campo + botón: las que tienen etiqueta siguen con `align-items-end`.
- Tablas con botones por fila (Personas, Proveedores, Banco): las filas crecen a 48 px; aceptado por la regla.

## 3. Orden por columna y separadores

```ts
// domain/libro.ts
export type ColumnaLibro = 'folio' | 'fecha' | 'persona' | 'nro' | 'total' | 'pagado' | 'saldo' | 'estado' | 'origen'
export type Orden = { columna: ColumnaLibro; dir: 'asc' | 'desc' } | null
export function ordenarLibro(filas, porRendicion, orden): FilaLibro[]  // copia; null = orden por defecto
export function siguienteOrden(actual: Orden, columna: ColumnaLibro): Orden  // asc → desc → null
```

- `ordenarLibro` usa `norm` para texto, `pagoDe(porRendicion, id)` para pagado / saldo / estado (eliminadas: 0 y "Eliminada"), y desempata con el orden por defecto (fecha desc, folio). Tests en `domain/__tests__/libro.test.ts`.
- `LibroView`: `orden = ref<Orden>(null)`; `lista` = `ordenarLibro(filtrarLibro(…), …)`; cambiar el orden → página 1.
- `ThOrden.vue` (`components/ui/`): `<th :aria-sort>` con un `<button class="th-orden">` (texto + ícono) que emite `ordenar`. No es `.btn` (no lleva 48 px).
- Separadores: clase `.table-cols` en `_components.scss` → `td + td, th + th { border-left: 1px solid var(--bs-border-color) }`. Reutilizable en otras tablas después.

## 4. Paginación

- `domain/libro.ts`: `TAMANOS_PAGINA_LIBRO = [15, 25, 50, 100] as const`. `paginar` ya recibe el tamaño; devuelve además `desde` y `hasta` para el rango.
- `TablaPaginacion.vue` (`components/ui/`): props `pagina`, `paginas`, `total`, `desde`, `hasta`, `tamano`, `tamanos`, `etiqueta` ("rendiciones"); emite `update:pagina` y `update:tamano`. `d-flex flex-wrap gap-2 align-items-center`. Proveedores y Banco pueden usarlo después (no en este spec).
- `LibroView`: `tamano` leído de `localStorage['libro:tamano']` (try/catch; valor fuera de la lista → 15), guardado al cambiar.

## 5. Detalle en su propia vista

- Ruta: `path: '/libro/:id?'` en el mismo registro `libro` → `LibroView` se reutiliza al ir y volver, así **conserva su estado** (búsqueda, filtro, orden, página, tamaño) sin guardarlo aparte.
- `seleccionId` pasa a ser `computed(() => route.params.id)`. `abrir(id)` → `router.push({ name: 'libro', params: { id } })` y anota que se abrió desde la tabla; "Volver" → `router.back()` en ese caso (esperando el `afterEach`, porque `back()` no devuelve promesa), si no `router.push({ name: 'libro' })` (llegó por la dirección).
- Plantilla: `v-if="seleccion"` muestra `DetalleLibro` con el botón "← Volver al libro" arriba; `v-else` muestra KPIs, filtros, tabla y paginación. Al volver, `nextTick` + `scrollIntoView({ block: 'center' })` de la fila abierta (queda con `fila-sel`) en vez de subir al inicio.
- `alCambiar(texto)` → vuelve a la tabla, muestra el mensaje y recarga (como hoy).
- R5.6: el `watch(seleccion)` actual, cuando el libro ya cargó y no está, hace `router.replace({ name: 'libro' })` y muestra el aviso.
- `DetalleLibro`: el botón "Cerrar" de la cabecera se reemplaza por "← Volver al libro" (sigue emitiendo `cerrar`); el "Cancelar" del pie también vuelve.

## Steering a actualizar

- `ui.md`: botones de 48 px (regla y exclusiones); `table.edit` → gastos en colapsables; tablas con `.table-cols` y `ThOrden`; `TablaPaginacion`.
- `structure.md`: `LineasGastos`, `ThOrden`, `TablaPaginacion`.
- `business-rules.md`: nada (sin cambios de reglas).
