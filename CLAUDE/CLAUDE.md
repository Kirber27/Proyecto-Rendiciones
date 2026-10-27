# Rendiciones Heca Chile: contexto completo para continuar el desarrollo

Este archivo es el punto de entrada. Cárgalo (con el resto de la carpeta) en tu sesión de Claude: en Claude Code déjalo en la raíz del repositorio; en un Proyecto de Claude súbelo como conocimiento del proyecto junto con `app/rendiciones-heca.html`.

## 1. Qué es

App web para las **rendiciones de gastos** de Heca Chile (formulario interno POE-GLO-FIN-003 "Rendición de gastos"). Reemplaza el flujo manual en que cada persona llenaba el formulario en papel y tesorería lo transcribía a un Excel.

Flujo:
1. La persona sube la foto del formulario firmado y de sus boletas/facturas.
2. La página lee las fotos sola (Claude, vía capacidad `sample`) y arma las líneas de gasto. La persona solo corrige si algo se leyó mal y envía.
3. **Solo el tesorero** aprueba e ingresa al libro (o devuelve con motivo, o rechaza).
4. Tesorería sube la cartola del banco; la página propone qué cargo paga qué rendición.
5. Cada persona tiene una carpeta con todos sus movimientos (enviada, aprobada, devuelta, eliminada, pagada).

Dueño y usuario principal: tesorería de Heca (cuenta `tesoreria@hecaglobal.com`, dueño del artifact). Idioma de la interfaz: español de Chile. Moneda: CLP, enteros, punto como separador de miles.

## 2. Dónde vive

| Pieza | Ubicación |
| --- | --- |
| App (artifact publicado) | https://claude.ai/artifact/Mo5xhEzkgjnqs8RfEJNNYe (versión 14 al 21-10-2026) |
| Código fuente actual | `app/rendiciones-heca.html` (un solo archivo, HTML + CSS + JS sin build) |
| Capacidades declaradas | `app/capabilities.json` |
| Base de datos | La base `db` del propio artifact (no hay backend externo) |
| Guía alternativa Microsoft 365 | Doc en Claude: https://claude.ai/code/artifact/cd664f01-bab5-4329-bff5-33ab658aaab3 |
| Excel maestro alternativa M365 | `microsoft365/Rendiciones_Heca_2026.xlsx` |

El artifact está compartido como "cualquiera con el link". Las reglas de la base (sección 4) protegen los datos: quien no tiene nivel Editor no lee el libro.

## 3. Stack y dependencias

- Página única que se publica con la herramienta **Artifact**. Se escribe sin `<html>/<head>/<body>`: la plataforma agrega el esqueleto. `<title>Rendiciones Heca Chile</title>`.
- Librerías por CDN (únicos hosts permitidos: cdnjs, jsdelivr, unpkg):
  - `xlsx` 0.18.5 (SheetJS): leer cartolas y generar el Excel de exportación.
  - `jspdf` 2.5.1: reporte PDF por rendición.
- Fuentes: IBM Plex Sans + IBM Plex Mono (Google Fonts). Tema claro/oscuro con tokens CSS en `:root`.
- Todo el acceso a la plataforma va por `window.claude.use(name)`: `db`, `user`, `sample`, `assets`, `downloads`. Cada uno puede resolver `null`; la página lo maneja.
- No se puede usar `alert/confirm/prompt`, `window.print`, ni descargar por `<a download>`; las confirmaciones son en línea y las descargas van por `downloads.save`.

## 4. Capacidades y reglas de acceso (`app/capabilities.json`)

```json
{"db":{"rules":[
  {"path":"","read":"admin","write":"admin"},
  {"path":"publico","read":"interact","write":"admin"},
  {"path":"envios","read":"admin","write":"admin"},
  {"path":"envios/{self}","read":"interact","write":"interact"},
  {"path":"estados","read":"admin","write":"admin"},
  {"path":"estados/{self}","read":"interact","write":"admin"}]},
 "user":{"scopes":["profile"]},
 "sample":{"images":true},
 "assets":{"upload":"interact"},
 "downloads":true}
```

Niveles de la plataforma: `interact` = Colaborador (solicitantes), `admin` = Editor u Owner (tesorero y administradores).

- Todo lo que no está listado (rendiciones, pagos, cartolas, config) solo lo leen y escriben Editores.
- Cada persona lee y escribe solo su documento `envios/<su id>`, y solo lee su `estados/<su id>` (lo escribe tesorería).
- `publico/personas` lo leen todos (lista de personas y sus funciones) y solo lo escriben Editores.
- El scope `email` de `user` **no está disponible** para esta cuenta (la publicación lo rechaza); los correos se escriben a mano en Perfiles.
- Al republicar: si se cambia `capabilities` hay que mandar el conjunto completo (lo que no se repite se revoca). Si se omite, se conserva lo guardado.

