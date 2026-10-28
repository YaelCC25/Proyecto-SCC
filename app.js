/* Control de Inventario - versión visual (datos ficticios en memoria).
   Cuando conectes Supabase, reemplaza BIENES/CUSTODIOS por consultas a la base. */
const $ = (s, r = document) => r.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CUSTODIOS = [
  { id: 1, nombre: 'Ana Torres', empleado: 'E-1001', area: 'Sistemas' },
  { id: 2, nombre: 'Luis Ramírez', empleado: 'E-1002', area: 'Laboratorios' },
  { id: 3, nombre: 'Marta Solís', empleado: 'E-1003', area: 'Administración' },
  { id: 4, nombre: 'Jorge Peña', empleado: 'E-1004', area: 'Biblioteca' }];
const DESC = ['Equipo de cómputo', 'Monitor', 'Escritorio', 'Silla ergonómica', 'Proyector', 'Impresora', 'Archivero', 'Mesa de trabajo'];
const UBIC = ['Laboratorio 2', 'Oficina 5', 'Biblioteca', 'Aula 3', 'Almacén'];
/* Lugares de la facultad. Edita esta lista con los reales (o se completa al importar la base). */
const LUGARES = ['Laboratorio 1', 'Laboratorio 2', 'Laboratorio 3', 'Oficina 5', 'Oficina 9', 'Biblioteca', 'Aula 1', 'Aula 2', 'Aula 3', 'Almacén', 'Sala de maestros', 'Dirección', 'Cubículo 1', 'Cubículo 2'];
let BIENES = Array.from({ length: 48 }, (_, i) => ({
  inv: 'INV-' + String(100 + i).padStart(5, '0'), desc: DESC[i % DESC.length], custodio: CUSTODIOS[i % 4].id,
  ubic: UBIC[i % UBIC.length], estado: 'pendiente', obs: ''
}));
// Cada bien inicia sin verificar y conserva una sola ubicación vigente: ubic.
const ESTADOS = { encontrado: 'Encontrado', no: 'No encontrado', pendiente: 'Pendiente de verificar' };
const COLOR = { encontrado: '--ok', no: '--no', pendiente: '--pen' };
const RUTAS = { panel: 'Panel principal', importar: 'Importar base', levantamiento: 'Levantamiento', custodios: 'Custodios', reportes: 'Reportes' };
const PERMISOS = { Administrador: Object.keys(RUTAS), 'Responsable de inventario': Object.keys(RUTAS), Verificador: ['panel', 'levantamiento', 'custodios'] };
let user = null, chart = null;

const cust = id => CUSTODIOS.find(c => c.id == id)?.nombre ?? '—';
const conteo = (lista = BIENES) => {
  const c = { encontrado: 0, no: 0, pendiente: 0 }; lista.forEach(b => c[b.estado]++); return c;
};
const badge = e => `<span class="st ${e}">${ESTADOS[e]}</span>`;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2600); }
const barra = c => {
  const n = Object.values(c).reduce((total, cantidad) => total + cantidad, 0) || 1;
  return `<div class="bar" role="img" aria-label="Avance del levantamiento">${Object.keys(c).map(k => `<i style="width:${c[k] / n * 100}%;background:var(${COLOR[k]})"></i>`).join('')}</div>
     <div class="legend">${Object.keys(c).map(k => `<span><span class="dot" style="background:var(${COLOR[k]})"></span>${ESTADOS[k]}: ${c[k]}</span>`).join('')}</div>`;
};

/* ---------- Login y navegación ---------- */
$('#l-ok').onclick = () => {
  if (!$('#l-correo').value) return toast('Escribe tu correo');
  user = { correo: $('#l-correo').value, rol: $('#l-rol').value };
  $('#login').hidden = true; $('#app').hidden = false;
  $('#u-info').textContent = user.correo + ' · ' + user.rol;
  $('#nav').innerHTML = PERMISOS[user.rol].map(r => `<a href="#${r}" data-r="${r}">${RUTAS[r]}</a>`).join('');
  route();
};
$('#salir').onclick = () => { user = null; $('#app').hidden = true; $('#login').hidden = false; };
addEventListener('hashchange', () => user && route());
function route() {
  let r = location.hash.slice(1) || 'panel';
  if (!PERMISOS[user.rol].includes(r)) { r = 'panel'; toast('Tu rol no tiene acceso a esa sección'); }
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  $('#ayuda-levantamiento').hidden = r !== 'levantamiento';
  $('#titulo').textContent = RUTAS[r]; $('#vista').innerHTML = ''; VISTAS[r]();
}

