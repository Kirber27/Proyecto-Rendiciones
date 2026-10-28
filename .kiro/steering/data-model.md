# Modelo de datos (Supabase / Postgres)

Reemplaza los documentos `envios/estados/rendiciones/pagos/cartolas/publico` del prototipo por tablas relacionales. (La tabla `lecturas_ia` de la lectura con IA se eliminó el 2026-10-26, migración `…0016`.) Una rendición es **una sola fila** desde que se envía hasta que se paga; su estado y su folio cambian, y la línea de tiempo vive en `rendicion_eventos`.

## Enums

```sql
create type rol_app          as enum ('administrador','tesorero','solicitante');
create type tipo_documento   as enum ('Factura','Boleta','Boleta de honorarios','Transferencia');
create type estado_rendicion as enum ('en_revision','observada','rechazada','aprobada','eliminada');
create type tipo_pago        as enum ('Pago','Anticipo','No genera pago','Devolución de la persona');
create type origen_registro  as enum ('App','Histórico');
```

## Catálogos (grafía exacta del Excel, ver `CLAUDE/datos/lists.json`)

| Tabla | Columnas | Seed |
| --- | --- | --- |
| `empresas` | `id smallint pk`, `nombre text unique`, `rut text`, `cc_defecto text` | Heca Global SPA (76723245-4, HG) · Hecaglobal Instruments SPA (76886693-7, HGI.) · Siga Sonriendo SPA (77422425-4, SS) · Sonrie Pro Financial SPA (77219167-7, —) |
| `centros_costo` | `id smallint pk`, `codigo text unique`, `orden` | `lists.cc` |
| `cuentas` | `id smallint pk`, `nombre text unique`, `orden` | `lists.cue` |
| `subcuentas` | `id smallint pk`, `nombre text unique`, `cuenta_sugerida_id → cuentas`, `orden`, `activa bool` | `lists.sub` + `subcuenta_a_cuenta.json` |
| `medios_pago` | `id smallint pk`, `nombre text unique`, `orden` | `lists.pag` (bancos + "No Genera Pago", Cash) |

Lectura: cualquier usuario autenticado. Escritura: administrador.

## Personas y cuentas

```
personas
  id            uuid pk default gen_random_uuid()
  nombre        text not null              -- grafía exacta ("David Herce ")
  nombre_norm   text not null unique       -- norm(nombre), mantenido por trigger
  codigo        text not null unique check (codigo ~ '^[A-Z]{2,4}$')
  correo        citext unique              -- para login / vínculo automático
  rol           rol_app not null default 'solicitante'
  user_id       uuid unique references auth.users on delete set null
  es_nueva      bool not null default false  -- creada en la app (no viene del historial)
  eliminada_en  timestamptz
  creado_en     timestamptz not null default now()

unique index un_solo_tesorero on personas (rol) where rol = 'tesorero' and eliminada_en is null
```

- Las cuentas (`auth.users`) las crea el administrador desde Perfiles con correo y contraseña (Edge Function `cuentas`, spec 10). Mientras tenga una contraseña temporal, `user_metadata.debe_cambiar_clave = true`.
- Al crearse un usuario en `auth.users` (trigger), si su correo coincide con `personas.correo` se completa `personas.user_id`. Tesorería/admin pueden re-vincular a mano.
- Helpers SQL (`stable security definer`): `mi_persona_id()`, `mi_rol()`, `es_tesoreria()` (tesorero o administrador), `es_admin()`.

## Rendiciones