## 5. Modelo de datos (base `db` del artifact)

| Ruta | Quién escribe | Contenido |
| --- | --- | --- |
| `envios/<uid>` | la persona | `{items:{<eid>: Envio}}`: lo que cada persona envió. Se actualiza con merge anidado (`update({items:{[eid]:...}})`). |
| `estados/<uid>` | tesorería | `{items:{<eid>: Estado}, perfil:{nombre, correo}}`: decisión del tesorero por envío y vínculo cuenta→persona. |
| `rendiciones/<ID>` | tesorería | Libro oficial. ID = `CODIGO-NNN` (DHE-042). Historial 2026 + aprobadas desde la app. |
| `pagos/<id>` | tesorería | Pagos, anticipos, "No genera pago", devoluciones (monto negativo). Historial con ids H0001..H0174. |
| `cartolas/<id>` | tesorería | Una cartola subida: `{nombre, banco, creadoEn, movs:[{f,d,r,c,a,pago,ign}]}` (hasta 1.200 movimientos por documento). |
| `config/roles` | tesorería | Legado: `{tesorero:<uid>, roles:{uid:funcion}, correo}`. |
| `publico/personas` | tesorería | `{personas:{<nombre normalizado>: {nombre, codigo, correo, funcion, nueva, eliminada, eliminadaEn, creadoEn}}}`. |

Formas:

- **Línea de gasto**: `{fecha:'YYYY-MM-DD', tipo:'Factura'|'Boleta'|'Boleta de honorarios'|'Transferencia', proveedor, rut, numero, neto, iva, exento, otros, detalle, sub (subcuenta), cue (cuenta), cc}`. Total = neto + iva + exento + otros. En boletas, honorarios y transferencias el monto va en `exento`.
- **Envio**: `{solicitante, nro, fecha, empresa, fondo, totalForm, lineas[], fotos:[assetId], total, creadoEn, editadoEn}`.
- **Estado**: `{estado:'Aprobada'|'Observada'|'Rechazada'|'Anulada'|'Eliminada', rid, en, nota, pago, fechaPago, hist:[{e,en,nota}]}`. `hist` guarda cada movimiento (auditoría).
- **Rendición (libro)**: Envio limpio + `{origen:'App'|'Histórico', envio:{uid,eid}, aprobadoEn, aprobadoPor, exportada, obs}`.
- **Pago**: `{solicitante, fecha, banco, monto, tipo:'Pago'|'Anticipo'|'No genera pago'|'Devolución de la persona', rends:[ID], cartola, idx, desc, origen}`.
- Fotos: se suben con `assets.upload` y se guarda solo el id; se muestran como `/_blob/<id>`.

Nombres de personas, cuentas, subcuentas, C.C. y bancos se guardan **con la grafía exacta del Excel original** (algunos con espacio final, p. ej. `"David Herce "`) para que las exportaciones calcen con las tablas dinámicas del Excel existente. Para comparar siempre se usa `norm()` (sin tildes, minúsculas, espacios colapsados).

## 6. Funciones (roles)

- **Administrador**: el dueño del artifact siempre lo es. Ve todo y tiene la pestaña Perfiles.
- **Tesorero**: uno solo; si se asigna a otra persona, el anterior pasa a Solicitante. Ve Por aprobar, Rendiciones, Personas, Banco y Carpetas.
- **Solicitante**: por defecto. Solo Rendir gastos y Mis rendiciones (su carpeta).

La función se asigna a la **persona** (`publico/personas`), y la cuenta de Claude hereda la función de la persona con la que está vinculada (`estados/<uid>.perfil.nombre`). Lógica en `funcionDe(uid)`, `isTes()` e `isAdm()`. La función decide qué pestañas se ven; el acceso real a los datos lo da el nivel de compartir (el tesorero y los administradores deben ser **Editor**).

## 7. Pestañas

