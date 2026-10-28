# Producto: Rendiciones Heca Chile

## Qué es

App web para las **rendiciones de gastos** de Heca Chile (formulario interno **POE-GLO-FIN-003 "Rendición de gastos"**). Reemplaza el flujo manual en que cada persona llenaba el formulario en papel y tesorería lo transcribía a un Excel.

Esta versión reemplaza al prototipo que vivía como artifact de Claude (`CLAUDE/app/rendiciones-heca.html`). El prototipo es la **referencia funcional y de diseño**: si una regla no está en estos documentos, se mira cómo lo hace el prototipo.

## Usuarios y funciones

| Función | Quién | Qué puede hacer |
| --- | --- | --- |
| Solicitante | Cualquier trabajador (por defecto) | Rendir gastos y ver su carpeta (Mis rendiciones). |
| Tesorero | Una sola persona | Aprobar / observar / rechazar, libro de rendiciones, personas y pagos, banco y conciliación, carpetas de todos. |
| Administrador | Dueño(s) del sistema | Todo lo del tesorero + Perfiles (CRUD de personas, funciones, cuentas y contraseñas, vínculo cuenta→persona). |

"Tesorería" = Tesorero o Administrador.

## Flujo principal

1. La persona completa en la app el formulario de rendición (datos y una línea por boleta/factura), desde el celular normalmente.
2. Adjunta como respaldo la foto del formulario firmado y de sus boletas/facturas (imágenes o PDF; al menos uno) y envía.
3. **Solo tesorería** aprueba e ingresa al libro (o devuelve con motivo = Observada, o rechaza).
4. Tesorería sube la cartola del banco; la app propone qué cargo paga qué rendición.
5. Cada persona tiene una carpeta con todos sus movimientos (enviada, aprobada, observada, eliminada, pagada…).

## Pantallas

| Pantalla | Quién | Resumen |
| --- | --- | --- |
| Rendir gastos | todos | Formulario (datos + gastos) → adjuntar respaldos (fotos o PDF) → envío. |
| Mis rendiciones / Carpetas | todos | Solicitante: su carpeta. Tesorería: una carpeta por persona, con buscador y filtros. Línea de tiempo por rendición. |
| Por aprobar | tesorería | Envíos sin decisión, reenviados tras observación o con aprobación anulada. |
| Rendiciones (libro) | tesorería | Libro oficial con filtros, edición, PDF, anular aprobación, eliminar, exportar a Excel. |
| Personas | tesorería | Cuenta corriente por persona (rendido, pagado, saldo, faltantes del correlativo). Pagos/anticipos manuales. |
| Banco | tesorería | Carga de cartola, mapeo de columnas, propuestas de conciliación, asignación manual. |
| Perfiles | administrador | CRUD de personas, funciones, código, correo, cuentas (crear, nueva contraseña) y vínculo de cuentas. |
| Proveedores | todos (agregar) · tesorería (editar, eliminar, importar Excel) | Registro de proveedores con RUT para elegirlos en cada gasto (spec 11). |

## Idioma y formato

- Interfaz en **español de Chile**, tono directo y breve ("Elige el solicitante", no "Por favor seleccione…").
- Moneda **CLP**: se muestra `$ 70.389` (punto como separador de miles, sin decimales). En base se guardan con decimales porque el historial los trae.
- Fechas: se muestran `DD-MM-YYYY`; se guardan `YYYY-MM-DD`.

## Lo que NO es (por ahora)

- No envía correos de ningún tipo (tampoco para ingresar: no hay SMTP) ni notificaciones push. La persona ve su estado en su carpeta; las cuentas y contraseñas las entrega el administrador.
- No lee las fotos automáticamente: la lectura con IA se eliminó el 2026-10-26 por el costo por imagen de la API. Los datos se ingresan a mano y las fotos/PDF quedan como respaldo.
- No es contabilidad completa: exporta al Excel que tesorería ya usa (hoja "Rendiciones").

## Datos sensibles

El repositorio contiene datos financieros y nombres reales de trabajadores (`CLAUDE/datos/`). Tratarlos como información interna: no subirlos a servicios externos, no usarlos en ejemplos públicos, no exponerlos en el bundle del frontend.
