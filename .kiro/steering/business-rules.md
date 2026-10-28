# Reglas de negocio

Portadas del prototipo (`CLAUDE/app/rendiciones-heca.html`). Entre paréntesis, la función original de referencia. Todas se implementan como funciones puras en `src/domain/` con tests.

## Normalización y grafía exacta (`norm`, `tr`, `raw`)

- Nombres de personas, cuentas, subcuentas, C.C. y bancos se guardan **con la grafía exacta del Excel original**, incluidos espacios finales (`"David Herce "`, `"Bencina"`, `"Otros  "`). Así la exportación calza con las tablas dinámicas existentes.
- Para mostrar se usa `tr()` (espacios colapsados y recortados).
- Para comparar se usa `norm()`: sin tildes (NFD), minúsculas, espacios colapsados, `trim`.
- `raw(lista, valor)`: devuelve el elemento de la lista cuyo `norm` coincide, o `null`.

## Montos (`num`, `clp`)

- `num()` acepta números o texto chileno: `"70.389"` → 70389; `"1.234,50"` → 1234.5; vacío → 0.
- `clp(n)` → `"$ 70.389"` (redondeado, `toLocaleString("es-CL")`, signo `-` delante si es negativo).
- **Total de línea** = neto + iva + exento + otros. `otros` es el **impuesto especial** (columna "Imp. especial", opcional, después de Exento / monto). En el Excel y el PDF va sumado a "Monto Exento", como en el prototipo.
- En **Boleta, Boleta de honorarios y Transferencia** el monto va en `exento`; neto e iva = 0. En **Factura** neto e iva por separado y exento solo si la factura lo muestra.
- **IVA calculado** (spec 11): en Factura, `iva = round(neto × 0,19)` (`ivaDe`, `TASA_IVA`); no se escribe (campo de solo lectura). Se recalcula al cambiar el neto o el tipo; en los otros tipos queda en 0. Una línea guardada conserva su IVA mientras no se toquen su neto ni su tipo (el historial puede traer otro redondeo). El servidor no lo recalcula.
- **Cuadre**: si hay total del formulario, la suma de líneas debe coincidir con tolerancia de ±1 peso.

## Fechas (`parseDate`, `fdate`, `semana`)

- `parseDate` acepta `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YY`, `Date` y número serial de Excel.
- `semana(fecha)` → `"Del 05 al 09"` (lunes a viernes de esa semana).
- Mes en nombre minúsculas: `enero … diciembre`.

## Folio de rendición (`rid`, `codeOf`)

- **Nº de rendición = correlativo por persona** (spec 11): mayor Nº de la persona (en cualquier estado, incluido el historial) + 1. No se escribe: el formulario lo muestra al elegir el solicitante (`siguiente_nro`) y el servidor lo asigna al enviar una nueva. Se conserva en reenvíos, aprobación y edición; si tesorería cambia la persona, toma el siguiente de la nueva persona.
- Folio = **código de la persona + "-" + Nº del formulario con 3 dígitos**: `DHE-042`.
- Si el folio ya existe, se agrega un sufijo corto aleatorio (`DHE-042-x7`). Se asigna **al aprobar**.
- Código de persona: el de `personas.codigo`; si no, el de `CLAUDE/datos/codes.json`; si no, primeras 3 letras del nombre normalizado.
- Personas nuevas: código sugerido = inicial del nombre + 2 primeras letras del apellido, en mayúsculas. Debe ser **único** y de **2 a 4 letras** (`^[A-Z]{2,4}$`).

## Validación de envío (`validate`)

- Solicitante elegido de la lista de personas activas.
- Fecha obligatoria (el Nº no se valida: lo asigna el servidor).
- Cada línea con monto > 0.
- En Rendir gastos, cada línea con **proveedor elegido de la lista** (el RUT sale del proveedor, no se escribe); lo exige también `enviar_rendicion` (proveedor activo). Por aprobar y el libro no lo exigen (el historial no trae proveedor).
- Tesorería (al aprobar o editar en el libro) además exige **subcuenta y cuenta** en cada línea.
- **Nº de documento único por proveedor** (spec 11): no se repite la combinación RUT del proveedor + tipo + Nº (sin importar mayúsculas ni espacios) en rendiciones no eliminadas ni rechazadas, ni dos veces en el mismo formulario. Mientras se escribe, la app consulta `documento_repetido` y deja el campo en rojo con el aviso; al guardar lo revisa la base. Las líneas sin Nº o sin RUT no se comparan, y lo que una rendición ya tenía guardado no se vuelve a revisar (el historial puede traer repetidos).
- Si hay total del formulario, debe cuadrar (±1).
- **Al menos un respaldo** (foto o PDF) al enviar desde Rendir gastos; en un reenvío cuentan los ya guardados. Lo exige también la RPC `enviar_rendicion`. Al aprobar o editar en el libro no se exige (el historial no tiene respaldos).
- Al elegir subcuenta, la cuenta se sugiere con `subcuenta_a_cuenta` (editable por tesorería).
- **Nueva subcuenta** (spec 11): tesorería la agrega desde el selector de la línea ("+ Nueva subcuenta…": nombre + cuenta sugerida opcional, RPC `crear_subcuenta`). No se permite otra con el mismo nombre normalizado (`norm`); si existe, se ofrece usarla. Queda al final de la lista para todos.
- El C.C. por defecto de cada línea es el de la empresa elegida.
- Formulario nuevo: fecha de hoy, empresa *Hecaglobal Instruments SPA*, una línea vacía. Si el usuario está vinculado a una persona y no es tesorería, el solicitante queda **fijo** en su persona.