```
rendiciones
  id                uuid pk
  folio             text unique            -- DHE-042, se asigna al aprobar (null antes)
  persona_id        uuid not null → personas
  nro               int  not null
  fecha             date not null
  empresa_id        smallint → empresas
  fondo             text                   -- "FONDOS POR RENDIR CDA"
  total_formulario  numeric(14,2)          -- null si no tiene
  total             numeric(14,2) not null default 0  -- suma de líneas, mantenida por trigger
  estado            estado_rendicion not null default 'en_revision'
  aprobacion_anulada bool not null default false
  origen            origen_registro not null default 'App'
  creado_por        uuid → auth.users
  enviado_en        timestamptz            -- primer envío
  editado_en        timestamptz            -- último reenvío/corrección
  decidido_en       timestamptz
  decidido_por      uuid → auth.users
  nota_tesoreria    text                   -- motivo de observación/rechazo
  exportada         bool not null default false
  estado_previo     estado_rendicion       -- estado antes de eliminarla (para restaurar)
  obs               text                   -- notas internas / origen histórico
  creado_en         timestamptz default now()

rendicion_lineas
  id uuid pk, rendicion_id → rendiciones on delete cascade, orden smallint,
  fecha date, tipo tipo_documento, proveedor text, rut text, numero text,
  proveedor_id uuid → proveedores,   -- vínculo (spec 11); proveedor/rut quedan como se rindieron
  neto numeric(14,2) default 0, iva numeric(14,2) default 0,
  exento numeric(14,2) default 0,
  otros numeric(14,2) default 0,     -- "Imp. especial" en el formulario (spec 11); suma al total
  detalle text, subcuenta_id → subcuentas, cuenta_id → cuentas, centro_costo_id → centros_costo

rendicion_eventos              -- línea de tiempo / auditoría (solo insert)
  id bigint identity pk, rendicion_id → rendiciones, evento text, nota text,
  actor uuid → auth.users, creado_en timestamptz default now()
  -- evento ∈ Enviada | Reenviada | Aprobada | Observada | Rechazada | Aprobación anulada
  --          | Eliminada | Restaurada | Editada por tesorería | Ingresada (historial)

respaldos
  id uuid pk, rendicion_id → rendiciones on delete cascade,
  storage_path text not null,   -- respaldos/<persona_id>/<rendicion_id>/<uuid>.jpg | .pdf
  mime text,                    -- image/jpeg | application/pdf (según la extensión)
  orden smallint, creado_en
```

## Proveedores (spec 11)

```
proveedores
  id uuid pk, nombre text not null,
  rut text not null unique,      -- normalizado 12345678-5 (rut_valido + normalizar_rut)
  creado_por uuid → auth.users,  -- null en los precargados
  creado_en timestamptz, eliminado_en timestamptz
```

- Helpers SQL: `normalizar_rut(text)` y `rut_valido(text)` (módulo 11), iguales a `src/domain/rut.ts`.
- Precarga (migración `…0019`, `_precargar_proveedores()`): un proveedor por RUT válido de las líneas, con el nombre más usado, y vínculo de esas líneas. El historial 2026 no trae RUT ni proveedor, así que solo aporta lo enviado desde la app.

## Pagos y banco

```
pagos
  id uuid pk, codigo_hist text unique,       -- H0001..H0174 del historial
  persona_id → personas not null, fecha date, medio_pago_id → medios_pago,
  monto numeric(14,2) not null,              -- negativo en devoluciones
  tipo tipo_pago not null default 'Pago',
  movimiento_id → cartola_movimientos unique,  -- cargo de banco que lo respalda
  descripcion text, origen origen_registro default 'App', obs text,
  creado_por → auth.users, creado_en

pago_rendiciones                             -- vínculo explícito pago ↔ rendición
  pago_id → pagos on delete cascade, rendicion_id → rendiciones, pk (pago_id, rendicion_id)

cartolas
  id uuid pk, nombre_archivo text, medio_pago_id → medios_pago, subido_por, creado_en

cartola_movimientos
  id uuid pk, cartola_id → cartolas on delete cascade, idx int,
  fecha date not null, descripcion text, referencia text,
  cargo numeric(14,2) default 0, abono numeric(14,2) default 0,
  ignorado bool default false
  -- "asignado" = existe un pago con movimiento_id = este id
```

## Políticas RLS (resumen)

| Tabla | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| catálogos | autenticado | `es_admin()` |
| `personas` | autenticado (todas las activas; las eliminadas solo tesorería) | `es_admin()` (vía RPC para funciones) |
| `rendiciones`, `rendicion_lineas`, `respaldos`, `rendicion_eventos` | dueño (`persona_id = mi_persona_id()`) o `es_tesoreria()` | **solo vía RPC** |
| `proveedores` | autenticado (activos; los eliminados solo tesorería) | **solo vía RPC** |
| `pagos`, `pago_rendiciones` | dueño o `es_tesoreria()` | `es_tesoreria()` vía RPC |
| `cartolas`, `cartola_movimientos` | `es_tesoreria()` | `es_tesoreria()` |
| Storage `respaldos` (imágenes y PDF, 10 MB) | dueño de la carpeta `<persona_id>/…` o tesorería | subir: dueño en su carpeta; borrar: tesorería |

