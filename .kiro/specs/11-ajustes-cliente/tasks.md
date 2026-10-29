# 11 · Ajustes del cliente — Tareas

Requiere: 02 (formulario), 04 (libro), 01 (catálogos y RLS). Una tarea por vez, en el orden del cliente; cada una actualiza primero el steering que toca y termina con `build`, `lint`, `test` (y `db:probar` si hay migración) en verde.

- [x] **11.1 Nº de rendición correlativo** _(R1)_
  - Migración `…0018_nro_correlativo.sql`: `siguiente_nro(persona)`; `enviar_rendicion` asigna el Nº a las nuevas con lock por persona y lo devuelve; aprobar/editar conservan el Nº.
  - `services/rendiciones.siguienteNro`; `RendicionEditor` lo pide al elegir solicitante; `DatosFormulario`: Nº `readonly` ("Elige el solicitante" sin persona).
  - `validarRendicion` / `tieneDatos` ajustados; aviso de éxito con el Nº asignado.
  - Tests: dominio, editor (llena el Nº al elegir persona), RPC en `probar-migraciones` (correlativo y no se pisa en reenvío).
  - Hecho: `_siguiente_nro` con `pg_advisory_xact_lock` por persona; `siguiente_nro` (la persona ve el suyo, tesorería cualquiera); enviar/aprobar/editar ignoran el Nº del payload y, si cambia la persona, toman el siguiente de la nueva. El envío lee el Nº definitivo para el aviso. `database.types.ts` con `siguiente_nro` a mano (regenerar con `db:types` tras el push). 373 tests; `db:probar` OK.

- [x] **11.2 Proveedores: tabla, RPC y precarga** _(R2.2–R2.4, R2.6)_
  - `domain/rut.ts` con tests (normalizar, DV, formatear).
  - Migración `…0019_proveedores.sql`: tabla, `rut_valido`, RLS, RPC (`crear`, `editar`, `eliminar`, `restaurar`, `importar`), `rendicion_lineas.proveedor_id`, precarga desde las líneas y vínculo.
  - `npm run db:types`; pruebas en `probar-migraciones` (permisos por función, duplicado, precarga).
  - Hecho: `normalizar_rut`/`rut_valido` en SQL iguales al dominio; `eliminar_proveedor(id, eliminar)` reemplaza a eliminar + restaurar; precarga en `_precargar_proveedores()` (repetible). El historial no trae RUT: la precarga en producción solo tomará líneas de la app. Tipos agregados a mano en `database.types.ts` (regenerar tras el push). 393 tests; `db:probar` OK.

- [x] **11.3 Vista Proveedores** _(R2.1–R2.5)_
  - Ruta `/proveedores` (todos), store, `ProveedoresView` + `ProveedorForm`.
  - Tesorería: editar, eliminar/restaurar, importar Excel (`domain/proveedores.ts`: columnas, vista previa) con tests.
  - Hecho: `domain/proveedores.ts` (validar, buscar por nombre o RUT, columnas con DV aparte opcional, vista previa nuevos/existentes/errores con Nº de fila), `services/proveedores.ts`, `stores/proveedores.ts` (lo usará el selector de 11.4; se limpia al salir), `components/proveedores/ProveedorForm.vue` (reutilizable en el modal) e `ImportarProveedores.vue`, `ProveedoresView` con búsqueda, paginación de 50, edición en línea y eliminados. Lectura de hojas movida a `services/excel.ts` (`leerFilasHoja`), compartida con Banco. Pestaña Proveedores (orden 8, todos). 413 tests.

- [x] **11.4 Proveedor y RUT en Gastos** _(R2.7–R2.11)_
  - `ProveedorSelect` (combobox con búsqueda) + modal "¿No está? Agrégalo"; RUT automático y `readonly`; tabla y tarjeta móvil.
  - `LineaBorrador.proveedorId`, `limpiarRendicion` lo envía; las RPC de guardado toman nombre y RUT del proveedor (`create or replace` en la migración de 11.2 o una nueva).
  - Validación "elige el proveedor" (no en líneas antiguas sin cambiar).
  - Tests: componente, dominio, editor con línea del historial.
  - Hecho: migración `…0020_lineas_con_proveedor.sql` (`_reemplazar_lineas` con `proveedor_id` y datos del registro; `enviar_rendicion` lo usa y exige proveedor activo). `ProveedorSelect` (Teleport a body, teclado, modal con `ProveedorForm`), RUT de solo lectura con puntos en tabla y tarjeta. `exigirProveedor` solo en Rendir gastos. 419 tests; `db:probar` OK.

