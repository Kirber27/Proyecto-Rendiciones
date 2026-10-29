# 12 · Ajustes de UI — Tareas

Requiere: 02 (formulario), 04 (libro), 11 (ajustes del cliente). Solo frontend, sin migraciones. Una tarea por vez; cada una actualiza primero el steering que toca (`ui.md`, `structure.md`) y termina con `build`, `lint` y `test` en verde.

- [x] **12.1 Botones de 48 px** _(R2)_
  - Variables de Bootstrap y regla `.btn:not(.btn-link)` con `min-height: 48px` e `inline-flex`.
  - Revisar los usos de `.btn` y las filas campo + botón. Revisar `/_estilos` en claro y oscuro.
  - Tests: los que dependan de clases o textos de botones siguen pasando.
  - Hecho: `$btn-padding-y*` = 0,5rem y `$btn-line-height` 1,25; `.btn:not(.btn-link)` con `min-height: 48px`, `inline-flex` y `gap` (el espacio ícono–texto ya no depende del espacio en el HTML). Sin conflictos con utilidades (ningún `.btn` usa `w-100`, `text-start` ni contenido mixto, salvo el `btn-link` de la tarjeta). Filas campo con etiqueta + botón siguen con `align-items-end`. Revisado el ingreso en Chrome sin interfaz; el resto se revisa en 12.6. 446 tests.

- [x] **12.2 Gastos en colapsables** _(R1)_
  - `LineasTable` → `LineasGastos`; un solo marcado para todos los anchos (sin `useEsAncho`).
  - Título "Gasto N · Proveedor" + total + marca de problema; agregar al final abierto y con foco; quitar con confirmación en línea; apertura inicial; cuadre al final.
  - Dominio: mensajes "Gasto N: …" y `problemasDeLinea`.
  - Tests: los de `LineasTable` migrados + los nuevos (título, agregar, quitar, apertura inicial).
  - Hecho: `LineasGastos.vue` (un archivo; sin `GastoColapsable`), con clases de `.accordion` y estado en Vue (abiertos por línea, clave estable por `WeakMap`). Neto/IVA solo en facturas (o si la línea trae neto); "Monto" en los demás. `ProveedorSelect` acepta `inputId` para su `<label>`. Dominio: `problemasDeLinea`, `gastosConProblemas`, `lineaConDatos`; mensajes "Gasto N: …" y "Repite el Nº del gasto N.". "Agregar gasto" lo emite la lista y lo crea el editor. 452 tests. Falta verlo en el navegador (12.6).

- [x] **12.3 Libro: orden por columna y separadores** _(R3)_
  - `ordenarLibro` y `siguienteOrden` en `domain/libro.ts` con tests; `ThOrden.vue`; `.table-cols`.
  - `LibroView`: orden sobre la lista filtrada, vuelve a la página 1.
  - Hecho: `COLUMNAS_LIBRO`, `OrdenLibro`, `siguienteOrden`, `ordenarLibro` (el orden por defecto queda en un solo lugar, `porDefecto`, que también usa `filtrarLibro`). `ThOrden.vue` genérico por columna; estilos `.table-cols` y `.th-orden`. Test de vista: asc, desc, vuelta y `aria-sort`. 458 tests.

- [x] **12.4 Libro: paginación de 15 con selector** _(R4)_
  - `TAMANOS_PAGINA_LIBRO`, `paginar` con `desde`/`hasta`; `TablaPaginacion.vue`; tamaño recordado en `localStorage`.
  - Tests: dominio y vista (cambiar tamaño vuelve a la página 1, rango correcto).
  - Hecho: `TAMANOS_PAGINA_LIBRO`; `paginar` devuelve `desde`/`hasta` (Proveedores y Banco siguen con 50). `TablaPaginacion.vue` (el nombre de una palabra no pasa el lint de Vue); se muestra con más de 15 rendiciones. Tamaño en `localStorage['libro:tamano']` con try/catch. 461 tests.

- [x] **12.5 Libro: detalle en su propia vista** _(R5)_
  - Ruta `/libro/:id?`; tabla o detalle según la ruta; "← Volver al libro"; conservar estado y dejar a la vista la fila abierta; aviso si la rendición no está.
  - Tests de la vista: abrir oculta la tabla, volver la muestra con la misma búsqueda y página, acción → vuelve con mensaje, id inexistente.
  - Hecho: ruta `/libro/:id?` (mismo registro: la vista se reutiliza y conserva su estado). `volver()` espera la navegación; `alCambiar` vuelve y luego recarga. Fila con `data-id` y marcada por `ultimaAbierta`; `scrollIntoView({ block: 'center' })` al volver. Aviso si la dirección no calza. `DetalleLibro` sin "Cerrar" en la cabecera ("Cancelar" del pie también vuelve). Los mensajes del libro quedan arriba de la vista. Tests con router en memoria (detalle, atrás, dirección directa e inexistente). 464 tests.

- [x] **12.7 Encabezados de tabla destacados** _(R6, pedido 2026-10-29)_
  - Hecho: `.table > thead th` con `--bs-table-bg: var(--bs-primary)` y texto `var(--app-accent-ink)` (las mismas variables del botón primario en cada tema); separadores del encabezado al 30 % del color del texto; `.th-orden` subraya al pasar el mouse. Revisado con el CSS compilado en claro y oscuro.

- [ ] **12.6 Prueba en el navegador** — la hace el usuario
  - Rendir gastos desde el celular con 3 gastos (agregar, cerrar, quitar). Por aprobar y libro con una rendición del historial de muchas líneas.
  - Libro: ordenar por cada columna, cambiar el tamaño de página, abrir un detalle y volver con el "atrás" del celular.
  - Encabezados azules en todas las tablas (Por aprobar, libro, Personas, Banco, Perfiles, Proveedores), en claro y oscuro.
