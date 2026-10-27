# Estructura del repositorio

```
Proyecto-Rendiciones/
├── CLAUDE.md                     punto de entrada para Claude Code (importa .kiro/steering)
├── .kiro/
│   ├── steering/                 contexto permanente (producto, stack, estructura, reglas, UI, datos)
│   └── specs/                    una carpeta por funcionalidad: requirements.md, design.md, tasks.md
├── CLAUDE/                       LEGADO: prototipo (artifact) y datos originales. Solo referencia, no se edita.
│   ├── app/rendiciones-heca.html maqueta funcional y de diseño
│   ├── datos/                    listas maestras, códigos, historial 2026 (lotes JSON)
│   └── scripts/                  scripts Python del prototipo
├── supabase/
│   ├── config.toml
│   ├── migrations/               SQL versionado: AAAAMMDDHHMMSS_nombre.sql
│   └── functions/
│       └── cuentas/              Edge Function: crear cuenta / contraseña temporal (solo administrador)
├── scripts/
│   ├── generar-datos-iniciales.mjs  CLAUDE/datos → migración de catálogos y personas
│   ├── probar-migraciones.mjs    migraciones + RLS sobre PGlite (sin Docker)
│   ├── importar-historial.mjs    carga del historial 2026 (clave secreta, idempotente, --ensayo)
│   └── clave-temporal.mjs        contraseña temporal para una cuenta desde la terminal (clave secreta)
├── public/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── assets/scss/
│   │   ├── _tokens.scss          colores, tipografía, radios (fuente única de verdad)
│   │   ├── _bootstrap-vars.scss  mapeo tokens → variables de Bootstrap
│   │   ├── _dark.scss            overrides de [data-bs-theme=dark]
│   │   ├── _components.scss      chip, kpi, card, drop, thumbs, timeline…
│   │   └── main.scss             orden de imports
│   ├── lib/
│   │   ├── supabase.ts           cliente único
│   │   ├── imagenes.ts           canvas: reducir fotos antes de subirlas
│   │   ├── descargar.ts          descargar un Blob generado (Excel, PDF)
│   │   ├── paginado.ts           traerTodo: listas por páginas (la API corta en 1.000 filas)
│   │   └── database.types.ts     generado, no editar a mano
│   ├── domain/                   lógica pura, sin Vue ni Supabase, 100% testeable
│   │   ├── formato.ts            norm, tr, raw, num, miles, clp, montoATexto, fdate, parseDate, dnum, semana, mes
│   │   ├── rendicion.ts          totalLinea, sumaLineas, cuadra, borradorNuevo, tieneDatos, validar, limpiar
│   │   ├── asignacion.ts         FIFO de pagos (porta alloc())
│   │   ├── conciliacion.ts       propuestas banco (porta proposals())
│   │   ├── cartola.ts            detectar columnas, construir movimientos
│   │   ├── exportar.ts           filas del Excel de tesorería (hoja "Rendiciones")
│   │   ├── reporte.ts            contenido del reporte PDF por rendición
│   │   ├── carpeta.ts            estado actual, grupos, línea de tiempo e índice de carpetas
│   │   ├── personas.ts           código sugerido, alta, correos, funciones (un tesorero, ≥1 admin)
│   │   ├── acceso.ts             reglas de contraseña (largo mínimo, repetir, distinta de la actual)
│   │   ├── cuentaCorriente.ts    movimientos con saldo acumulado y resumen de Personas
│   │   ├── respaldos.ts          adjuntos: tipos aceptados (imagen/PDF), tamaño máximo, escala de fotos
│   │   └── __tests__/
│   ├── services/                 acceso a Supabase (queries y RPC), uno por entidad; excel.ts (SheetJS), pdf.ts (jsPDF + pdf-lib)
│   ├── stores/                   Pinia: auth, catalogos, rendiciones, pagos, banco, personas
│   ├── composables/              useTheme, useMediaQuery, useConfirm, useSignedUrl…
│   ├── components/
│   │   ├── ui/                   AppChip, KpiTile, EmptyState, AppLightbox, ConfirmInline, MoneyInput
│   │   ├── layout/               AppHeader, AppTabs, ThemeToggle
│   │   └── rendicion/            RespaldosDrop, RespaldosGrid, RendicionEditor, DatosFormulario, LineasTable, CuadreTotales, LineaTiempo
│   ├── views/                    una por pantalla (LoginView, CambiarClaveView, RendirView, CarpetasView,
│   │                             PorAprobarView, LibroView, PersonasView, BancoView, PerfilesView)
│   ├── router/index.ts
│   ├── types/                    tipos de dominio (rendicion, catalogos, roles, …)
│   └── dev/                      solo desarrollo: datos de demo (catálogos con personas ficticias)
└── tests/                        e2e futuros
```

## Convenciones

- **Nombres de dominio en español** (rendicion, linea, pago, cartola, persona). Código técnico en inglés cuando es estándar (store, service, composable).
- Componentes en `PascalCase.vue`; composables `useAlgo.ts`; stores `useAlgoStore`.
- La lógica de negocio va en `src/domain/` (funciones puras). Los componentes no calculan saldos ni validan reglas; llaman al dominio.
- Los servicios devuelven tipos de dominio, no filas crudas de Supabase.
- Una migración por cambio de esquema; nunca editar una migración ya aplicada en producción.
- Textos de interfaz directamente en los componentes (una sola lengua); si crece, se extrae.
- Commits en español, imperativo, prefijo convencional: `feat: …`, `fix: …`, `chore: …`, `docs: …`.
- Ramas: `develop` como integración, `main` para producción, `feat/<spec>-<tarea>` por tarea.