/* ---------- Vistas ---------- */
const VISTAS = {
  panel() {
    const c = conteo(), n = BIENES.length, av = n ? Math.round((n - c.pendiente) / n * 100) : 0;
    $('#vista').innerHTML = `
     <div class="stats">
       <div class="stat"><b>${n}</b><span>Bienes del ejercicio</span></div>
       <div class="stat"><b>${n - c.pendiente}</b><span>Verificados</span></div>
       <div class="stat"><b>${c.pendiente}</b><span>Pendientes</span></div>
       <div class="stat"><b>${av}%</b><span>Avance</span></div></div>
     <div class="card"><h3>Estado del levantamiento</h3>${barra(c)}</div>
     <div class="actions">
       <a href="#importar"><b>Importar base</b><span>Cargar Excel o CSV</span></a>
       <a href="#levantamiento"><b>Levantar inventario</b><span>Revisar bienes por ubicación</span></a>
       <a href="#custodios"><b>Custodios</b><span>Consultar asignaciones</span></a>
       <a href="#reportes"><b>Reportes</b><span>Consultar resultados</span></a></div>`;
  },

  importar() {
    $('#vista').innerHTML = `
     <div class="note">Importar no es verificar: los bienes nuevos quedan en estado Pendiente.</div>
     <div class="card"><h3>Archivo</h3>
       <div class="drop" id="drop"><p><b>Arrastra tu archivo aquí</b></p><p class="muted small">Formatos admitidos: Excel (.xlsx) y CSV</p>
       <button class="btn" type="button" id="pick">Seleccionar archivo</button>
       <input type="file" id="file" accept=".xlsx,.xls,.csv" hidden></div></div>
     <div id="prev"></div>`;
    const d = $('#drop'), f = $('#file');
    $('#pick').onclick = () => f.click();
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
    d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); leer(e.dataTransfer.files[0]); };
    f.onchange = () => leer(f.files[0]);
  },

  levantamiento() {
    $('#vista').innerHTML = `
      <div class="card ubicacion-selector">
        <label for="fu">Ubicación que vas a revisar</label>
        <select id="fu" aria-describedby="ubicacion-ayuda"></select>
        <p class="muted small" id="ubicacion-ayuda">Selecciona un lugar para ver todos sus bienes y registrar la verificación.</p>
      </div>
      <div id="resumen-ubicacion" aria-live="polite"></div>
      <div id="controles-ubicacion" hidden>
        <div class="tools filtros-levantamiento">
          <label>Buscar bien<input id="q" type="search" placeholder="Número de inventario o descripción"></label>
          <label>Custodio<select id="fc"><option value="">Todos los custodios</option>${CUSTODIOS.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></label>
          <label>Estado<select id="fe"><option value="">Todos los estados</option>${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        </div>
        <details class="card buscar-otro">
          <summary>Buscar bien de otra ubicación</summary>
          <p class="muted small">Busca un bien para moverlo a la ubicación seleccionada. Después puedes registrar su verificación.</p>
          <label>Inventario o descripción<input id="q-otro" type="search" placeholder="Buscar en las demás ubicaciones"></label>
          <div id="resultados-otro" aria-live="polite"></div>
        </details>
      </div>
      <p class="muted small" id="cantidad-bienes" role="status"></p>
      <div class="card" id="lista"></div>`;

    const selector = $('#fu');
    const actualizarLugares = (seleccion = '') => {
      const lugares = lugaresDisponibles();
      if (BIENES.some(b => !b.ubic)) lugares.push('Sin ubicación');
      selector.innerHTML = '<option value="">Selecciona una ubicación para comenzar</option>' + lugares.map(l => {
        const n = BIENES.filter(b => ubicacion(b) === l).length;
        return `<option value="${esc(l)}">${esc(l)} (${n})</option>`;
      }).join('');
      selector.value = seleccion;
    };
    const pintarOtros = () => {
      const q = $('#q-otro').value.trim().toLocaleLowerCase('es');
      const resultados = $('#resultados-otro');
      if (!q) { resultados.innerHTML = '<p class="muted small">Escribe el inventario o la descripción del bien que encontraste.</p>'; return; }
      const otros = BIENES.map((b, i) => [b, i]).filter(([b]) => ubicacion(b) !== selector.value && `${b.inv} ${b.desc}`.toLocaleLowerCase('es').includes(q));
      resultados.innerHTML = otros.map(([b, i]) => `<div class="item resultado-otro">
        <div><h4>${esc(b.inv)} · ${esc(b.desc)}</h4><span class="muted small">Ubicación: ${esc(ubicacion(b))} · Custodio: ${esc(cust(b.custodio))}</span></div>
        <button type="button" class="btn" data-traer="${i}">Mover a ${esc(selector.value)}</button>
      </div>`).join('') || '<p class="muted small">No hay coincidencias en otras ubicaciones.</p>';
    };
    const pintar = () => {
      const lugar = selector.value;
      $('#controles-ubicacion').hidden = !lugar;
      if (!lugar) {
        $('#resumen-ubicacion').innerHTML = '';
        $('#cantidad-bienes').textContent = '';
        $('#lista').innerHTML = '<div class="estado-vacio"><h3>Comienza por una ubicación</h3><p class="muted">Elige el lugar que vas a revisar en el selector de arriba.</p></div>';
        return;
      }
      const bienesLugar = BIENES.filter(b => ubicacion(b) === lugar), c = conteo(bienesLugar);
      const avance = bienesLugar.length ? Math.round((bienesLugar.length - c.pendiente) / bienesLugar.length * 100) : 0;
      $('#resumen-ubicacion').innerHTML = `<h3 class="titulo-ubicacion">Levantamiento de ${esc(lugar)}</h3>
        <div class="stats">
          <div class="stat"><b>${bienesLugar.length}</b><span>Bienes en esta ubicación</span></div>
          <div class="stat"><b>${c.pendiente}</b><span>Pendientes de verificar</span></div>
          <div class="stat"><b>${c.encontrado}</b><span>Encontrados</span></div>
          <div class="stat"><b>${c.no}</b><span>No encontrados</span></div>
          <div class="stat"><b>${avance}%</b><span>Avance de verificación</span></div>
        </div>`;
      const q = $('#q').value.trim().toLocaleLowerCase('es'), fc = $('#fc').value, fe = $('#fe').value;
      const lista = BIENES.map((b, i) => [b, i]).filter(([b]) => ubicacion(b) === lugar &&
        (!q || `${b.inv} ${b.desc}`.toLocaleLowerCase('es').includes(q)) && (!fc || b.custodio == fc) && (!fe || b.estado === fe));
      $('#cantidad-bienes').textContent = `Mostrando ${lista.length} de ${bienesLugar.length} bienes en ${lugar}.`;
      $('#lista').innerHTML = lista.map(([b, i]) => `<article class="bien" data-bien="${esc(b.inv)}">
        <div class="bien-cabecera"><h4>${esc(b.inv)} · ${esc(b.desc)}</h4>${badge(b.estado)}</div>
        <p class="ubicacion-bien">Ubicación: <strong>${esc(ubicacion(b))}</strong></p>
        <p class="muted small">Custodio: ${esc(cust(b.custodio))}</p>
        <div class="choices" role="group" aria-label="Verificación de ${esc(b.inv)}">${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" class="btn ${b.estado === k ? 'sel' : ''}" aria-pressed="${b.estado === k}" data-i="${i}" data-e="${k}">${v}</button>`).join('')}</div>
        <label class="observaciones-bien">Observaciones<input data-o="${i}" value="${esc(b.obs)}" placeholder="Notas de la revisión"></label>
        ${bloqueUbic(b, i)}
      </article>`).join('') || `<div class="estado-vacio"><p class="muted">${bienesLugar.length ? 'Ningún bien coincide con los filtros seleccionados.' : 'Esta ubicación todavía no tiene bienes. Puedes buscar uno de otra ubicación para moverlo aquí.'}</p></div>`;
      pintarOtros();
    };
    const mover = (i, destino) => {
      const b = BIENES[i];
      const lugar = registrarLugar(destino);
      if (!lugar) return toast('Selecciona o escribe una ubicación');
      if (b.ubic === lugar) return toast('El bien ya está en esa ubicación');
      b.ubic = lugar;
      // Cambiar de ubicación y verificar son acciones independientes.
      actualizarLugares(lugar);
      ['#q', '#fc', '#fe', '#q-otro'].forEach(s => $(s).value = '');
      pintar();
      toast(`${b.inv}: ubicación actualizada a ${lugar}`);
    };
    selector.onchange = () => {
      ['#q', '#fc', '#fe', '#q-otro'].forEach(s => $(s).value = '');
      pintar();
    };
    ['#q', '#fc', '#fe'].forEach(s => $(s).oninput = pintar);
    $('#q-otro').oninput = pintarOtros;
    $('#resultados-otro').onclick = e => {
      const boton = e.target.closest('[data-traer]');
      if (boton && selector.value && selector.value !== 'Sin ubicación') mover(Number(boton.dataset.traer), selector.value);
      else if (boton) toast('Selecciona una ubicación de destino');
    };
    $('#lista').onclick = e => {
      const boton = e.target.closest('[data-e]'); if (!boton) return;
      BIENES[boton.dataset.i].estado = boton.dataset.e;
      pintar(); toast('Verificación registrada: ' + ESTADOS[boton.dataset.e]);
    };
    $('#lista').onchange = e => {
      if (!e.target.matches('[data-destino]')) return;
      const form = e.target.closest('form'), manual = e.target.value === '__nuevo';
      const campo = $('[data-nombre-lugar]', form);
      campo.hidden = !manual;
      $('input', campo).disabled = !manual;
      if (manual) $('input', campo).focus();
    };
    $('#lista').onsubmit = e => {
      const form = e.target.closest('[data-mover]'); if (!form) return;
      e.preventDefault();
      const destino = $('[data-destino]', form).value;
      const nombre = destino === '__nuevo' ? $('[name="nuevo-lugar"]', form).value : destino;
      mover(Number(form.dataset.mover), nombre);
    };
    $('#lista').oninput = e => {
      if (e.target.dataset.o !== undefined) BIENES[e.target.dataset.o].obs = e.target.value;
    };
    actualizarLugares(); pintar();
  },

  custodios() {
    $('#vista').innerHTML = `
     <div class="tools"><input id="q" type="search" placeholder="Buscar por nombre, empleado o área" aria-label="Buscar"></div>
     <div class="card tbl"><table><thead><tr><th>Nombre</th><th>Empleado</th><th>Área</th><th>Bienes</th><th>Pendientes</th></tr></thead><tbody id="tb"></tbody></table></div>
     <div class="card" id="det" hidden></div>`;
    const pintar = () => {
      const q = $('#q').value.toLowerCase();
      $('#tb').innerHTML = CUSTODIOS.filter(c => (c.nombre + c.empleado + c.area).toLowerCase().includes(q)).map(c => {
        const l = BIENES.filter(b => b.custodio == c.id);
        return `<tr><td><button class="link" data-c="${c.id}">${esc(c.nombre)}</button></td><td>${esc(c.empleado)}</td><td>${esc(c.area)}</td><td>${l.length}</td><td>${l.filter(b => b.estado === 'pendiente').length}</td></tr>`;
      }).join('');
    };
    $('#q').oninput = pintar; pintar();
    $('#tb').onclick = e => {
      const id = e.target.dataset.c; if (!id) return;
      const d = $('#det'); d.hidden = false;
      d.innerHTML = `<h3>Bienes de ${esc(cust(id))}</h3><div class="tbl"><table><thead><tr><th>Inventario</th><th>Descripción</th><th>Ubicación</th><th>Estado</th></tr></thead><tbody>${BIENES.filter(b => b.custodio == id).map(b => `<tr><td>${esc(b.inv)}</td><td>${esc(b.desc)}</td><td>${esc(ubicacion(b))}</td><td>${badge(b.estado)}</td></tr>`).join('')}</tbody></table></div>`;
    };
  },

  reportes() {
    const c = conteo();
    const fila = (n, l) => { const k = conteo(l); return `<tr><td>${esc(n)}</td><td>${l.length}</td><td>${k.encontrado}</td><td>${k.no}</td><td>${k.pendiente}</td></tr>`; };
    const disc = BIENES.filter(b => b.estado === 'no');
    $('#vista').innerHTML = `
     <div class="tools"><button class="btn primary" id="csv">Exportar discrepancias (CSV)</button></div>
     <div class="card"><h3>Resultados generales</h3><div style="max-width:420px;height:240px"><canvas id="ch"></canvas></div></div>
     <div class="card tbl"><h3>Resultados por custodio</h3><table><thead><tr><th>Custodio</th><th>Total</th><th>Encontrados</th><th>No encontrados</th><th>Pendientes</th></tr></thead><tbody>
       ${CUSTODIOS.map(x => fila(x.nombre, BIENES.filter(b => b.custodio == x.id))).join('')}</tbody></table></div>
     <div class="card tbl"><h3>Bienes con discrepancias (${disc.length})</h3><table><thead><tr><th>Inventario</th><th>Descripción</th><th>Custodio</th><th>Estado</th><th>Ubicación</th></tr></thead><tbody>
       ${disc.map(b => `<tr><td>${esc(b.inv)}</td><td>${esc(b.desc)}</td><td>${esc(cust(b.custodio))}</td><td>${badge(b.estado)}</td><td>${esc(ubicacion(b))}</td></tr>`).join('')}</tbody></table></div>`;
    const css = getComputedStyle(document.documentElement);
    if (chart) chart.destroy();
    chart = new Chart($('#ch'), {
      type: 'doughnut', data: {
        labels: Object.values(ESTADOS),
        datasets: [{ data: Object.keys(c).map(k => c[k]), backgroundColor: Object.keys(c).map(k => css.getPropertyValue(COLOR[k]).trim()), borderWidth: 0 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: css.getPropertyValue('--ink').trim() } } } }
    });
    $('#csv').onclick = () => {
      const filas = [['Inventario', 'Descripcion', 'Custodio', 'Estado', 'Ubicacion', 'Observaciones'],
      ...disc.map(b => [b.inv, b.desc, cust(b.custodio), ESTADOS[b.estado], ubicacion(b), b.obs])];
      const txt = '\ufeff' + filas.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' }));
      a.download = 'discrepancias-2026.csv'; a.click();
    };
  }
};

// Todas las vistas consultan ubic; no existe una segunda ubicación por bien.
const ubicacion = b => b.ubic || 'Sin ubicación';
function lugaresDisponibles() {
  return [...new Set([...LUGARES, ...BIENES.map(b => b.ubic)].map(l => String(l ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}
function registrarLugar(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return '';
  const existente = lugaresDisponibles().find(l => l.toLocaleLowerCase('es') === limpio.toLocaleLowerCase('es'));
  if (existente) return existente;
  LUGARES.push(limpio);
  return limpio;
}
function bloqueUbic(b, i) {
  return `<details class="cambiar-ubicacion"><summary>Cambiar ubicación</summary>
    <form class="form-ubicacion" data-mover="${i}">
      <label>Ubicación de destino<select data-destino required>
        <option value="" ${b.ubic ? '' : 'selected'} disabled>Selecciona una ubicación</option>
        ${lugaresDisponibles().map(l => `<option value="${esc(l)}" ${b.ubic === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        <option value="__nuevo">Otro: no está en la lista (escribir)</option>
      </select></label>
      <label data-nombre-lugar hidden>Nombre de la ubicación<input name="nuevo-lugar" placeholder="Ej. Bodega externa" required disabled></label>
      <p class="muted small">Al guardar, el bien aparecerá únicamente en el destino y se abrirá esa ubicación. Su estado de verificación se conserva.</p>
      <button class="btn primary" type="submit">Guardar ubicación</button>
    </form>
  </details>`;
}

/* ---------- Importación: lectura, mapeo y vista previa ---------- */
const CAMPOS = [['inv', 'Número de inventario'], ['desc', 'Descripción'], ['custodio', 'Custodio'], ['ubic', 'Ubicación']];
function leer(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!filas.length) return toast('El archivo no tiene registros');
      vistaPrevia(filas, file.name);
    } catch { toast('No se pudo leer el archivo'); }
  };
  rd.readAsArrayBuffer(file);
}
function vistaPrevia(filas, nombre) {
  const cols = Object.keys(filas[0]);
  const adivina = k => cols.find(c => c.toLowerCase().includes(k)) || '';
  const sug = { inv: adivina('inv') || adivina('num'), desc: adivina('desc'), custodio: adivina('custod') || adivina('resp'), ubic: adivina('ubic') };
  $('#prev').innerHTML = `
     <div class="card"><h3>Relacionar columnas de ${esc(nombre)}</h3><div class="grid2">
       ${CAMPOS.map(([k, t]) => `<label>${t}<select data-k="${k}"><option value="">(no importar)</option>${cols.map(c => `<option ${sug[k] === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`).join('')}</div></div>
     <div class="card" id="res"></div>
     <div class="card tbl"><h3>Vista previa (primeras 5 filas)</h3><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
       ${filas.slice(0, 5).map(r => `<tr>${cols.map(c => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const resumen = () => {
    const m = {}; document.querySelectorAll('[data-k]').forEach(s => m[s.dataset.k] = s.value);
    const ids = m.inv ? filas.map(r => String(r[m.inv]).trim()) : [];
    const vistos = new Set(), dup = new Set(); ids.forEach(i => vistos.has(i) ? dup.add(i) : vistos.add(i));
    const vacios = ids.filter(i => !i).length, existentes = ids.filter(i => BIENES.some(b => b.inv === i)).length;
    $('#res').innerHTML = `<h3>Resumen antes de confirmar</h3>
         <div class="stats"><div class="stat"><b>${filas.length}</b><span>Registros leídos</span></div>
         <div class="stat"><b>${ids.length ? ids.length - existentes - vacios : 0}</b><span>Bienes nuevos</span></div>
         <div class="stat"><b>${existentes}</b><span>Ya existen</span></div>
         <div class="stat"><b>${dup.size}</b><span>Duplicados en el archivo</span></div>
         <div class="stat"><b>${vacios}</b><span>Sin identificador</span></div></div>
         <button class="btn primary" id="ok" ${m.inv ? '' : 'disabled'}>Confirmar importación</button>
         <p class="muted small">Se agregan solo los bienes nuevos, como Pendientes. Nada se elimina ni se marca como verificado.</p>`;
    $('#ok').onclick = () => {
      if (!confirm(`¿Importar los bienes nuevos de ${nombre}?`)) return;
      let n = 0;
      filas.forEach(r => {
        const id = String(r[m.inv]).trim();
        if (!id || BIENES.some(b => b.inv === id)) return;
        const nombreC = m.custodio ? String(r[m.custodio]).trim() : '';
        let c = CUSTODIOS.find(x => x.nombre === nombreC);
        if (!c && nombreC) { c = { id: CUSTODIOS.length + 1, nombre: nombreC, empleado: '—', area: '—' }; CUSTODIOS.push(c); }
        const ub = registrarLugar(m.ubic ? r[m.ubic] : '');
        BIENES.push({ inv: id, desc: m.desc ? r[m.desc] : '', custodio: c ? c.id : 0, ubic: ub, estado: 'pendiente', obs: '' }); n++;
      });
      toast(n + ' bienes importados como Pendientes'); location.hash = 'panel';
    };
  };
  document.querySelectorAll('[data-k]').forEach(s => s.onchange = resumen); resumen();
}
