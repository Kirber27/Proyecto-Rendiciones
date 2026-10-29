# 11 · Ajustes del cliente — Requisitos

Cambios pedidos por el cliente tras la puesta en producción (2026-10-27). Afectan el formulario de rendición (`RendicionEditor`: Rendir gastos, Por aprobar y edición en el libro), una vista nueva de **Proveedores** y la pestaña **Rendiciones** (libro).

Decisiones tomadas con el usuario (2026-10-27):

- El Nº doc. es único **por proveedor**: misma combinación RUT del proveedor + tipo de documento + Nº.
- Proveedores: **cualquier usuario crea**; editar, eliminar e importar Excel solo tesorería.
- Nueva subcuenta: **solo tesorería**.
- La lista de proveedores se **precarga desde el historial** (líneas ya cargadas con RUT válido).

## R1. Nº de rendición correlativo (punto 1)

- **R1.1** CUANDO se elija el solicitante en un formulario nuevo, EL SISTEMA DEBERÁ mostrar en "Nº rendición" el **mayor Nº de esa persona + 1** (1 si no tiene rendiciones).
- **R1.2** El campo "Nº rendición" DEBERÁ ser de solo lectura en todas las vistas del formulario.
- **R1.3** El mayor Nº DEBERÁ considerar todas las rendiciones de la persona, en cualquier estado (incluidas eliminadas, rechazadas e historial), para no reutilizar números.
- **R1.4** AL enviar una rendición nueva, EL SISTEMA DEBERÁ asignar el Nº en el servidor (mayor + 1 en ese momento), de modo que dos envíos simultáneos no queden con el mismo Nº. Si difiere del mostrado, el aviso de éxito indica el Nº asignado.
- **R1.5** En un reenvío (observada → en revisión), la aprobación y la edición en el libro, el Nº se conserva.
- **R1.6** MIENTRAS no haya solicitante elegido, el campo DEBERÁ mostrarse vacío con el texto "Elige el solicitante".

### R1b. Nº faltantes del correlativo (pedido 2026-10-29)

El historial cargado tiene huecos (p. ej. una persona con 1, 2, 3, 5 y 6, sin el 4). Para poder cargar esas rendiciones en esta etapa de inicio:

- **R1.7** CUANDO se elija el solicitante, SI la persona tiene **Nº faltantes** (números de 1 al mayor que no existen en ninguna de sus rendiciones, en cualquier estado), EL SISTEMA DEBERÁ avisarlos bajo el campo ("Faltan en el correlativo: 4") y permitir elegir uno de ellos en "Nº rendición".
- **R1.8** Por defecto el Nº sigue siendo el correlativo (R1.1 en una nueva, R1.5 en una guardada); elegir un faltante es opcional. El campo sigue sin escribirse a mano: solo se elige entre el Nº por defecto y los faltantes.
- **R1.9** El servidor DEBERÁ aceptar el Nº elegido solo si en ese momento es un faltante de la persona (con el mismo bloqueo por persona de R1.4); si ya no lo es, rechaza con "El Nº X ya no está libre para esta persona. Elige otro o deja el siguiente." Aplica al enviar, reenviar, aprobar y editar en el libro.
- **R1.10** Puede elegir un faltante quien puede guardar la rendición: la persona dueña (la suya) y tesorería (cualquiera).

## R2. Proveedores (puntos 2 y 3)

### Vista Proveedores

- **R2.1** EL SISTEMA DEBERÁ tener una pestaña **Proveedores**, visible para todos, con la lista de proveedores (nombre y RUT), buscador por nombre o RUT y contador.
- **R2.2** Cualquier usuario DEBERÁ poder **agregar** un proveedor con **nombre** y **RUT** (ambos obligatorios).
- **R2.3** EL SISTEMA DEBERÁ validar el RUT (formato y dígito verificador, módulo 11) y guardarlo normalizado (`12345678-9`, sin puntos, DV en mayúscula). SI el RUT ya existe, ENTONCES DEBERÁ mostrar "Ese RUT ya está registrado como «<nombre>»." (si está eliminado, agrega que tesorería puede restaurarlo)
- **R2.4** Solo tesorería DEBERÁ poder **editar** el nombre o RUT y **eliminar** (soft delete) o restaurar un proveedor. Editar un proveedor no cambia las líneas ya guardadas (conservan el nombre y RUT con que se rindieron).
- **R2.5** Solo tesorería DEBERÁ poder **importar un Excel** (`.xlsx`, `.xls`, `.csv`) con la lista de proveedores:
  - Detecta las columnas de nombre (Nombre / Razón social / Proveedor) y RUT; se pueden corregir.
  - Muestra una vista previa antes de confirmar: **nuevos**, **ya existentes** (mismo RUT; se informa si el nombre difiere) y **con error** (RUT inválido o vacío, nombre vacío, RUT repetido dentro del archivo).
  - Al confirmar, inserta solo los nuevos (no pisa los existentes) y muestra el resumen.
- **R2.6** La lista DEBERÁ precargarse una vez desde las líneas existentes que tengan RUT válido (un proveedor por RUT, con el nombre más usado), y esas líneas quedan vinculadas a su proveedor.

### Proveedor y RUT en Gastos