## RPC (funciones `security definer`, validan rol y escriben evento)

| Función | Quién | Efecto |
| --- | --- | --- |
| `siguiente_nro(persona)` | la persona (la suya) o tesorería | Mayor Nº de la persona + 1 (para mostrarlo en el formulario). |
| `enviar_rendicion(p jsonb)` | solicitante (o tesorería por otro) | Crea o reemplaza (si está `en_revision`/`observada` y es suya) cabecera + líneas + respaldos (`.jpg`/`.pdf`; exige al menos uno). Asigna el Nº correlativo a las nuevas (ignora el del payload). Exige proveedor activo de la lista en cada línea. Evento Enviada/Reenviada. Observada → en_revision. |
| `aprobar_rendicion(id, p jsonb)` | tesorería | Guarda las correcciones, exige subcuenta/cuenta, asigna folio si no tiene, estado aprobada. Conserva el Nº (nuevo correlativo solo si cambia la persona). |
| `observar_rendicion(id, nota)` / `rechazar_rendicion(id, nota)` | tesorería | Nota obligatoria. |
| `anular_aprobacion(id, nota)` | tesorería | aprobada → en_revision, `aprobacion_anulada = true`, conserva folio. |
| `editar_rendicion(id, p jsonb)` | tesorería | Edición en el libro (conserva el Nº; nuevo correlativo solo si cambia la persona). Evento "Editada por tesorería". |
| `eliminar_rendicion(id, nota)` / `restaurar_rendicion(id)` | tesorería | Soft delete. |
| `registrar_pago(p jsonb)` | tesorería | Pago/anticipo/devolución + vínculos. |
| `confirmar_conciliacion(p jsonb)` | tesorería | Lote de propuestas aceptadas → pagos con `movimiento_id`. |
| `asignar_rol(persona_id, rol)` | admin | Garantiza un solo tesorero. |
| `marcar_exportadas(ids uuid[])` | tesorería | `exportada = true`. |
| `crear_subcuenta(nombre, cuenta)` | tesorería | Subcuenta nueva (nombre limpio, sin duplicados por `normalizar`), al final del orden. |
| `documento_repetido(rut, tipo, numero, excluir)` | cualquiera | Sí/no: el documento ya está en otra rendición no eliminada ni rechazada (no expone datos ajenos). |
| `crear_proveedor(nombre, rut)` | cualquiera con persona | Valida RUT (DV) y que no exista; guarda nombre limpio y RUT normalizado. |
| `editar_proveedor(id, nombre, rut)` | tesorería | Corrige nombre/RUT (las líneas guardadas no cambian). |
| `eliminar_proveedor(id, eliminar = true)` | tesorería | Soft delete (`eliminar = false` restaura). |
| `importar_proveedores(filas jsonb)` | tesorería | Agrega solo los nuevos válidos (no pisa existentes); devuelve cuántos. |

## Vistas

- `v_rendiciones` — rendiciones + nombre persona + empresa + nº líneas + nº respaldos + último evento.
- El estado de pago (FIFO) **se calcula en el cliente** con `src/domain/asignacion.ts` (como el prototipo). Si el volumen crece, se porta a una función SQL.

## Migración del historial 2026

- Origen: `CLAUDE/datos/historial_2026/b00..b07.json` (182 rendiciones, 612 líneas, 174 pagos).
- Script `scripts/importar-historial.ts` con service role: crea personas faltantes (códigos de `codes.json`), mapea nombres de catálogo por `norm`, inserta rendiciones `origen = 'Histórico'`, `estado = 'aprobada'`, `folio` = id del lote, evento "Ingresada (historial)", y pagos con `codigo_hist`.
- **Idempotente**: upsert por `folio` / `codigo_hist`. Totales a verificar después de cargar: 45.024.174 CLP rendido y 45.045.931 CLP pagado.
