# 02 · Rendir gastos — Requisitos

Pantalla principal del solicitante (mobile first): completar el formulario de rendición, adjuntar los respaldos y enviar. Referencia: `editor`, `validate`, `clean`, `enviar` del prototipo.

> **Cambio 2026-10-26 — sin lectura con IA.** La API de Anthropic cobra por cada imagen leída y el costo no se justifica. Se elimina la lectura automática (Edge Function, recortes, prompt, `lecturas_ia`). La pantalla pasa a ser directamente el formulario que antes armaba la lectura, y las fotos o PDF de las boletas quedan como **archivos adjuntos** de la rendición. Tareas 2.9–2.14.

## R1. Formulario

- **R1.1** CUANDO la persona abra Rendir gastos, EL SISTEMA DEBERÁ mostrar el formulario listo para completar: solicitante, Nº, fecha (hoy), empresa (*Hecaglobal Instruments SPA* por defecto), tipo de fondo, total del formulario y una línea de gasto vacía con el C.C. de la empresa.
- **R1.2** EL SISTEMA DEBERÁ mostrar los 3 pasos (Completa el formulario · Adjunta los respaldos · Envía).
- **R1.3** SI el usuario está vinculado a una persona y no es tesorería, ENTONCES EL SISTEMA DEBERÁ fijar el solicitante en su persona.
- **R1.4** EL SISTEMA DEBERÁ permitir completar todos los campos del formulario y de cada línea, agregar y quitar líneas.
- **R1.5** CUANDO se elija una subcuenta, EL SISTEMA DEBERÁ sugerir la cuenta correspondiente.
- **R1.6** EL SISTEMA DEBERÁ mostrar en vivo la suma de gastos, el total del formulario y el chip **Cuadra** / **Diferencia $ X** / **Sin total del formulario**.
- **R1.7** El solicitante NO DEBERÁ ver ni editar Cuenta y C.C. (solo tesorería).
- **R1.8** En pantallas angostas, EL SISTEMA DEBERÁ mostrar cada línea como tarjeta en vez de tabla.

## R2. Respaldos adjuntos

- **R2.1** EL SISTEMA DEBERÁ ofrecer una zona "Adjuntar respaldos" que acepte varios archivos: imágenes (JPG, PNG, WebP, HEIC si el navegador lo convierte) y **PDF**, por selector, arrastrar o cámara (la cámara solo saca fotos).
- **R2.2** EL SISTEMA DEBERÁ mostrar cada respaldo: las imágenes como miniatura con zoom y los PDF como ficha con su nombre que abre el archivo. Los que aún no se envían tienen botón para quitarlos; los ya guardados no.
- **R2.3** SI se adjunta un archivo que no es imagen ni PDF, ENTONCES EL SISTEMA DEBERÁ ignorarlo y avisar "… no es imagen ni PDF y no se agregó".
- **R2.4** SI un PDF pesa más de 10 MB, ENTONCES EL SISTEMA DEBERÁ ignorarlo y avisar que supera el máximo.
- **R2.5** Una rendición NO DEBERÁ poder enviarse sin al menos **un respaldo** (en un reenvío cuentan los ya guardados). Lo valida la app y también la RPC `enviar_rendicion`.
- **R2.6** En Por aprobar y en el libro, tesorería DEBERÁ ver y abrir los respaldos PDF igual que las fotos.

## R3. Envío

- **R3.1** CUANDO se presione **Enviar rendición**, EL SISTEMA DEBERÁ validar (`business-rules.md` §Validación) y mostrar todos los problemas juntos.
- **R3.2** CUANDO la validación pase, EL SISTEMA DEBERÁ subir los respaldos al bucket `respaldos` (fotos reducidas a 2400 px en JPEG; PDF tal cual), guardar la rendición con estado **En revisión** vía RPC y registrar el evento **Enviada**.
- **R3.3** CUANDO el envío termine, EL SISTEMA DEBERÁ mostrar "Rendición Nº X enviada por $ Y. Tesorería la revisará; sigue su estado en Mis rendiciones." y dejar el formulario vacío para una nueva.
- **R3.4** SI falla la subida de algún respaldo, ENTONCES EL SISTEMA DEBERÁ reintentar una vez y, si sigue fallando, avisar cuál no quedó guardado sin enviar la rendición.
- **R3.5** MIENTRAS el formulario tenga datos, EL SISTEMA DEBERÁ conservarlo en el navegador (sin los adjuntos) si la persona recarga o cierra la pestaña por accidente, y avisar al recuperarlo que vuelva a adjuntar los archivos.
- **R3.6** **Descartar** DEBERÁ pedir confirmación en línea y dejar el formulario vacío.

## R4. Corregir y reenviar

- **R4.1** CUANDO la persona abra "Corregir y reenviar" desde una rendición Observada, EL SISTEMA DEBERÁ cargar el formulario con sus datos, el motivo de tesorería y sus respaldos actuales, permitir adjuntar más y, al enviar, pasarla a En revisión con evento **Reenviada**.

## R5. Reporte PDF con respaldos PDF

- **R5.1** CUANDO tesorería descargue el reporte de una rendición con respaldos PDF, EL SISTEMA DEBERÁ incluir cada página de esos PDF en el reporte, en el orden de los respaldos, con el mismo encabezado ("<folio> · Respaldo k de n") y la numeración "Página i de n" de las fotos.
- **R5.2** SI un PDF no se puede leer (dañado o con contraseña), ENTONCES EL SISTEMA DEBERÁ dejar una página con el aviso en su lugar y generar el resto del reporte.

## R6. Sin IA

- **R6.1** La app NO DEBERÁ enviar fotos ni datos a servicios de IA. No quedan Edge Functions, secretos de Anthropic ni la tabla `lecturas_ia`.
