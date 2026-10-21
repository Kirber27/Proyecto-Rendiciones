<script setup lang="ts">
// Página de muestra del tema (solo desarrollo): sirve para comparar con CLAUDE/app/rendiciones-heca.html
// en claro y oscuro. Datos ficticios.
import { ref } from 'vue'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'

const pestana = ref('rendir')
const pestanas = [
  { id: 'rendir', texto: 'Rendir gastos' },
  { id: 'mias', texto: 'Carpetas' },
  { id: 'aprobar', texto: 'Por aprobar', badge: 3 },
  { id: 'libro', texto: 'Rendiciones' },
  { id: 'personas', texto: 'Personas' },
  { id: 'banco', texto: 'Banco' },
  { id: 'perfiles', texto: 'Perfiles' },
]

const chips = [
  ['ok', 'Aprobada'],
  ['ok', 'Pagada'],
  ['warn', 'Pago parcial'],
  ['warn', 'Reenviada'],
  ['bad', 'Observada'],
  ['bad', 'Rechazada'],
  ['info', 'En revisión'],
  ['info', 'Pendiente de pago'],
  ['muted', 'Ingresada (historial)'],
]

const filas = [
  { folio: 'JPE-012', fecha: '14-10-2026', nombre: 'Juana Pérez', nro: 12, total: '$ 70.389', pagado: '$ 70.389', porPagar: '—', estado: ['ok', 'Pagada'] },
  { folio: 'MSO-004', fecha: '09-10-2026', nombre: 'Mario Soto', nro: 4, total: '$ 182.500', pagado: '$ 50.000', porPagar: '$ 132.500', estado: ['warn', 'Pago parcial'] },
  { folio: 'LRO-031', fecha: '02-10-2026', nombre: 'Laura Rojas', nro: 31, total: '$ 23.990', pagado: '$ 0', porPagar: '$ 23.990', estado: ['info', 'Pendiente de pago'] },
]
const sel = ref('MSO-004')
</script>