## Estados de una rendición

```
                ┌──────────── reenviar ────────────┐
                ▼                                  │
 enviar → En revisión ── aprobar ──► Aprobada ──┐  │
                │  │                     │      │  │
                │  └── observar ──► Observada ──┘  │
                │                                  │
                └── rechazar ──► Rechazada         │
 Aprobada ── anular aprobación ──► En revisión (marcada "Aprobación anulada")
 cualquier estado ── eliminar (tesorería) ──► Eliminada
```

- **Por aprobar** = En revisión (nueva, reenviada o con aprobación anulada).
- Una Observada solo la puede corregir y reenviar la persona dueña.
- Cada transición agrega un evento a la línea de tiempo (`rendicion_eventos`): auditoría completa, nunca se borra.
- La rendición del libro conserva `origen`: `App` o `Histórico`.

## Estado de pago (FIFO) (`alloc`)

Por persona:

1. Se ordenan sus rendiciones aprobadas por fecha (y Nº) y sus pagos por fecha.
2. Primero se aplican los pagos **vinculados explícitamente** a una rendición (hasta cubrir su total).
3. Lo que sobra (anticipos, pagos agrupados, sobrantes) entra a un **pozo** que se aplica a las rendiciones pendientes **desde la más antigua**.
4. Estado por rendición: `Sin monto` (total ≤ 0,5) · `Pagada` (pagado ≥ total − 1) · `Pago parcial` · `Pendiente de pago`. Se guarda también la fecha del último pago. Mejora sobre el prototipo: si una rendición se pagó solo con el pozo (el prototipo dejaba la fecha vacía), se usa la fecha del último pago que alimentó el pozo (aproximación; nunca cambia una fecha ya conocida).
5. Por persona: **rendido**, **pagado** (suma de todos sus pagos, incluidas devoluciones negativas), **saldo = rendido − pagado** (positivo: la empresa le debe; negativo: pendiente por rendir), anticipos, Nº máximo y **faltantes del correlativo** (números de 1..máx que no existen).

Tipos de pago: `Pago`, `Anticipo`, `No genera pago`, `Devolución de la persona` (monto negativo).

## Conciliación bancaria (`proposals`)

Para cada **cargo** de cartola sin asignar ni ignorar, en orden de fecha:

1. **Pago ya registrado sin cartola** con mismo monto (±1) y fecha ±5 días. Si hay varios, se prefiere el que tenga coincidencia de nombre en la glosa. → confianza "Pago ya registrado · nombre/monto".
2. **Una rendición** con saldo igual al cargo (±1) y fecha del cargo ≥ fecha de rendición − 3 días. Si hay varias, la que tenga coincidencia de apellido en la glosa ("Monto y nombre"); si es única por monto, "Solo monto".
3. **Varias rendiciones de la misma persona** (con nombre en la glosa) cuyo saldo sumado iguala el cargo (tolerancia ±1 por rendición), buscando subconjuntos de hasta 12 rendiciones.

- Coincidencia de nombre (`nameHit`): cantidad de palabras de ≥4 letras del nombre normalizado que aparecen en la glosa normalizada.
- Una rendición o pago usado en una propuesta no se reutiliza en otra.
- Las propuestas **"Solo monto" quedan sin marcar** por defecto; el resto marcadas.
- Asignación manual de un cargo: a una rendición, como anticipo de una persona, o "no es de rendiciones" (ignorar).

## Cartola (`leerCartola`, `buildMovs`)

- Acepta `.xlsx`, `.xls`, `.csv`. Fila de encabezados = primera fila que contenga "fecha".
- Columnas a mapear: Fecha, Descripción, Cargo, Abono, Monto (si viene en una sola columna: negativo = cargo), Nº operación. Se adivinan por regex y se pueden corregir.
- Se descartan filas sin fecha o sin monto. Glosa recortada a 140 caracteres.

## Proveedores y RUT (spec 11)

