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
│   ├── seed.sql                  catálogos (empresas, cuentas, subcuentas, C.C., bancos, personas)
│   └── functions/
│       └── leer-rendicion/       Edge Function de lectura con IA
├── scripts/
│   └── importar-historial.ts     carga única del historial 2026 (service role, idempotente)
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
│   │   └── database.types.ts     generado, no editar a mano
│   ├── domain/                   lógica pura, sin Vue ni Supabase, 100% testeable
│   │   ├── formato.ts            norm, tr, num, clp, fdate, parseDate, semana, MESES
│   │   ├── rendicion.ts          lineTotal, rendTotal, validar, limpiar, folio, sugerirCodigo
│   │   ├── asignacion.ts         FIFO de pagos (porta alloc())
│   │   ├── conciliacion.ts       propuestas banco (porta proposals())
│   │   ├── cartola.ts            detectar columnas, construir movimientos
│   │   ├── lectura.ts            prompt, schema zod de respuesta, normalizar a borrador
│   │   └── __tests__/
│   ├── services/                 acceso a Supabase (queries y RPC), uno por entidad
│   ├── stores/                   Pinia: auth, catalogos, rendiciones, pagos, banco, personas
│   ├── composables/              useConfirm, useToast, useSignedUrl, useImageTiles…
│   ├── components/
│   │   ├── ui/                   AppChip, KpiTile, EmptyState, AppLightbox, ConfirmInline, MoneyInput
│   │   ├── layout/               AppHeader, AppTabs, ThemeToggle
│   │   └── rendicion/            FotoDrop, RendicionEditor, LineasTable, CuadreTotales, Timeline, RendicionCard
│   ├── views/                    una por pantalla (LoginView, RendirView, CarpetasView, PorAprobarView,
│   │                             LibroView, PersonasView, BancoView, PerfilesView)
│   ├── router/index.ts
│   └── types/                    tipos de dominio (Linea, Rendicion, Pago, …)
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
