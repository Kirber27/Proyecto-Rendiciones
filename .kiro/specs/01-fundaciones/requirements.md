# 01 · Fundaciones — Requisitos

Base técnica sobre la que se construyen todas las pantallas: proyecto Vue, tema visual, Supabase, autenticación, funciones (roles), esquema de datos y carga del historial.

## R1. Proyecto y calidad

- **R1.1** EL SISTEMA DEBERÁ ser un proyecto Vite + Vue 3 + TypeScript en la raíz del repositorio, con los scripts `dev`, `build`, `test`, `lint`, `typecheck`, `db:types`, `db:reset`.
- **R1.2** CUANDO se ejecute `npm run build`, EL SISTEMA DEBERÁ fallar si hay errores de tipos.
- **R1.3** EL SISTEMA NO DEBERÁ commitear `.env*` (salvo `.env.example`) ni claves `service_role`.

## R2. Tema visual

- **R2.1** EL SISTEMA DEBERÁ compilar Bootstrap 5.3 desde SCSS con las variables mapeadas a los tokens de `steering/ui.md`.
- **R2.2** EL SISTEMA DEBERÁ usar IBM Plex Sans y IBM Plex Mono servidas localmente.
- **R2.3** EL SISTEMA DEBERÁ seguir el modo claro/oscuro del sistema operativo y permitir fijarlo con un botón; la elección se recuerda en el navegador.
- **R2.4** EL SISTEMA DEBERÁ mostrar el encabezado (marca + pestañas) según la maqueta, con las pestañas visibles según la función del usuario.

## R3. Autenticación

> **Reemplazado por la spec 10 (2026-10-27):** ingreso con correo y contraseña, cuentas creadas por el administrador, sin correos. Siguen vigentes R3.3 (hook), R3.4 (vínculo por correo) y R3.5.

- **R3.1** CUANDO un usuario sin sesión abra la app, EL SISTEMA DEBERÁ mostrar la pantalla de ingreso con correo.
- **R3.2** CUANDO el usuario ingrese un correo registrado en `personas`, EL SISTEMA DEBERÁ enviarle un código/enlace de acceso.
- **R3.3** SI el correo no está registrado, ENTONCES EL SISTEMA DEBERÁ mostrar "Tu correo no está habilitado. Pide a tesorería que te agregue." sin crear la cuenta.
- **R3.4** CUANDO un usuario inicie sesión por primera vez, EL SISTEMA DEBERÁ vincular su cuenta con la persona del mismo correo.
- **R3.5** EL SISTEMA DEBERÁ mantener la sesión entre visitas y permitir cerrar sesión.

## R4. Funciones y acceso

- **R4.1** EL SISTEMA DEBERÁ derivar la función del usuario (Administrador / Tesorero / Solicitante) de la persona vinculada; sin persona vinculada = Solicitante sin datos.
- **R4.2** EL SISTEMA DEBERÁ impedir navegar a rutas no permitidas para la función (redirige a Rendir gastos).
- **R4.3** EL SISTEMA DEBERÁ aplicar el control de acceso real en la base con RLS; la UI solo oculta.
- **R4.4** EL SISTEMA DEBERÁ garantizar un solo Tesorero activo.

## R5. Esquema y datos maestros

- **R5.1** EL SISTEMA DEBERÁ crear el esquema de `steering/data-model.md` mediante migraciones versionadas.
- **R5.2** EL SISTEMA DEBERÁ sembrar los catálogos con la grafía exacta de `CLAUDE/datos/lists.json` y las sugerencias de `subcuenta_a_cuenta.json`.
- **R5.3** EL SISTEMA DEBERÁ sembrar las 26 personas del historial con sus códigos de `codes.json`.

## R6. Historial 2026

- **R6.1** EL SISTEMA DEBERÁ importar los lotes `historial_2026/b00..b07.json` como rendiciones `Histórico` aprobadas y sus pagos.
- **R6.2** CUANDO el script se ejecute dos veces, EL SISTEMA NO DEBERÁ duplicar ni sobrescribir ediciones (upsert por folio / código).
- **R6.3** AL terminar, EL SISTEMA DEBERÁ informar totales: 182 rendiciones / 45.024.174 CLP, 612 líneas, 174 pagos / 45.045.931 CLP.

## R7. Dominio base

- **R7.1** EL SISTEMA DEBERÁ portar `norm`, `tr`, `raw`, `num`, `clp`, `fdate`, `parseDate`, `semana`, `lineTotal`, `rendTotal` a `src/domain/` con tests.
