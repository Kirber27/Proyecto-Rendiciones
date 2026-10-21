# Modelo de datos (Supabase / Postgres)

Reemplaza los documentos `envios/estados/rendiciones/pagos/cartolas/publico` del prototipo por tablas relacionales. Una rendición es **una sola fila** desde que se envía hasta que se paga; su estado y su folio cambian, y la línea de tiempo vive en `rendicion_eventos`.

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
  obs               text                   -- notas internas / origen histórico
  creado_en         timestamptz default now()

rendicion_lineas
  id uuid pk, rendicion_id → rendiciones on delete cascade, orden smallint,
  fecha date, tipo tipo_documento, proveedor text, rut text, numero text,
  neto numeric(14,2) default 0, iva numeric(14,2) default 0,
  exento numeric(14,2) default 0, otros numeric(14,2) default 0,
  detalle text, subcuenta_id → subcuentas, cuenta_id → cuentas, centro_costo_id → centros_costo

rendicion_eventos              -- línea de tiempo / auditoría (solo insert)
  id bigint identity pk, rendicion_id → rendiciones, evento text, nota text,
  actor uuid → auth.users, creado_en timestamptz default now()
  -- evento ∈ Enviada | Reenviada | Aprobada | Observada | Rechazada | Aprobación anulada
  --          | Eliminada | Restaurada | Editada por tesorería | Ingresada (historial)

respaldos
  id uuid pk, rendicion_id → rendiciones on delete cascade,
  storage_path text not null,   -- respaldos/<persona_id>/<rendicion_id>/<uuid>.jpg
  mime text, orden smallint, creado_en
```

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

## Uso de IA

```
lecturas_ia
  id bigint identity, user_id → auth.users, creado_en, imagenes int,
  tokens_entrada int, tokens_salida int, ok bool, error text
```

## Políticas RLS (resumen)

| Tabla | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| catálogos | autenticado | `es_admin()` |
| `personas` | autenticado (todas las activas; las eliminadas solo tesorería) | `es_admin()` (vía RPC para funciones) |
| `rendiciones`, `rendicion_lineas`, `respaldos`, `rendicion_eventos` | dueño (`persona_id = mi_persona_id()`) o `es_tesoreria()` | **solo vía RPC** |
| `pagos`, `pago_rendiciones` | dueño o `es_tesoreria()` | `es_tesoreria()` vía RPC |
| `cartolas`, `cartola_movimientos` | `es_tesoreria()` | `es_tesoreria()` |
| `lecturas_ia` | propio o admin | solo la Edge Function (service role) |
| Storage `respaldos` | dueño de la carpeta `<persona_id>/…` o tesorería | subir: dueño en su carpeta; borrar: tesorería |

## RPC (funciones `security definer`, validan rol y escriben evento)

| Función | Quién | Efecto |
| --- | --- | --- |
| `enviar_rendicion(p jsonb)` | solicitante (o tesorería por otro) | Crea o reemplaza (si está `en_revision`/`observada` y es suya) cabecera + líneas + respaldos. Evento Enviada/Reenviada. Observada → en_revision. |
| `aprobar_rendicion(id, p jsonb)` | tesorería | Guarda las correcciones, exige subcuenta/cuenta, asigna folio si no tiene, estado aprobada. |
| `observar_rendicion(id, nota)` / `rechazar_rendicion(id, nota)` | tesorería | Nota obligatoria. |
| `anular_aprobacion(id, nota)` | tesorería | aprobada → en_revision, `aprobacion_anulada = true`, conserva folio. |
| `editar_rendicion(id, p jsonb)` | tesorería | Edición en el libro. Evento "Editada por tesorería". |
| `eliminar_rendicion(id, nota)` / `restaurar_rendicion(id)` | tesorería | Soft delete. |
| `registrar_pago(p jsonb)` | tesorería | Pago/anticipo/devolución + vínculos. |
| `confirmar_conciliacion(p jsonb)` | tesorería | Lote de propuestas aceptadas → pagos con `movimiento_id`. |
| `asignar_rol(persona_id, rol)` | admin | Garantiza un solo tesorero. |
| `marcar_exportadas(ids uuid[])` | tesorería | `exportada = true`. |

## Vistas

- `v_rendiciones` — rendiciones + nombre persona + empresa + nº líneas + nº respaldos + último evento.
- El estado de pago (FIFO) **se calcula en el cliente** con `src/domain/asignacion.ts` (como el prototipo). Si el volumen crece, se porta a una función SQL.

## Migración del historial 2026

- Origen: `CLAUDE/datos/historial_2026/b00..b07.json` (182 rendiciones, 612 líneas, 174 pagos).
- Script `scripts/importar-historial.ts` con service role: crea personas faltantes (códigos de `codes.json`), mapea nombres de catálogo por `norm`, inserta rendiciones `origen = 'Histórico'`, `estado = 'aprobada'`, `folio` = id del lote, evento "Ingresada (historial)", y pagos con `codigo_hist`.
- **Idempotente**: upsert por `folio` / `codigo_hist`. Totales a verificar después de cargar: 45.024.174 CLP rendido y 45.045.931 CLP pagado.