- **R2.7** En cada línea de gasto, "Proveedor" DEBERÁ ser un **selector con búsqueda** (por nombre o RUT) de los proveedores activos.
- **R2.8** CUANDO se elija un proveedor, EL SISTEMA DEBERÁ completar el **RUT** automáticamente. El RUT es de solo lectura.
- **R2.9** SI el proveedor no está en la lista, ENTONCES EL SISTEMA DEBERÁ ofrecer "¿No está? Agrégalo en Proveedores", que permite crearlo sin perder el formulario y deja la línea con el proveedor recién creado.
- **R2.10** Para enviar, cada línea DEBERÁ tener proveedor elegido de la lista ("Línea N: elige el proveedor.").
- **R2.11** Las líneas guardadas antes de este cambio (historial o sin proveedor registrado) DEBERÁN seguir mostrando su nombre y RUT de texto; al editarlas en el libro no se exige proveedor de la lista mientras no se cambie.

## R3. Nº doc. único (punto 4)

- **R3.1** "Nº doc." se ingresa por pantalla.
- **R3.2** SI ya existe una línea con el mismo **RUT de proveedor + tipo de documento + Nº doc.** en otra rendición no eliminada ni rechazada, ENTONCES EL SISTEMA DEBERÁ marcar el campo en rojo (`is-invalid`) con el texto "Este Nº de documento ya está cargado para este proveedor." y no permitir enviar, aprobar ni guardar.
- **R3.3** La misma regla aplica dentro del propio formulario (dos líneas con el mismo proveedor, tipo y Nº).
- **R3.4** La comprobación DEBERÁ hacerse contra **todos** los datos del sistema, aunque el solicitante no pueda ver las rendiciones de otras personas (la respuesta solo dice si existe, sin datos de la otra rendición).
- **R3.5** La comprobación DEBERÁ repetirse en el servidor al enviar, aprobar y editar (las RPC rechazan con el mismo mensaje y el Nº de línea).
- **R3.6** Las líneas sin Nº doc. no se comparan. Los duplicados que ya existan en el historial no bloquean la edición de esas mismas líneas mientras no se cambie su proveedor, tipo o Nº.

## R4. IVA calculado (punto 5)

- **R4.1** En una **Factura**, el IVA DEBERÁ calcularse como `round(neto × 0,19)` y mostrarse de solo lectura; se actualiza al cambiar el neto.
- **R4.2** En Boleta, Boleta de honorarios y Transferencia el IVA DEBERÁ ser 0 (como hoy, todo el monto va en Exento / monto).
- **R4.3** Las líneas guardadas antes del cambio conservan su IVA hasta que se edite su neto o su tipo.

## R5. Impuesto especial (punto 6)

- **R5.1** EL SISTEMA DEBERÁ agregar la columna **"Imp. especial"** después de "Exento / monto", en la tabla y en la tarjeta del celular.
- **R5.2** Es opcional (vacío = 0), se ingresa por pantalla y **suma al total** de la línea.
- **R5.3** Se guarda en la columna existente `rendicion_lineas.otros` (ya sumada en el total por el trigger). El Excel y el PDF siguen igual: el impuesto especial va dentro de "Monto Exento", como en el prototipo.

## R6. Nueva subcuenta (punto 7)

- **R6.1** MIENTRAS el usuario sea tesorería, el selector de subcuenta DEBERÁ ofrecer al final "+ Nueva subcuenta…".
- **R6.2** CUANDO se elija, EL SISTEMA DEBERÁ pedir el **nombre** y, opcionalmente, la **cuenta sugerida**, en línea o en un modal, sin perder el formulario.
- **R6.3** SI ya existe una subcuenta con el mismo nombre normalizado (`norm`), ENTONCES DEBERÁ avisarlo y elegir la existente.
- **R6.4** Al crearla, la línea queda con la nueva subcuenta (y su cuenta, si se indicó) y aparece en los catálogos de todos.
- **R6.5** El solicitante no ve la opción.

## R7. KPIs del libro según la búsqueda (punto 8)

- **R7.1** CUANDO haya búsqueda o filtro activo en Rendiciones, las tarjetas **Rendiciones**, **Total rendido**, **Pendiente de pago** y **Sin exportar a Excel** DEBERÁN calcularse sobre las filas que muestra la tabla (todas las páginas), no sobre el libro completo.
- **R7.2** Sin búsqueda ni filtro, muestran lo mismo que hoy.
- **R7.3** MIENTRAS haya búsqueda o filtro, EL SISTEMA DEBERÁ indicarlo junto a las tarjetas ("Según la búsqueda").

## R8. Excel de la búsqueda (punto 9)

- **R8.1** EL SISTEMA DEBERÁ agregar el botón **"Excel (búsqueda)"** junto a "Excel (nuevas)" y "Excel (todas)".
- **R8.2** Exporta las rendiciones aprobadas que muestra la tabla con la búsqueda y el filtro actuales (todas las páginas), con el mismo formato de la hoja "Rendiciones".
- **R8.3** NO DEBERÁ marcarlas como exportadas.
- **R8.4** Se deshabilita si no hay búsqueda ni filtro activo, o si el resultado no tiene rendiciones aprobadas.
- **R8.5** Nombre del archivo: `Rendiciones_busqueda_<YYYY-MM-DD>.xlsx`.
