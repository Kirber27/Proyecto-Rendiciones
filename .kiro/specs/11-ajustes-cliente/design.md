# 11 · Ajustes del cliente — Diseño

## Resumen de cambios

| Punto | Base de datos | Dominio | UI |
| --- | --- | --- | --- |
| 1 Nº correlativo | RPC `siguiente_nro(persona)`; `enviar_rendicion` asigna el Nº en las nuevas | `validarRendicion` ya no exige Nº escrito en las nuevas | `DatosFormulario`: Nº solo lectura |
| 2-3 Proveedores | tabla `proveedores`, `rendicion_lineas.proveedor_id`, RPC, precarga | `rut.ts` (normalizar, DV), `proveedores.ts` (importación) | `ProveedoresView`, `ProveedorSelect` |
| 4 Nº doc. único | RPC `documento_repetido`; validación en las RPC de guardado | `documentosRepetidos` (dentro del formulario) | `LineasTable`: `is-invalid` + mensaje |
| 5 IVA | — | `ivaDe(neto)` | IVA solo lectura |
| 6 Imp. especial | — (usa `otros`) | — (ya suma) | columna nueva |
| 7 Nueva subcuenta | RPC `crear_subcuenta` | — | opción en el selector (tesorería) |
| 8 KPIs filtrados | — | `kpisLibro` sobre las filas visibles | `LibroView` |
| 9 Excel (búsqueda) | — | — | botón + `exportarExcel` con selección |

Migraciones nuevas (una por cambio de esquema, sin tocar las aplicadas):

- `20261027000018_nro_correlativo.sql`
- `20261027000019_proveedores.sql`
- `20261027000020_lineas_con_proveedor.sql`
- `20261027000021_documento_unico.sql`
- `20261027000022_crear_subcuenta.sql`

Cada una se prueba con `npm run db:probar` (PGlite) antes de `db:push`.

## 1. Nº correlativo

```sql
-- Mayor Nº de la persona + 1. Solicitante: solo la suya; tesorería: cualquiera.
create function siguiente_nro(p_persona uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select coalesce(max(nro), 0) + 1 from rendiciones where persona_id = p_persona
$$;  -- con chequeo: p_persona = mi_persona_id() or es_tesoreria(), si no, excepción
```

- `enviar_rendicion` (`create or replace`): si es **nueva** (sin `id`), ignora el `nro` del payload y usa `siguiente_nro` dentro de la transacción, con `pg_advisory_xact_lock(hashtext(persona_id::text))` para serializar envíos de la misma persona. En un reenvío conserva el Nº guardado. Devuelve el Nº asignado junto al id.
- `aprobar_rendicion` / `editar_rendicion`: ignoran cambios de `nro` (se conserva).
- Cliente: `services/rendiciones.ts` → `siguienteNro(personaId)`. `RendicionEditor` lo pide al cambiar `personaId` en un borrador sin `id` (y al cargar uno con persona fija). `d.nro` se llena con el resultado; si falla, queda vacío y el envío lo asigna igual.
- `validarRendicion`: en borradores sin `id` el Nº ya no es obligatorio (lo asigna el servidor); con `id` sigue igual.
- `tieneDatos`: no cuenta el Nº (ahora se llena solo).

## 2-3. Proveedores

### Esquema

```sql
create table proveedores (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (btrim(nombre) <> ''),
  rut          text not null unique check (rut ~ '^[0-9]{1,8}-[0-9K]$'),  -- normalizado
  creado_por   uuid references auth.users default auth.uid(),
  creado_en    timestamptz not null default now(),
  eliminado_en timestamptz
);
alter table rendicion_lineas add column proveedor_id uuid references proveedores;
```

- Las líneas **conservan** `proveedor` y `rut` de texto (copia al momento de rendir): el Excel, el PDF y el historial siguen leyendo esos campos. `proveedor_id` es el vínculo.
- RLS: `select` autenticado (activos; eliminados solo tesorería). Sin insert/update/delete directo.
- RPC:
  - `crear_proveedor(nombre, rut)` — cualquier autenticado; valida DV en SQL (función `rut_valido(text)`), normaliza, rechaza duplicado con el nombre existente. Devuelve la fila.
  - `editar_proveedor(id, nombre, rut)`, `eliminar_proveedor(id, eliminar = true)` (con `false` restaura) — `es_tesoreria()`.
  - `importar_proveedores(filas jsonb)` — `es_tesoreria()`; inserta con `on conflict (rut) do nothing`; devuelve cuántos insertó.
