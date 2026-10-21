# Rendiciones Heca Chile

App web de rendiciones de gastos de Heca Chile (formulario POE-GLO-FIN-003). Vue 3 + TypeScript + Vite + SCSS + Bootstrap 5.3 + Supabase.

## Contexto permanente (steering)

@.kiro/steering/product.md
@.kiro/steering/tech.md
@.kiro/steering/structure.md
@.kiro/steering/business-rules.md
@.kiro/steering/data-model.md
@.kiro/steering/ui.md

## Cómo trabajar

- El plan vive en `.kiro/specs/` (índice en `.kiro/specs/README.md`). Antes de implementar, leer `requirements.md`, `design.md` y `tasks.md` del spec en curso.
- Avanzar **una tarea por vez**. Al terminar: `npm run build`, `npm run lint`, `npm run test` en verde, marcar la tarea `[x]` en su `tasks.md`, actualizar el estado en el índice si cambia, y proponer el commit.
- Si una tarea obliga a cambiar el diseño o una regla, actualizar primero el spec/steering correspondiente.
- La carpeta `CLAUDE/` es el **prototipo legado** (artifact de Claude) y los datos originales: solo referencia. No editarla. Su `CLAUDE/CLAUDE.md` describe la plataforma de artifacts (`window.claude.use`, `db`, `sample`…), que **no aplica** a esta app.
- Ante una duda funcional, mirar cómo lo resuelve `CLAUDE/app/rendiciones-heca.html` (las funciones están citadas en cada spec).
- Datos reales de personas y montos: no copiarlos a tests, fixtures públicos ni prompts de ejemplo; usar datos ficticios, salvo el caso de prueba DHE-042 ya documentado.