| Pestaña | Quién | Qué hace |
| --- | --- | --- |
| Rendir gastos | todos | Sube fotos → lectura automática al subir (sin botón, sin ingreso manual) → revisión/corrección → envío. Si la cuenta está vinculada, el solicitante queda fijo. |
| Mis rendiciones / Carpetas | todos | Solicitante: su carpeta. Tesorería: una carpeta por persona, con buscador. Cada rendición muestra su línea de tiempo. Filtros por casillas: En revisión, Observadas o rechazadas, Por pagar, Pagadas, Eliminadas. |
| Por aprobar | tesorería | Envíos sin decisión, reenviados tras observación, o con aprobación anulada. Aprobar crea `rendiciones/<ID>`. |
| Rendiciones | tesorería | Libro con filtros (abre en "Todas") y buscador. Columnas Total, Pagado, Por pagar, Estado. Detalle editable, **Descargar reporte PDF**, **Anular aprobación** (vuelve a Por aprobar), **Eliminar**. Exporta a Excel. |
| Personas | tesorería | Cuenta corriente por persona: rendido, pagado, saldo, Nº faltantes en el correlativo. Buscador por nombre. Registrar pago o anticipo manual. |
| Banco | tesorería | Carga de cartola (xlsx/csv) con mapeo de columnas, propuestas de conciliación, asignación manual (rendición, anticipo o "no es de rendiciones"). |
| Perfiles | administrador | CRUD de personas (historial + nuevas): código, correo, función, eliminar/restaurar. Sección plegable para vincular cuentas de Claude con personas. |

## 8. Reglas de negocio

- **ID de rendición**: código de la persona + Nº del formulario con 3 dígitos. Si ya existe, se agrega un sufijo aleatorio corto. Personas nuevas: el código se sugiere (inicial + 2 letras del apellido) y debe ser único (2 a 4 letras).
- **Estado de pago (FIFO)**: por persona, primero se aplican los pagos vinculados explícitamente a una rendición; lo que sobra (anticipos, pagos agrupados) se aplica a sus rendiciones desde la más antigua. Función `alloc()`. Saldo de la persona = rendido − pagado (positivo: la empresa le debe; negativo: pendiente por rendir).
- **Conciliación** (`proposals()`): para cada cargo sin asignar: (1) un pago ya registrado sin cartola con el mismo monto (±1) y fecha ±5 días; (2) una rendición con saldo igual al cargo y fecha del cargo ≥ fecha de rendición − 3 días, prefiriendo coincidencia de apellido en la glosa; (3) varias rendiciones de la misma persona cuyo saldo sumado iguala el cargo (subconjuntos de hasta 12). Las propuestas "solo por monto" quedan sin marcar por defecto.
- **Lectura de fotos** (`buildPrompt`, `prepImages`, `leer`):
  - Se envía cada foto completa y, si hay cupo de imágenes, recortes ampliados que se traslapan (4 cuadrantes o 2 mitades), para que se lean boletas chicas.
  - Se pide primero un inventario de documentos y luego las líneas. Si hay formulario, sus filas mandan y las boletas solo completan datos.
  - Se usa `modelTier:"complex"` y `sample.json` con `cache:false`.
  - La subcuenta se elige de la lista y la cuenta sale de `datos/subcuenta_a_cuenta.json`.
- **Exportación a Excel**: columnas idénticas a la hoja "Rendiciones" del Excel original: `Nombre Solicitante, Nro Rend., Fecha, Semana ("Del 05 al 09"), Mes (nombre en minúsculas), C.C., Cuenta, Detalle (=subcuenta), Concepto, Tipo Doc, Monto Neto, Monto Exento, Iva, Total, Pagado por, Fecha de Pago, Monto`. El pago va en la última línea de cada rendición. La opción "nuevas" marca `exportada:true`.
- **Reporte PDF** (jsPDF, carta): encabezado del formulario, datos de la empresa con RUT, tabla de gastos, totales, cuadre con el total del formulario, estado de pago, firmas (solicitante y V°B° Tesorería) y una página por cada foto de respaldo.

## 9. Historial 2026 (ya cargado en la base)

- Origen: `datos/original/Rendiciones_Chile_2026_version_1_1.xlsx`, hoja "Rendiciones" (tabla `Rendiciones`, B4:T660).
- Cargado: **182 rendiciones (45.024.174 CLP), 612 líneas, 174 pagos (45.045.931 CLP)**, con fechas del 01-01-2026 al 09-10-2026. Script: `scripts/preparar_historial.py`; lotes en `datos/historial_2026/`.
- Excluido: fila 635 (107.130 CLP sin nombre).
- Problemas detectados en el origen:
  - Faltan Nº en correlativos: David Herce 20, 21, 27, 28 y 36 a 41.
  - RDI-031 sin cuenta ("ojo revisarlo").
  - Una línea de AKO-008 con IVA sin neto.
  - 7 pagos sin fecha o con año 2025.