- Registro de proveedores (nombre + RUT). Cualquier usuario agrega; tesorería edita, elimina/restaura e importa Excel.
- RUT: se acepta escrito de cualquier forma, se valida el dígito verificador (módulo 11) y se guarda normalizado `12345678-5`; se muestra `12.345.678-5` (`src/domain/rut.ts`). Único: un RUT = un proveedor.
- Las líneas guardan nombre y RUT tal como se rindieron, más el vínculo `proveedor_id`; editar un proveedor no cambia lo ya rendido. Al volver a guardar una línea con `proveedor_id` (reenvío, aprobación, edición), el servidor copia el nombre y RUT actuales del registro.
- En el formulario, el proveedor se elige con un buscador (nombre o RUT); "¿No está? Agrégalo" lo crea en un modal sin salir del formulario. Las líneas antiguas muestran su texto con "(sin registrar)".

## Respaldos adjuntos

- Se aceptan **imágenes** (JPG, PNG, WebP; HEIC si el navegador lo convierte) y **PDF**. Otros archivos se descartan con aviso.
- Las fotos se reducen en el navegador a lado máximo 2400 px, JPEG 0,85, antes de subirlas. Los PDF se suben tal cual; máximo **10 MB** por archivo (límite del bucket).
- Ruta en Storage: `<persona_id>/<rendicion_id>/<uuid>.jpg` o `.pdf`. El tipo (`mime`) se deduce de la extensión.
- Los respaldos ya enviados no se quitan desde la app (son respaldo contable); solo tesorería puede borrar en Storage.
- No hay lectura automática: la lectura con IA se eliminó el 2026-10-26 (costo por imagen).

## Exportación a Excel (`exportar`)

Columnas idénticas a la hoja "Rendiciones" del Excel original (con sus espacios finales):

`Nombre Solicitante | Nro Rend. | Fecha  | Semana | Mes | C.C. | Cuenta  | Detalle | Concepto  | Tipo Doc | Monto Neto  | Monto Exento  | Iva | Total  | Pagado por  | Fecha de Pago  | Monto `

- Una fila por línea. `Detalle` = subcuenta. `Concepto` = detalle · proveedor · "Doc Nº".
- En no-facturas todo el monto va a "Monto Exento".
- El pago (banco, fecha del último pago, suma de pagos vinculados) va **solo en la última línea** de cada rendición. "Último pago" = el de fecha más reciente (el prototipo tomaba el último en orden de carga).
- Fechas con formato `dd-mm-yyyy`, montos `#,##0`. Opción "solo nuevas" marca `exportada = true`.
- **Excel (búsqueda)** (spec 11): exporta las aprobadas que muestra la tabla con la búsqueda y el filtro actuales (todas las páginas), mismo formato, sin marcarlas como exportadas. Archivo `Rendiciones_busqueda_<YYYY-MM-DD>.xlsx`. Se habilita solo con búsqueda o filtro y alguna aprobada en la tabla.
- Las tarjetas del libro (Rendiciones, Total rendido, Pendiente de pago, Sin exportar) se calculan sobre lo que muestra la tabla cuando hay búsqueda o filtro; sin ellos, sobre todo el libro.

## Reporte PDF (`reportePDF`)

Carta, una por rendición: encabezado del formulario (heca · POE-GLO-FIN-003 V:01 · RENDICIÓN DE GASTOS), fondo, datos (fecha, empresa + RUT, Nº, solicitante, folio), tabla de gastos, totales (facturas, boletas/otros, transferencias, TOTAL, total del formulario, pagado, saldo), estado de pago y pagos vinculados, aprobación, firmas (solicitante y V°B° Tesorería), **una página por foto de respaldo y por cada página de los respaldos PDF** (en el orden de los respaldos; si un PDF no se puede leer, una página con el aviso) y numeración "Página i de n". Nombre: `Rendicion_<folio>_<Nombre_Apellido>.pdf`.

## Funciones (roles)

- Hay **un solo Tesorero**. Asignar Tesorero a otra persona deja al anterior como Solicitante.
- El Administrador inicial se define por seed/SQL.
- La función se asigna a la **persona**; la cuenta de usuario la hereda por su vínculo `personas.user_id`.
- Personas eliminadas: se marcan (`eliminada_en`), no se borran; desaparecen de las listas y se pueden restaurar.

## Cuentas y contraseñas (spec 10)

- Se ingresa con correo y contraseña. **La app no envía correos.**
- Solo el administrador crea cuentas (persona activa con correo registrado y sin cuenta) y asigna contraseñas nuevas. La contraseña temporal se muestra una sola vez: 12 caracteres sin letras o números que se confundan (`K7QM-4XPR-2HTW`).
- Con contraseña temporal, la persona debe elegir una nueva antes de usar la app.
- Contraseña: al menos 8 caracteres, distinta de la actual. Cambiarla por voluntad propia pide la actual.
- "¿Olvidaste tu contraseña?" = el administrador asigna una temporal nueva. Si el único administrador la olvida: `npm run cuenta:clave` con la clave secreta en la terminal.
