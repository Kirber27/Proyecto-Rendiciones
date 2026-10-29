# 12 · Ajustes de UI — Requisitos

Ajustes de experiencia y de interfaz pedidos el 2026-10-29, después de usar la app con el cliente. Solo frontend: no cambian la base, las RPC ni las reglas de negocio.

Afectan el formulario de rendición (`RendicionEditor`: Rendir gastos, Por aprobar y edición en el libro), los botones de toda la app y la pestaña **Rendiciones** (libro).

Decisiones tomadas (2026-10-29; se pueden corregir antes de implementar):

- Los gastos en colapsables aplican a las **tres pantallas** que usan el formulario (es el mismo componente) y en **todos los anchos**: reemplazan a la tabla de escritorio y a las tarjetas del celular.
- El alto de 48 px es para **todos los botones** (`.btn`, de cualquier tamaño). Los campos de formulario no cambian de alto (ver R2.4).
- El tamaño de página del libro se elige de una lista (15, 25, 50, 100), no se escribe.
- El detalle del libro tiene su propia dirección (`/libro/<id>`), así el botón "atrás" del navegador o del celular vuelve a la tabla.

## R1. Gastos en colapsables (punto 1)

- **R1.1** En la sección "Gastos" del formulario, cada gasto DEBERÁ mostrarse como un **colapsable** con sus campos como formulario (etiqueta arriba de cada campo, en grilla), sin tabla y sin scroll horizontal en ningún ancho.
- **R1.2** El título del colapsable DEBERÁ ser **"Gasto N · Proveedor"** (N = posición; el proveedor elegido o, en líneas antiguas, el texto guardado). Sin proveedor: "Gasto N · Sin proveedor". A la derecha del título DEBERÁ mostrarse el **total del gasto** (`$ 70.389`, mono) para revisar sin abrirlo.
- **R1.3** El título DEBERÁ indicar si el gasto tiene un problema de validación (Nº de documento repetido o problemas de la lista de validación de ese gasto) con un ícono y borde de color peligro, también cuando está cerrado.
- **R1.4** "Agregar gasto" DEBERÁ agregar el nuevo colapsable **al final**, abierto, cerrar los demás y llevar el foco a su primer campo.
- **R1.5** Al abrir el formulario: SI tiene un solo gasto, ENTONCES queda abierto; SI tiene varios (rendición guardada o borrador recuperado), ENTONCES quedan cerrados, salvo los que tienen problemas. La persona puede abrir y cerrar varios a la vez.
- **R1.6** El botón **"Quitar gasto"** DEBERÁ ir al final del cuerpo de cada colapsable. SI el gasto tiene datos, ENTONCES pide confirmación en línea ("¿Quitar el gasto 2?"). Quitar el único gasto lo deja vacío (como hoy). Los gastos siguientes se renumeran.
- **R1.7** El cuadre (suma, total del formulario y "Cuadra" / "Diferencia") DEBERÁ quedar **al final**, después del último gasto, como está hoy.
- **R1.8** Se mantienen todas las reglas actuales de la línea: proveedor de la lista con RUT de solo lectura, IVA calculado, impuesto especial, Nº de documento repetido en rojo, nueva subcuenta (tesorería), Cuenta y C.C. solo para tesorería.
- **R1.9** Los mensajes de validación del formulario DEBERÁN decir **"Gasto N: …"** en vez de "Línea N: …" para calzar con los títulos. (Los mensajes que vienen del servidor siguen diciendo "Línea N".)
- **R1.10** Accesibilidad: el título es un botón con `aria-expanded` y `aria-controls`; se abre y cierra con teclado; respeta `prefers-reduced-motion`.

## R2. Botones del mismo alto (punto 2)

- **R2.1** Todos los botones de la app (`.btn`: primario, secundario, éxito, peligro, contorno, `btn-sm`, `btn-lg`, en grupos) DEBERÁN medir **48 px de alto**. El ancho varía según el texto.
- **R2.2** `btn-sm` y `btn-lg` solo cambian el tamaño de letra y el relleno horizontal, no el alto.
- **R2.3** Quedan fuera: la × de cerrar (`btn-close`), la × de las miniaturas de respaldos (`.thumb-quitar`, no es `.btn`) y los botones con aspecto de enlace (`btn-link`: título de la tarjeta de rendición, "¿Olvidaste tu contraseña?"). Las pestañas de navegación no son botones.
- **R2.4** Los campos de formulario mantienen su alto actual (en un `input-group` el campo se estira al alto del botón). Donde un campo **con etiqueta** y un botón van en la misma fila, se alinean por abajo (`align-items-end`, como hoy); un campo sin etiqueta y un botón, al centro.
- **R2.5** El texto e ícono del botón DEBERÁN quedar centrados verticalmente, también si el texto ocupa dos líneas en el celular.

