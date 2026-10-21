# 02 · Rendir gastos — Requisitos

Pantalla principal del solicitante (mobile first): subir fotos, lectura automática con IA, revisión y envío. Referencia: `vRendir`, `addPhotos`, `prepImages`, `buildPrompt`, `leer`, `editor`, `validate`, `clean`, `enviar`.

## R1. Subir fotos

- **R1.1** EL SISTEMA DEBERÁ mostrar los 3 pasos (Sube las fotos · Revisa · Envía) y una zona para "Sacar o subir fotos" que acepte varias imágenes (JPG, PNG, WebP, HEIC si el navegador lo convierte) por cámara, selector o arrastrar.
- **R1.2** EL SISTEMA DEBERÁ mostrar miniaturas con zoom y botón para quitar cada foto antes de leer.
- **R1.3** SI se sube un archivo que no es imagen (p. ej. PDF), ENTONCES EL SISTEMA DEBERÁ ignorarlo y avisar "Si la boleta llegó en PDF, sube un pantallazo".

## R2. Lectura automática

- **R2.1** CUANDO se agreguen fotos, EL SISTEMA DEBERÁ iniciar la lectura sola (sin botón) y mostrar "Leyendo la rendición…" con un botón **Detener**.
- **R2.2** EL SISTEMA DEBERÁ enviar cada foto completa y recortes ampliados según el cupo, como en `business-rules.md` §Lectura.
- **R2.3** EL SISTEMA DEBERÁ hacer la llamada a la IA desde una Edge Function; la clave de la API nunca llega al navegador.
- **R2.4** CUANDO la lectura termine, EL SISTEMA DEBERÁ armar un borrador con: solicitante, Nº, fecha, empresa, tipo de fondo, total del formulario y líneas (fecha, tipo, proveedor, RUT, Nº doc., neto, IVA, exento, detalle, subcuenta, cuenta sugerida, C.C. de la empresa).
- **R2.5** EL SISTEMA DEBERÁ mostrar "Se encontraron N documento(s) y se armaron M línea(s)" y la lista de **dudas** del modelo.
- **R2.6** SI el usuario está vinculado a una persona y no es tesorería, ENTONCES EL SISTEMA DEBERÁ fijar el solicitante en su persona.
- **R2.7** SI la lectura falla, ENTONCES EL SISTEMA DEBERÁ mostrar el mensaje correspondiente (detenida, límite alcanzado, imagen rechazada, datos no ordenables, genérico) con "Intentar de nuevo" y "Empezar de nuevo".
- **R2.8** EL SISTEMA DEBERÁ registrar cada lectura en `lecturas_ia` y limitar a 30 lecturas por usuario por día (configurable).
- **R2.9** MIENTRAS haya un borrador con fotos nuevas, EL SISTEMA DEBERÁ ofrecer "Volver a leer las fotos".

## R3. Revisión (editor)

- **R3.1** EL SISTEMA DEBERÁ permitir corregir todos los campos del formulario y de cada línea, agregar y quitar líneas.
- **R3.2** CUANDO se elija una subcuenta, EL SISTEMA DEBERÁ sugerir la cuenta correspondiente.
- **R3.3** EL SISTEMA DEBERÁ mostrar en vivo la suma de gastos, el total del formulario y el chip **Cuadra** / **Diferencia $ X** / **Sin total del formulario**.
- **R3.4** El solicitante NO DEBERÁ ver ni editar Cuenta y C.C. (solo tesorería).
- **R3.5** En pantallas angostas, EL SISTEMA DEBERÁ mostrar cada línea como tarjeta en vez de tabla.

## R4. Envío

- **R4.1** CUANDO se presione **Enviar rendición**, EL SISTEMA DEBERÁ validar (`business-rules.md` §Validación) y mostrar todos los problemas juntos.
- **R4.2** CUANDO la validación pase, EL SISTEMA DEBERÁ subir las fotos al bucket `respaldos`, guardar la rendición con estado **En revisión** vía RPC y registrar el evento **Enviada**.
- **R4.3** CUANDO el envío termine, EL SISTEMA DEBERÁ mostrar "Rendición Nº X enviada por $ Y. Tesorería la revisará; sigue su estado en Mis rendiciones." y limpiar el borrador.
- **R4.4** SI falla la subida de alguna foto, ENTONCES EL SISTEMA DEBERÁ reintentar una vez y, si sigue fallando, avisar cuál foto no quedó guardada antes de enviar.
- **R4.5** EL SISTEMA DEBERÁ conservar el borrador (sin fotos) en el navegador si la persona recarga o cierra la pestaña por accidente.
- **R4.6** **Descartar** DEBERÁ pedir confirmación en línea.

## R5. Corregir y reenviar

- **R5.1** CUANDO la persona abra "Corregir y reenviar" desde una rendición Observada, EL SISTEMA DEBERÁ cargar el editor con sus datos y respaldos actuales, permitir agregar fotos y, al enviar, pasarla a En revisión con evento **Reenviada**.