- **Precarga** (en la misma migración, función `_precargar_proveedores()` para poder probarla): por cada RUT válido normalizado de `rendicion_lineas`, el nombre (espacios colapsados) más frecuente; `insert … on conflict do nothing`; luego `update rendicion_lineas set proveedor_id` por RUT normalizado. Nota: el historial 2026 no trae RUT ni proveedor (612 líneas vacías), así que solo aporta líneas enviadas desde la app; la lista se llena sobre todo con el Excel del cliente.
- Migración `…0020`: `_reemplazar_lineas` (ahora usada también por `enviar_rendicion`) acepta `proveedor_id` por línea; si viene, **sobrescribe** `proveedor` y `rut` con los del proveedor (la fuente es la tabla, no el cliente) y rechaza ids inexistentes. `enviar_rendicion` exige además un proveedor activo en cada línea; aprobar y editar no (historial).

### Dominio

- `src/domain/rut.ts`: `normalizarRut("12.345.678-k") → "12345678-K"`, `dvRut(cuerpo)`, `rutValido`, `formatearRut("12345678-K") → "12.345.678-K"` (para mostrar). Tests con RUT ficticios.
- `src/domain/proveedores.ts`: `detectarColumnasProveedores(encabezados)`, `previsualizarImportacion(filas, existentes) → { nuevos, existentes, errores }` (reutiliza la lectura de hojas de `cartola.ts`/`services/excel.ts`), `buscarProveedores(lista, q)` por `norm(nombre)` o RUT sin puntos.

### UI

- Ruta `/proveedores`, `meta: { roles: '*', pestana: { texto: 'Proveedores', orden: 8 } }`.
- `ProveedoresView`: buscador, botón "Agregar proveedor" (formulario en línea: nombre + RUT), tabla nombre / RUT / acciones. Tesorería: Editar (en línea), Eliminar (`ConfirmInline`), ver eliminados y "Importar Excel" (carga diferida de xlsx → mapeo de columnas → vista previa en tres grupos → Confirmar).
- Store `useProveedoresStore`: lista (activos/eliminados), `crear`, `editar`, `eliminar(id, eliminar)`, `importar` (recarga); se limpia al cerrar sesión.
- `components/rendicion/ProveedorSelect.vue`: combobox accesible (input con búsqueda + lista, `role="combobox"`/`listbox`, flechas/Enter/Escape), usable en móvil. La lista se dibuja con `Teleport` a `<body>` y posición fija (si no, la recorta el scroll de `.table-wrap`), muestra hasta 30 coincidencias. Emite el proveedor elegido. Al final de la lista: "¿No está? Agrégalo en Proveedores", que abre un **modal** con el mismo formulario de alta (componente `ProveedorForm` compartido con la vista) — así no se sale del formulario de rendición; al crearlo, queda elegido.
- `LineaBorrador` suma `proveedorId: string | null`. Al elegir: `proveedorId`, `proveedor = nombre`, `rut = rut`. RUT se muestra con `formatearRut`, `readonly`.
- Líneas antiguas sin `proveedorId`: el combobox muestra el texto guardado con la marca "(sin registrar)"; `validarRendicion` exige `proveedorId` en todas las líneas solo con `exigirProveedor` (Rendir gastos). Por aprobar y el libro no lo exigen.

## 4. Nº doc. único

```sql
-- true si existe otra línea (no eliminada/rechazada) con el mismo RUT + tipo + Nº.
create function documento_repetido(p_rut text, p_tipo tipo_documento, p_numero text,
                                   p_excluir uuid default null) returns boolean
  language sql stable security definer set search_path = public as $$ … $$;
```

- Compara `rut` normalizado y `upper(btrim(numero))`; ignora `numero = ''`; excluye la rendición `p_excluir` (la que se está editando). Solo devuelve booleano (no expone datos de otras personas).
- Índice de apoyo: `create index on rendicion_lineas (rut, tipo, upper(btrim(numero))) where numero <> ''`. **No** índice único: el historial puede tener duplicados (R3.6).
- La comprobación va en `_reemplazar_lineas` (enviar, aprobar y editar): las líneas cuya clave no estaba ya guardada en esa rendición se comparan con `documento_repetido(…, rendición)` y entre sí. Errores: `Línea N: este Nº de documento ya está cargado para este proveedor.` / `Línea N: repite el Nº de documento de otra línea.`
- Cliente: composable `useDocumentoRepetido` (usado por `LineasTable`): cuando cambia la clave de una línea (RUT, tipo o Nº) quita la marca y consulta `documentoRepetido` con espera de 400 ms; el resultado queda en `LineaBorrador.numeroRepetido` (no se envía). Un formulario nuevo o borrador recuperado se revisa entero al abrir; una rendición guardada solo en lo que cambie. `domain/rendicion.ts → claveDocumento` y `repetidosEnFormulario` cubren R3.3 sin red; `validarRendicion` agrega los dos mensajes por línea (así las tres pantallas lo validan sin cambios).
- Campo con `is-invalid` + `<div class="invalid-feedback">` (escritorio y tarjeta móvil).

