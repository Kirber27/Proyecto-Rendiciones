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
- **Total de línea** = neto + iva + exento + otros.
- En **Boleta, Boleta de honorarios y Transferencia** el monto va en `exento`; neto e iva = 0. En **Factura** neto e iva por separado y exento solo si la factura lo muestra.
- **Cuadre**: si hay total del formulario, la suma de líneas debe coincidir con tolerancia de ±1 peso.

## Fechas (`parseDate`, `fdate`, `semana`)

- `parseDate` acepta `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YY`, `Date` y número serial de Excel.
- `semana(fecha)` → `"Del 05 al 09"` (lunes a viernes de esa semana).
- Mes en nombre minúsculas: `enero … diciembre`.

## Folio de rendición (`rid`, `codeOf`)

- Folio = **código de la persona + "-" + Nº del formulario con 3 dígitos**: `DHE-042`.
- Si el folio ya existe, se agrega un sufijo corto aleatorio (`DHE-042-x7`). Se asigna **al aprobar**.
- Código de persona: el de `personas.codigo`; si no, el de `CLAUDE/datos/codes.json`; si no, primeras 3 letras del nombre normalizado.
- Personas nuevas: código sugerido = inicial del nombre + 2 primeras letras del apellido, en mayúsculas. Debe ser **único** y de **2 a 4 letras** (`^[A-Z]{2,4}$`).

## Validación de envío (`validate`)

- Solicitante elegido de la lista de personas activas.
- Nº de rendición y fecha obligatorios.
- Cada línea con monto > 0.
- Tesorería (al aprobar o editar en el libro) además exige **subcuenta y cuenta** en cada línea.
- Si hay total del formulario, debe cuadrar (±1).
- Al elegir subcuenta, la cuenta se sugiere con `subcuenta_a_cuenta` (editable por tesorería).
- El C.C. por defecto de cada línea es el de la empresa elegida.

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

## Lectura con IA (`buildPrompt`, `prepImages`, `leer`)

- Se envía cada foto completa y, si el cupo de imágenes lo permite, recortes ampliados que se traslapan: 4 cuadrantes (55% c/u) si caben 5 imágenes por foto, o 2 mitades si caben 3. Lado máximo 2400 px, JPEG 0,9. Se informa al modelo qué es cada imagen.
- Se pide primero un **inventario de documentos** y luego las líneas. Si hay formulario, **sus filas mandan** y las boletas solo completan datos; documentos que no están en el formulario se agregan avisando en `dudas`.
- El modelo elige subcuenta, solicitante y empresa **de las listas** (texto exacto).
- Respuesta JSON: `{documentos[], solicitante, nro, fecha, empresa, fondo, totalFormulario, lineas[], dudas[]}`. Se valida con zod; si no es JSON válido → error "No se pudieron ordenar los datos…".
- Si el usuario está vinculado a una persona y no es tesorería, el solicitante queda **fijo** en su persona.
- Empresa no reconocida → por defecto *Hecaglobal Instruments SPA*.
- Mensajes de error en español para: cancelado, límite de uso alcanzado, imagen rechazada, JSON inválido, error genérico.

## Exportación a Excel (`exportar`)

Columnas idénticas a la hoja "Rendiciones" del Excel original (con sus espacios finales):

`Nombre Solicitante | Nro Rend. | Fecha  | Semana | Mes | C.C. | Cuenta  | Detalle | Concepto  | Tipo Doc | Monto Neto  | Monto Exento  | Iva | Total  | Pagado por  | Fecha de Pago  | Monto `

- Una fila por línea. `Detalle` = subcuenta. `Concepto` = detalle · proveedor · "Doc Nº".
- En no-facturas todo el monto va a "Monto Exento".
- El pago (banco, fecha del último pago, suma de pagos vinculados) va **solo en la última línea** de cada rendición. "Último pago" = el de fecha más reciente (el prototipo tomaba el último en orden de carga).
- Fechas con formato `dd-mm-yyyy`, montos `#,##0`. Opción "solo nuevas" marca `exportada = true`.

## Reporte PDF (`reportePDF`)

Carta, una por rendición: encabezado del formulario (heca · POE-GLO-FIN-003 V:01 · RENDICIÓN DE GASTOS), fondo, datos (fecha, empresa + RUT, Nº, solicitante, folio), tabla de gastos, totales (facturas, boletas/otros, transferencias, TOTAL, total del formulario, pagado, saldo), estado de pago y pagos vinculados, aprobación, firmas (solicitante y V°B° Tesorería), **una página por foto de respaldo** y numeración "Página i de n". Nombre: `Rendicion_<folio>_<Nombre_Apellido>.pdf`.

## Funciones (roles)

- Hay **un solo Tesorero**. Asignar Tesorero a otra persona deja al anterior como Solicitante.
- El Administrador inicial se define por seed/SQL.
- La función se asigna a la **persona**; la cuenta de usuario la hereda por su vínculo `personas.user_id`.
- Personas eliminadas: se marcan (`eliminada_en`), no se borran; desaparecen de las listas y se pueden restaurar.