<template>
  <header class="app-header">
    <div class="app-wrap d-flex flex-wrap align-items-center gap-2 column-gap-4 py-2">
      <div class="brand">
        <b>Rendiciones Heca</b>
        <small>POE-GLO-FIN-003 · RENDICIÓN DE GASTOS</small>
      </div>
      <nav class="nav nav-pills gap-1 flex-wrap" role="tablist">
        <button
          v-for="p in pestanas"
          :key="p.id"
          type="button"
          role="tab"
          class="nav-link d-inline-flex align-items-center gap-2"
          :class="{ active: pestana === p.id }"
          :aria-selected="pestana === p.id"
          @click="pestana = p.id"
        >
          {{ p.texto }}
          <span v-if="p.badge" class="badge">{{ p.badge }}</span>
        </button>
      </nav>
      <div class="ms-auto">
        <ThemeToggle />
      </div>
    </div>
  </header>

  <main class="app-wrap py-4 d-flex flex-column gap-3">
    <div>
      <h1>Muestra del tema</h1>
      <p class="lead-muted">
        Página de desarrollo para comparar con la maqueta. Cambia el tema con el botón de arriba a la
        derecha.
      </p>
    </div>

    <div class="steps">
      <div><b>1. Sube las fotos</b>Formulario completo y legible, más boletas y facturas.</div>
      <div><b>2. Revisa</b>Los datos aparecen solos. Corrige si algo se leyó mal.</div>
      <div><b>3. Envía</b>Tesorería la aprueba, la ingresa y te avisa aquí cuando se paga.</div>
    </div>

    <div class="drop">
      <button type="button" class="btn btn-primary btn-lg">Sacar o subir fotos</button>
      <span class="small text-body-secondary">JPG, PNG o WebP. Si la boleta llegó en PDF, sube un pantallazo.</span>
      <div class="reading"><span class="dot" /><b>Leyendo la rendición…</b><button type="button" class="btn btn-sm btn-outline-secondary">Detener</button></div>
    </div>

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <h2>Datos del formulario</h2>
        <div class="row g-3">
          <div class="col-12 col-sm-6 col-lg-4">
            <label class="label-caps" for="m-sol">Solicitante</label>
            <select id="m-sol" class="form-select"><option>Juana Pérez</option></select>
          </div>
          <div class="col-12 col-sm-6 col-lg-4">
            <label class="label-caps" for="m-nro">Nº rendición</label>
            <input id="m-nro" class="form-control" value="12" inputmode="numeric" />
          </div>
          <div class="col-12 col-sm-6 col-lg-4">
            <label class="label-caps" for="m-fecha">Fecha</label>
            <input id="m-fecha" class="form-control" type="date" value="2026-10-14" />
          </div>
          <div class="col-12 col-sm-6 col-lg-4">
            <label class="label-caps" for="m-total">Total del formulario</label>
            <input id="m-total" class="form-control num" value="70.389" inputmode="numeric" />
          </div>
          <div class="col-12 col-sm-6 col-lg-4 d-flex align-items-end">
            <div class="form-check">
              <input id="m-check" class="form-check-input" type="checkbox" checked />
              <label class="form-check-label" for="m-check">Por pagar</label>
            </div>
          </div>
        </div>
        <div class="sum">
          <span><b>Suma de gastos </b>$ 70.389</span>
          <span><b>Formulario </b>$ 70.389</span>
          <span class="chip chip-ok">Cuadra</span>
          <span class="chip chip-bad">Diferencia $ 1.200</span>
        </div>
      </div>
    </section>

    <div class="kpis">
      <div class="kpi"><small>Rendiciones</small><b>182</b></div>
      <div class="kpi"><small>Total rendido</small><b>$ 4.502.417</b></div>
      <div class="kpi"><small>Pendiente de pago</small><b>$ 156.490</b></div>
      <div class="kpi"><small>Sin exportar a Excel</small><b>7</b></div>
    </div>

    <div class="table-wrap">
      <table class="table table-hover table-click">
        <thead>
          <tr>
            <th>Folio</th><th>Fecha</th><th>Solicitante</th><th>Nº</th>
            <th class="n">Total</th><th class="n">Pagado</th><th class="n">Por pagar</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="f in filas"
            :key="f.folio"
            tabindex="0"
            :class="{ 'fila-sel': sel === f.folio }"
            @click="sel = f.folio"
          >
            <td class="mono">{{ f.folio }}</td>
            <td class="mono">{{ f.fecha }}</td>
            <td>{{ f.nombre }}</td>
            <td class="mono">{{ f.nro }}</td>
            <td class="n">{{ f.total }}</td>
            <td class="n">{{ f.pagado }}</td>
            <td class="n" :class="{ pos: f.porPagar !== '—' }">{{ f.porPagar }}</td>
            <td><span :class="['chip', 'chip-' + f.estado[0]]">{{ f.estado[1] }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="card">
      <div class="card-body d-flex flex-column gap-3">
        <h2>Botones y chips</h2>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary">Enviar rendición</button>
          <button type="button" class="btn btn-success btn-lg">Aprobar e ingresar</button>
          <button type="button" class="btn btn-outline-secondary">Cerrar</button>
          <button type="button" class="btn btn-outline-danger">Rechazar</button>
          <button type="button" class="btn btn-outline-secondary btn-sm">+ Agregar línea</button>
          <button type="button" class="btn btn-primary" disabled>Deshabilitado</button>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <span v-for="[t, c] in chips" :key="c" :class="['chip', 'chip-' + t]">{{ c }}</span>
        </div>
      </div>
    </section>

    <div class="alert alert-success mb-0">Rendición Nº 12 enviada por $ 70.389. Tesorería la revisará.</div>
    <div class="alert alert-warning mb-0"><b>Revisa esto:</b> la boleta 4471 no está en el formulario.</div>
    <div class="alert alert-danger mb-0">No se pudo leer la rendición. Intenta de nuevo.</div>
    <div class="alert alert-primary mb-0">Se encontraron 3 documento(s) y se armaron 3 línea(s).</div>

    <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
      <div v-for="f in filas" :key="f.folio" class="col">
        <div class="card h-100">
          <div class="card-body d-flex flex-column gap-1">
            <div class="d-flex justify-content-between align-items-baseline gap-2">
              <b>Nº {{ f.nro }} · {{ f.fecha }}</b>
              <span :class="['chip', 'chip-' + f.estado[0]]">{{ f.estado[1] }}</span>
            </div>
            <div class="amt">{{ f.total }}</div>
            <div class="small text-body-secondary">{{ f.folio }} · 2 respaldo(s)</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card empty-state">No hay rendiciones esperando aprobación.</div>
  </main>
</template>