- [x] **11.5 Nº doc. único por proveedor** _(R3)_
  - Migración `…0021_documento_unico.sql`: `documento_repetido`, índice, validación en enviar/aprobar/editar.
  - Cliente: comprobación al salir del campo (debounce), duplicados dentro del formulario, `is-invalid` + mensaje; bloquea enviar/aprobar/guardar.
  - Tests: dominio, `LineasTable`, RPC (otro dueño, eliminada/rechazada no cuentan, historial duplicado sin cambiar no bloquea).
  - Hecho: `_clave_documento` + índice parcial, `documento_repetido` (solo sí/no) y la comprobación en `_reemplazar_lineas` (solo líneas nuevas o cambiadas). Cliente: `claveDocumento`, `repetidosEnFormulario`, `useDocumentoRepetido` (espera 400 ms, descarta respuestas viejas), `is-invalid` + `invalid-feedback` en tabla y tarjeta. 426 tests; `db:probar` OK.

- [x] **11.6 IVA calculado** _(R4)_
  - `ivaDe` + `TASA_IVA` con tests; IVA `readonly` y recalculado al cambiar neto/tipo; líneas cargadas conservan el suyo.
  - Hecho: `TASA_IVA`, `ivaDe`, `ivaLinea` en `domain/rendicion.ts`; en `LineasTable` el neto y el tipo pasan por `cambiarNeto`/`cambiarTipo` (en vez de `v-model`) para recalcular solo cuando la persona los toca; IVA `readonly` en tabla y tarjeta. 431 tests (las pruebas de `LineasTable` ahora se desmontan solas: evitaba consultas fantasma entre pruebas).

- [x] **11.7 Impuesto especial** _(R5)_
  - Columna "Imp. especial" (`otros`) después de Exento / monto, en tabla y tarjeta; tests de total y del editor. Documentar `otros` en `data-model.md`.
  - Hecho: columna en la tabla y campo en la tarjeta del celular (junto a Monto o Exento), "Opcional" como ayuda. Sin cambios en base, total, Excel ni PDF.

- [x] **11.8 Nueva subcuenta desde el selector** _(R6)_
  - Migración `…0022_crear_subcuenta.sql` (`es_tesoreria`, duplicado por `norm`); `services/catalogos.crearSubcuenta`; opción "+ Nueva subcuenta…" con modal solo para tesorería.
  - Tests: RPC (solicitante rechazado, duplicado), `LineasTable` (opción visible solo con permiso, cancelar restaura).
  - Hecho: `…0022_crear_subcuenta.sql`; `validarSubcuentaNueva` (dominio), `crearSubcuenta` (servicio), `agregarSubcuenta` (store de catálogos), `NuevaSubcuenta.vue` con "Usar «X»" si ya existe. `AppModal` genérico (también lo usa `ProveedorSelect`). El editor pasa `puedeCrearSubcuenta = auth.esTesoreria`.

- [x] **11.9 KPIs según la búsqueda** _(R7)_
  - `LibroView`: KPIs sobre `visibles`, eliminadas sobre el libro completo, texto "Según la búsqueda". Tests de la vista.
  - Hecho: `filtrando` (búsqueda o filtro ≠ Todas) → `kpisLibro(lista)`; `kpisCompletos` decide el filtro Eliminadas. Aviso "Según la búsqueda y el filtro" bajo las tarjetas.

- [x] **11.10 Excel (búsqueda)** _(R8)_
  - Exportación de la selección sin marcar exportadas, nombre `Rendiciones_busqueda_…`, botón con estado deshabilitado. Tests de store/vista.
  - Hecho: `libro.exportarBusqueda(lista)` (comparte `descargar` con `exportarExcel`), `nombreArchivoExcel(hoy, 'busqueda')`, botón "Excel (búsqueda)" junto a los otros (grupo con `flex-wrap` para el celular). 441 tests.

- [x] **11.12 Nº faltantes del correlativo** _(R1b, pedido 2026-10-29)_
  - Migración `…0023_nro_faltante.sql`: `nros_faltantes`, `_nro_rendicion`; enviar/aprobar/editar aceptan `nro_faltante` si es un faltante de la persona.
  - Cliente: `nrosFaltantes` (servicio), selector de Nº con aviso en `DatosFormulario`, `nroFaltante` en el borrador → `nro_faltante` en el payload.
  - Tests: dominio (payload), editor (faltantes al elegir persona, volver al siguiente), RPC en `probar-migraciones` (acepta faltante, rechaza ocupado o fuera de rango, aprobar/editar).
  - Hecho: `_nros_faltantes` / `nros_faltantes` y `_nro_rendicion` (único lugar donde se decide el Nº, con el lock por persona); enviar/aprobar/editar con `nro_faltante`. En el formulario, con faltantes el Nº es un selector ("43 · siguiente" o "42 · actual" + "4 · faltante") con el aviso debajo; sin faltantes, el campo de solo lectura de siempre. `nros_faltantes` agregado a mano en `database.types.ts` (regenerar tras el push). 446 tests; `db:probar` OK.

- [ ] **11.11 Prueba en producción** — la hace el usuario
  - `npm run db:push` de las migraciones 0018–0023; revisar la precarga de proveedores (cantidad y nombres) y cargar el Excel del cliente.
  - Rendir desde el celular: Nº automático, proveedor de la lista, Nº doc. repetido en rojo, IVA, impuesto especial. Tesorería: nueva subcuenta, búsqueda con KPIs y Excel (búsqueda).
