# Specs — hoja de ruta

Cada spec tiene `requirements.md` (qué, en formato EARS), `design.md` (cómo) y `tasks.md` (pasos chicos, con `[ ]`). Se avanza **una tarea a la vez**: implementar → `build`, `lint`, `test` en verde → marcar `[x]` → commit.

| # | Spec | Depende de | Estado |
| --- | --- | --- | --- |
| 01 | [Fundaciones](01-fundaciones/) — scaffold, tema, Supabase, auth, esquema, RLS, seed, historial | — | ✅ Completo (2026-10-26) |
| 02 | [Rendir gastos](02-rendir-gastos/) — formulario, respaldos adjuntos (fotos y PDF), envío | 01 | 🟡 Rediseño sin IA implementado (2.14: probar en el navegador) |
| 03 | [Por aprobar](03-por-aprobar/) — bandeja y decisiones de tesorería | 02 | 🟡 Implementado (falta prueba real) |
| 04 | [Libro de rendiciones](04-libro-rendiciones/) — FIFO, libro, PDF, Excel | 03 | 🟡 Implementado (4.7: probar PDF con fotos en el navegador) |
| 05 | [Carpetas](05-carpetas/) — mis rendiciones y carpetas por persona | 04 | 🟡 Implementado (5.5: confirmar RLS con cuenta real) |
| 06 | [Personas y pagos](06-personas-pagos/) — cuenta corriente, pagos manuales | 04 | ✅ Implementado (falta probar en el navegador) |
| 07 | [Banco y conciliación](07-banco-conciliacion/) — cartolas y propuestas | 06 | 🟡 Implementado (7.3: probar con cartolas reales) |
| 08 | [Perfiles](08-perfiles/) — personas, funciones, cuentas | 01 | ✅ Completo (8.7 reemplazada por la 10) |
| 09 | Despliegue (abajo) | todo | ⬜ |
| 10 | [Ingreso con contraseña](10-ingreso-con-contrasena/) — correo + contraseña, cuentas y contraseñas temporales desde Perfiles, sin correos | 01, 08 | 🟡 Implementado (10.5: configurar el panel de Supabase y probar) |
| 11 | [Ajustes del cliente](11-ajustes-cliente/) — Nº correlativo (y Nº faltantes), proveedores con RUT, Nº doc. único, IVA calculado, impuesto especial, nueva subcuenta, KPIs y Excel de la búsqueda | 02, 04 | 🟡 Implementado (11.1–11.10; 11.12 Nº faltantes; 11.11: push de migraciones 0018–0023 y prueba en producción) |

**Hito 1 (MVP solicitante + aprobación):** 01 → 08.3/8.5 (cargar correos) → 02 → 03.
**Hito 2 (reemplaza al prototipo):** 04 → 05 → 06 → 07 → resto de 08.
**Hito 3:** 09 y ajustes de UI.

## 09 · Despliegue — tareas

- [ ] **9.1** Crear proyecto Supabase Cloud (región São Paulo `sa-east-1`), `supabase link`, `supabase db push`.
- [x] **9.2** ~~Secretos de Edge Functions y `supabase functions deploy`~~ — ya no aplica: sin Edge Functions desde 2.10 (2026-10-26).
- [ ] **9.3** Configurar Auth: URL del sitio, registro abierto desactivado y largo mínimo de contraseña 8 (spec 10). Ya no hace falta SMTP ni plantillas de correo: la app no envía correos.
- [ ] **9.4** Hosting del frontend: **Cloudflare Workers** (`proyecto-rendiciones.kjpr-2904.workers.dev`, build desde el repo, 2026-10-27). Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` van en *Settings → Build → Variables and secrets* (se leen al compilar; `.env.local` no se sube). Falta: CI (build + lint + test en cada PR a `develop`/`main`).
- [ ] **9.5** Importar historial en producción **una sola vez** y verificar totales.
- [ ] **9.6** Exportar a Excel desde el prototipo (artifact) los datos creados después del 09-10-2026 y cargarlos (o decidir corte).
- [ ] **9.7** Prueba con usuarios reales (1 tesorero + 2 solicitantes) desde celular, adjuntando `ejemplo_formulario_DHE-042.jpg` y un PDF de boleta.
- [ ] **9.8** Backups: activar PITR o export programado; documentar restauración.

## Deuda / bloqueos

Ver **[DEUDA.md](DEUDA.md)**: bloqueos (proyecto en Supabase Cloud), código temporal a eliminar y pendientes técnicos.

## Decisiones abiertas

1. ~~Hosting del frontend~~ — Cloudflare Workers (2026-10-27).
2. Login con Microsoft 365 (Azure AD) además del código por correo.
3. Notificaciones por correo al aprobar/observar/pagar (no estaba en el prototipo).
4. Fecha de corte entre el prototipo y la app nueva.
