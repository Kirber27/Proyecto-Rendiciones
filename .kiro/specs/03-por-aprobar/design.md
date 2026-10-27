# 03 · Por aprobar — Diseño

## Datos

- Query: `v_rendiciones` where `estado = 'en_revision'` order by `enviado_en`.
- Marca: `aprobacion_anulada` → "Aprobación anulada"; si tiene evento `Reenviada` posterior al último `Observada` → "Reenviada"; si no → "En revisión".
- Duplicado: `folio_propuesto(persona_id, nro)` (función SQL) comparado con folios existentes; o en el cliente con `codigo + nro`.
- Realtime: canal `postgres_changes` sobre `rendiciones` (filtro `estado=eq.en_revision`) → refresca store y badge. Lo usa `AppTabs` vía `usePorAprobarStore().cantidad`.

## RPC (migración `0010_rpc_decisiones.sql`)

```sql
aprobar_rendicion(p_id uuid, p jsonb, p_version timestamptz) returns text  -- devuelve folio
observar_rendicion(p_id uuid, p_nota text, p_version timestamptz)
rechazar_rendicion(p_id uuid, p_nota text, p_version timestamptz)
```

- Todas: `if not es_tesoreria() then raise exception 'sin_permiso'`.
- Concurrencia optimista: `p_version` = `editado_en` que vio el cliente; si la fila cambió o ya no está `en_revision` → `raise exception 'ya_revisada'`.
- `aprobar_rendicion`: reemplaza líneas con `p.lineas`, valida `subcuenta_id` y `cuenta_id` no nulos, `folio = coalesce(folio, generar_folio(persona_id, nro))`, `decidido_en/por`, `aprobacion_anulada = false`, evento.
- `generar_folio`: `codigo || '-' || lpad(nro::text, 3, '0')`; si existe, agrega `'-' || substr(md5(random()::text),1,2)`.

## UI

```
PorAprobarView
├── tabla (table-hover, fila seleccionada con bg primary-subtle)
└── panel de revisión
    ├── Timeline
    ├── RendicionEditor mode="aprobar"
    └── #acciones: [Aprobar e ingresar (btn-success btn-lg)]  [Observación input]  [Devolver para corregir]  [Rechazar]  [Cerrar]
```

Errores de RPC → mapa `sin_permiso | ya_revisada | validacion` → mensajes en español.
