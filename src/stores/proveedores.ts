// Proveedores (spec 11): lista compartida por la vista Proveedores y el selector de las líneas de gasto.
// Se carga una vez por sesión; cada cambio actualiza la lista sin volver a pedirla entera.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buscarProveedores } from '@/domain/proveedores'
import * as srv from '@/services/proveedores'
import type { Proveedor, ProveedorBase } from '@/types/proveedores'

export const useProveedoresStore = defineStore('proveedores', () => {
  const proveedores = ref<Proveedor[]>([])
  const cargando = ref(false)
  const listo = ref(false)
  const error = ref('')
  let pendiente: Promise<void> | null = null

  /** Carga la lista si aún no está (varias llamadas comparten la misma carga). */
  function cargar(): Promise<void> {
    if (listo.value) return Promise.resolve()
    pendiente ??= (async () => {
      cargando.value = true
      error.value = ''
      try {
        proveedores.value = await srv.listarProveedores()
        listo.value = true
      } catch (e) {
        error.value = (e as Error).message
      } finally {
        cargando.value = false
        pendiente = null
      }
    })()
    return pendiente
  }

  function recargar() {
    listo.value = false
    return cargar()
  }

  function reemplazar(p: Proveedor) {
    const i = proveedores.value.findIndex((x) => x.id === p.id)
    if (i >= 0) proveedores.value.splice(i, 1, p)
    else proveedores.value.push(p)
  }

  async function crear(p: ProveedorBase): Promise<Proveedor> {
    const nuevo = await srv.crearProveedor(p)
    reemplazar(nuevo)
    return nuevo
  }

  async function editar(id: string, p: ProveedorBase): Promise<Proveedor> {
    const editado = await srv.editarProveedor(id, p)
    reemplazar(editado)
    return editado
  }

  async function eliminar(id: string, eliminarlo = true): Promise<void> {
    await srv.eliminarProveedor(id, eliminarlo)
    const p = proveedores.value.find((x) => x.id === id)
    if (p) reemplazar({ ...p, eliminado: eliminarlo })
  }

  async function importar(filas: readonly ProveedorBase[]): Promise<number> {
    const n = await srv.importarProveedores(filas)
    await recargar()
    return n
  }

  /** Al cerrar sesión: olvidar todo. */
  function limpiar() {
    proveedores.value = []
    listo.value = false
    error.value = ''
  }

  /** Los que se pueden elegir, ordenados por nombre. */
  const activos = computed(() =>
    buscarProveedores(
      proveedores.value.filter((p) => !p.eliminado),
      '',
    ),
  )
  const eliminados = computed(() =>
    buscarProveedores(
      proveedores.value.filter((p) => p.eliminado),
      '',
    ),
  )

  return {
    proveedores,
    cargando,
    listo,
    error,
    activos,
    eliminados,
    cargar,
    recargar,
    crear,
    editar,
    eliminar,
    importar,
    limpiar,
  }
})