- Saldos por persona al cargar: Dailin Arellano −471.991, Raúl Díaz −17.220, Abel Kottwitz +202.214, Tomás Castro +188.980, Brigitte Moran +71.188, Pia Cotronea +5.072. El resto, al día.
- **No volver a cargar los lotes** sobre la base en uso: `set` sobrescribe y borraría ediciones posteriores.

## 10. Cómo seguir trabajando la app

1. Pide al dueño permiso de **Editor** en el artifact (menú Compartir).
2. En tu sesión de Claude: `Artifact` con `action:"read"` y la URL del artifact → guarda la página local → edita → publica con `url` = la URL del artifact (mantiene el link y los datos). Para cambios chicos sirve publicar con `edits` (old_str/new_str).
3. Datos: herramienta `ArtifactData` con la misma URL (`list`, `get`, `update`, `batch`; toda escritura a un documento existente requiere `if_version`).
4. Antes de publicar, revisa la sintaxis: extrae el `<script>` principal y corre `node --check`.
5. Si cambias reglas o scopes, republica `capabilities` completo (ver sección 4).

## 11. Limitaciones conocidas y decisiones

- Cada usuario necesita **cuenta de Claude en la organización Heca**. Sin ella abre el link, pero no puede guardar ni leer fotos (la lectura consume el uso de Claude de quien la hace). Si se abre desde WhatsApp, el navegador interno no tiene sesión: hay que tocar "Iniciar sesión" o abrir en Safari/Chrome.
- Si Heca deja Claude, se pierde el acceso a la app y a su base. Mitigación: exportar el Excel periódicamente. La alternativa sin Claude está diseñada para Microsoft 365 (Heca usa M365): Forms + Power Automate + AI Builder + Excel en SharePoint. Ver la guía y `microsoft365/Rendiciones_Heca_2026.xlsx` (tablas tblRendiciones, tblDetalle, tblPagos, tblBanco, tblPersonas, tblSubcuentas; columnas calculadas con referencias estructuradas; FIFO por fórmula). Ese Excel se genera con `scripts/build_m365.py` (lee `lists.json`, `codes.json` y `datos/historial_2026`).
- La página no puede enviar correos ni notificaciones; la persona ve su estado en su carpeta.
- No se probaron en un dispositivo real, desde esta sesión: la lectura de una foto, el PDF ni la descarga del Excel. Probar con `datos/original/ejemplo_formulario_DHE-042.jpg` (rendición Nº 42 de David Herce, ISP, boleta 2026101400444231, $70.389, "CDA IMP ADEOR 07").
- Las PDFs de boletas no se leen: hay que subir un pantallazo.

## 12. Historial de pedidos del usuario (en orden)

1. Estructurar el Excel de rendiciones para cargar desde foto y cruzar con el banco. Se hizo un Excel v2, y el usuario lo descartó por seguir siendo manual.
2. Automatizar: la persona sube la foto y se carga sola. Se hizo esta app.
3. Solo el tesorero aprueba e ingresa; historial dentro de la app; PDF por rendición para archivo físico; pestaña por persona (pagado, pendiente, por rendir); lectura sin depender de Claude-chat y sin ingreso manual.
4. Botón para eliminar o anular una aprobación; definir quién es tesorero; leer varias boletas en una misma foto.
5. Preocupación por depender de Claude: se diseñó la alternativa Microsoft 365 (guía + Excel).
6. Ajustes: el link desde WhatsApp no tenía sesión; buscador en Personas; el libro abre en "Todas"; columna "Por pagar"; correo del tesorero; Perfiles como gestor (CRUD) de personas con funciones, personas nuevas y botón eliminar; se quitó la columna "Cuenta de Claude"; carpetas por persona con movimientos; filtros por casillas en las carpetas.

## 13. Archivos de este paquete

```
CLAUDE.md                        este documento
app/rendiciones-heca.html        código fuente actual de la app (publicar tal cual)
app/capabilities.json            capacidades y reglas de acceso
datos/lists.json                 listas maestras del Excel original (grafía exacta)
datos/codes.json                 código de 3 letras por persona del historial
datos/subcuenta_a_cuenta.json    cuenta sugerida por subcuenta
datos/historial_2026/b00..b07    lotes cargados en la base (rendiciones + pagos)
datos/original/                  Excel original v1.1 y foto de ejemplo del formulario
scripts/preparar_historial.py    Excel original -> lotes de historial
scripts/build_m365.py            genera el Excel maestro de la alternativa Microsoft 365
microsoft365/Rendiciones_Heca_2026.xlsx   Excel maestro para SharePoint, con historial
```

El paquete contiene datos financieros y nombres de personas de Heca: trátalo como información interna.
