# Specs — hoja de ruta

Cada spec tiene `requirements.md` (qué, en formato EARS), `design.md` (cómo) y `tasks.md` (pasos chicos, con `[ ]`). Se avanza **una tarea a la vez**: implementar → `build`, `lint`, `test` en verde → marcar `[x]` → commit.

| # | Spec | Depende de | Estado |
| --- | --- | --- | --- |
| 01 | [Fundaciones](01-fundaciones/) — scaffold, tema, Supabase, auth, esquema, RLS, seed, historial | — | ⬜ Pendiente |
| 02 | [Rendir gastos](02-rendir-gastos/) — fotos, lectura IA, editor, envío | 01 | ⬜ |
| 03 | [Por aprobar](03-por-aprobar/) — bandeja y decisiones de tesorería | 02 | ⬜ |
| 04 | [Libro de rendiciones](04-libro-rendiciones/) — FIFO, libro, PDF, Excel | 03 | ⬜ |
| 05 | [Carpetas](05-carpetas/) — mis rendiciones y carpetas por persona | 04 | ⬜ |
| 06 | [Personas y pagos](06-personas-pagos/) — cuenta corriente, pagos manuales | 04 | ⬜ |
| 07 | [Banco y conciliación](07-banco-conciliacion/) — cartolas y propuestas | 06 | ⬜ |
| 08 | [Perfiles](08-perfiles/) — personas, funciones, cuentas | 01 | ⬜ |
| 09 | Despliegue (abajo) | todo | ⬜ |

**Hito 1 (MVP solicitante + aprobación):** 01 → 08.3/8.5 (cargar correos) → 02 → 03.
**Hito 2 (reemplaza al prototipo):** 04 → 05 → 06 → 07 → resto de 08.
**Hito 3:** 09 y ajustes de UI.

## 09 · Despliegue — tareas

- [ ] **9.1** Crear proyecto Supabase Cloud (región São Paulo `sa-east-1`), `supabase link`, `supabase db push`.
- [ ] **9.2** Secretos de Edge Functions (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) y `supabase functions deploy`.
- [ ] **9.3** Configurar Auth: URL del sitio, redirect URLs, plantilla de correo en español, SMTP propio (Heca M365) para no depender del SMTP de prueba.
- [ ] **9.4** Elegir hosting del frontend y configurar CI (build + lint + test en cada PR a `develop`/`main`).
- [ ] **9.5** Importar historial en producción **una sola vez** y verificar totales.
- [ ] **9.6** Exportar a Excel desde el prototipo (artifact) los datos creados después del 09-10-2026 y cargarlos (o decidir corte).
- [ ] **9.7** Prueba con usuarios reales (1 tesorero + 2 solicitantes) desde celular, con `ejemplo_formulario_DHE-042.jpg`.
- [ ] **9.8** Backups: activar PITR o export programado; documentar restauración.

## Decisiones abiertas

1. Hosting del frontend (Vercel / Netlify / Cloudflare Pages).
2. Login con Microsoft 365 (Azure AD) además del código por correo.
3. Notificaciones por correo al aprobar/observar/pagar (no estaba en el prototipo).
4. Fecha de corte entre el prototipo y la app nueva.