## 5. IVA

- `domain/rendicion.ts`: `TASA_IVA = 0.19`, `ivaDe(neto) = Math.round(num(neto) * TASA_IVA)`.
- `LineasTable`: el neto y el tipo se actualizan con `cambiarNeto`/`cambiarTipo`, que asignan `l.iva = ivaLinea(l)` (texto "1.900"; vacío fuera de Factura); el input IVA es `readonly`. Al cambiar el tipo a no-factura → `iva = ''`, y a Factura → recalcular. Las líneas cargadas mantienen su IVA hasta que se toque neto o tipo (R4.3).
- El servidor no recalcula (las líneas del historial pueden traer IVA con otro redondeo).

## 6. Impuesto especial

- Columna "Imp. especial" (`MoneyInput v-model="l.otros"`) después de "Exento / monto", en la tabla y en la tarjeta móvil. `aria-label="Impuesto especial línea N"`.
- Sin cambios en base, `totalLinea`, `limpiarRendicion` (ya envían `otros`), Excel (`exento + otros` en Monto Exento para facturas; en no-facturas el total de la línea) ni PDF.
- `rendicion_lineas.otros` se documenta en `data-model.md` como "impuesto especial".

## 7. Nueva subcuenta

```sql
create function crear_subcuenta(p_nombre text, p_cuenta smallint default null) returns subcuentas
  -- es_tesoreria(); nombre btrim no vacío; si existe una con norm(nombre) igual → excepción con su nombre;
  -- id = max(id)+1, orden = max(orden)+1, activa = true, cuenta_sugerida_id = p_cuenta.
```

- Hoy `norm` existe en SQL (trigger de `personas.nombre_norm`); se reutiliza.
- `LineasTable` (prop `puedeCrearSubcuenta`): última opción `value="__nueva"` "+ Nueva subcuenta…". Al elegirla se abre un modal (nombre + cuenta sugerida opcional); al crear, `catalogos` agrega la subcuenta y la línea queda con ella (y su cuenta). Si el usuario cancela, la línea vuelve a la subcuenta anterior.
- Grafía: se guarda tal como se escribe tras `btrim` (las nuevas no tienen espacios finales del Excel original).

## 8. KPIs según la búsqueda

- `LibroView`: `const kpis = computed(() => kpisLibro(visibles.value, porRendicion.value))`, donde `visibles` es la lista filtrada (todas las páginas). La cantidad de eliminadas (que decide si aparece el filtro "Eliminadas") se calcula siempre sobre el libro completo (`kpisLibro(libro.filas…).eliminadas` o un `computed` aparte).
- Con el filtro "Eliminadas", las tarjetas muestran 0 (solo cuentan aprobadas), lo que es correcto.
- Texto "Según la búsqueda" (`text-body-secondary small`) cuando `buscar` o `filtro !== 'Todas'`.

## 9. Excel (búsqueda)

- Store `libro`: `exportarExcel(modo: 'nuevas' | 'todas' | { ids: string[] })` o una función nueva `exportarSeleccion(filas)`, que reutiliza `rendicionesParaExcel` + `filasExcel` + `descargarExcel` sin `marcarExportadas`.
- `nombreArchivoExcel(hoy, 'busqueda')` → `Rendiciones_busqueda_YYYY-MM-DD.xlsx`.
- Botón `Excel (búsqueda)` con el ícono de Excel, deshabilitado según R8.4. Mensaje: "Excel con N rendición(es) y M línea(s) de la búsqueda."

## Pantallas afectadas por el formulario

`RendicionEditor` se usa en Rendir gastos, Por aprobar y el detalle del libro: los puntos 1 a 7 aplican en las tres. Revisar en cada una el ancho de la tabla (dos columnas más de solo lectura y una nueva) y la tarjeta móvil.

## Steering a actualizar

- `business-rules.md`: Nº correlativo asignado por el servidor; IVA calculado; impuesto especial; proveedor de la lista + RUT; Nº doc. único por proveedor; nueva subcuenta (tesorería); KPIs y Excel de la búsqueda.
- `data-model.md`: tabla `proveedores`, `rendicion_lineas.proveedor_id`, `otros` = impuesto especial, RPC nuevas.
- `product.md`: pantalla Proveedores.
- `structure.md`: `rut.ts`, `proveedores.ts`, `ProveedoresView`, `ProveedorSelect`, `ProveedorForm`.