## R3. Libro: tabla con separadores y orden por columna (punto 3)

- **R3.1** La tabla del libro DEBERÁ tener **líneas verticales** de separación entre columnas (borde de 1 px con el color `line`).
- **R3.2** Cada encabezado (Folio, Fecha, Solicitante, Nº, Total, Pagado, Por pagar, Estado, Origen) DEBERÁ tener un **ícono de orden** y ordenar la tabla al hacer clic (o Enter/Espacio).
- **R3.3** Ciclo por columna: 1.er clic **ascendente** (A→Z, menor a mayor, más antigua primero), 2.º **descendente**, 3.º vuelve al **orden por defecto** del libro (fecha descendente y folio). Ordenar por otra columna reemplaza el orden anterior.
- **R3.4** Íconos: sin ordenar `bi-arrow-down-up` (tenue), ascendente `bi-sort-up`, descendente `bi-sort-down`. El encabezado ordenado lleva `aria-sort` (`ascending` / `descending`).
- **R3.5** El orden DEBERÁ aplicarse a **toda la lista filtrada** (no solo a la página visible) y volver a la página 1. Se mantiene al cambiar el filtro o la búsqueda.
- **R3.6** Criterios: texto con `norm` (sin tildes ni mayúsculas); Fecha por fecha; Nº, Total, Pagado y Por pagar por número (las eliminadas, sin pago, cuentan como 0); Estado por el texto del estado mostrado. Empates: orden por defecto.

## R4. Libro: paginación de 15 con selector (punto 4)

- **R4.1** El libro DEBERÁ mostrar **15 rendiciones por página** por defecto.
- **R4.2** Junto a la paginación DEBERÁ haber un selector **"Mostrar [15] por página"** con 15, 25, 50 y 100. Al cambiarlo vuelve a la página 1.
- **R4.3** El tamaño elegido DEBERÁ recordarse en ese navegador (`localStorage`; si no está disponible, 15).
- **R4.4** La paginación DEBERÁ mostrar el rango: "1–15 de 182 rendiciones · Página 1 de 13", con Anterior / Siguiente. Se muestra siempre que haya más rendiciones que la opción más chica (15), aunque quepan en una página con el tamaño elegido (para poder volver a achicarlo).
- **R4.5** En el celular, la paginación DEBERÁ ajustarse al ancho (envuelve en dos filas) sin scroll horizontal.

## R5. Libro: detalle en su propia vista (punto 5)

- **R5.1** AL hacer clic en una rendición del libro, EL SISTEMA DEBERÁ **ocultar** las tarjetas, los filtros, la tabla y la paginación, y mostrar **solo el detalle** de esa rendición (sin scroll hasta abajo).
- **R5.2** El detalle DEBERÁ tener arriba un botón **"← Volver al libro"** que reemplaza al botón "Cerrar" actual.
- **R5.3** La vista de detalle DEBERÁ tener dirección propia **`/libro/<id>`**: el "atrás" del navegador o del celular vuelve a la tabla y la dirección se puede recargar o compartir (con los mismos permisos).
- **R5.4** AL volver, la tabla DEBERÁ conservar la búsqueda, el filtro, el orden, la página y el tamaño de página, y dejar a la vista (y marcada) la fila de la rendición que se abrió.
- **R5.5** Después de una acción que cambia la rendición (guardar, anular aprobación, eliminar, restaurar), EL SISTEMA DEBERÁ volver a la tabla con el mensaje de éxito arriba (como hoy).
- **R5.6** SI la rendición de la dirección no existe o salió del libro, ENTONCES vuelve a la tabla con el aviso "Esa rendición ya no está en el libro."
- **R5.7** Con cambios sin guardar en el detalle, "Volver" no pide confirmación (igual que hoy al cerrar); queda anotado como mejora posible.

## R6. Encabezados de tabla destacados (pedido 2026-10-29)

- **R6.1** Los encabezados (`thead`) de todas las tablas de la app DEBERÁN tener el fondo azul de los botones primarios y el texto en blanco.
- **R6.2** En modo oscuro DEBERÁN seguir al botón primario de ese tema (azul claro con texto oscuro), para mantener el contraste.
- **R6.3** En las tablas con separadores, las líneas verticales del encabezado van tenues en el color del texto; el ícono de orden y el texto del `ThOrden` toman el mismo color.
