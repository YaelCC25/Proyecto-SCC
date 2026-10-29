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
// La hoja conserva la asignación registrada; cada revisión puede guardar lo observado por separado.
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
const diferenciasAsignacion = b => {
  if (!b.verificacion) return [];
  const diferencias = [];
  if ((b.ubic || '') !== b.verificacion.ubic) diferencias.push('Ubicación distinta');
  if (b.custodio != b.verificacion.custodio) diferencias.push('Custodio distinto');
  return diferencias;
};
const compararAsignacion = (b, observada) => `<div class="tbl"><table class="comparacion-asignacion">
  <thead><tr><th>Dato</th><th>Según la hoja</th><th>Observado en la revisión</th></tr></thead>
  <tbody><tr><th>Custodio responsable</th><td>${esc(cust(b.custodio))}</td><td>${observada ? esc(cust(observada.custodio)) : 'Sin revisar'}</td></tr>
  <tr><th>Ubicación</th><td>${esc(ubicacion(b))}</td><td>${observada ? esc(observada.ubic) : 'Sin revisar'}</td></tr></tbody></table></div>
  ${observada?.registrada && (observada.registrada.custodio != b.custodio || observada.registrada.ubic !== b.ubic) ? `<p class="muted small">Asignación al comprobar el bien, antes de corregir: ${esc(cust(observada.registrada.custodio))} · ${esc(ubicacion(observada.registrada))}.</p>` : ''}`;

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
       <div class="stat"><b>${av}%</b><span>Avance</span></div>
       <div class="stat"><b>${BIENES.filter(b => diferenciasAsignacion(b).length).length}</b><span>Alertas de asignación</span></div></div>
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
      <div class="card">
        <form id="revision-form" aria-labelledby="revision-titulo">
          <h3 id="revision-titulo">Revisar la hoja de inventario</h3>
          <p class="muted small" id="revision-ayuda">Selecciona dónde estás y con qué custodio revisas. Escribe un inventario y presiona Enter: si coincide, queda Encontrado; si difiere, se registra una alerta. También puedes consultar un número sin seleccionar contexto.</p>
          <div class="registro-grid">
            <label>Ubicación que estás revisando<select id="fu"><option value="">Todas las ubicaciones</option></select></label>
            <label>Custodio que estás revisando<select id="fc"><option value="">Todos los custodios</option></select></label>
            <label>Número de inventario<input id="revision-inv" required placeholder="Ej. INV-00100" autocomplete="off" aria-describedby="revision-ayuda"></label>
          </div>
          <p id="revision-error" class="note" role="alert" hidden></p>
        </form>
      </div>
      <section id="resultado-revision" class="card" aria-live="polite" hidden></section>
      <section id="editar-asignacion" class="card" hidden>
        <form id="edicion-form" aria-labelledby="edicion-titulo">
          <h3 id="edicion-titulo">Corregir asignación en la hoja</h3>
          <p class="muted small">Guardar cambia el custodio y la ubicación registrados. La revisión conserva la asignación que tenía el bien al comprobarlo.</p>
          <div class="registro-grid">
            <label>Número de inventario<input id="edicion-inv" required></label>
            <label>Custodio registrado<select id="edicion-custodio" required></select></label>
            <label>Ubicación registrada<select id="edicion-ubic" required></select></label>
          </div>
          <p id="edicion-error" class="note" role="alert" hidden></p>
          <div class="bien-acciones"><button class="btn primary" type="submit">Guardar corrección</button><button class="btn" type="button" id="cancelar-edicion">Cancelar</button></div>
        </form>
      </section>
      <section id="alertas-revision" class="card" hidden></section>
      <div id="resumen-ubicacion" aria-live="polite"></div>
      <div id="controles-ubicacion" hidden>
        <div class="tools filtros-levantamiento">
          <label>Buscar en la hoja<input id="q" type="search" placeholder="Número de inventario o descripción"></label>
          <label>Estado<select id="fe"><option value="">Todos los estados</option>${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="alerta">Con alerta de asignación</option></select></label>
        </div>
      </div>
      <p class="muted small" id="cantidad-bienes" role="status"></p>
      <div class="card" id="lista"></div>`;

    const lugar = $('#fu'), custodio = $('#fc'), inventario = $('#revision-inv');
    let ultimo = null, editando = null;
    const actualizarOpciones = () => {
      const seleccionLugar = lugar.value, seleccionCustodio = custodio.value;
      lugar.innerHTML = '<option value="">Todas las ubicaciones</option>' + lugaresDisponibles().map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
      if (BIENES.some(b => !b.ubic)) lugar.innerHTML += '<option value="Sin ubicación">Sin ubicación</option>';
      lugar.value = seleccionLugar;
      custodio.innerHTML = '<option value="">Todos los custodios</option>' + CUSTODIOS.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
      custodio.value = seleccionCustodio;
    };
    const pintarResultado = () => {
      const resultado = $('#resultado-revision');
      resultado.hidden = ultimo === null;
      if (ultimo === null) return;
      const b = BIENES[ultimo.i], diferencias = diferenciasAsignacion(b);
      const observada = ultimo.verificado ? b.verificacion : null;
      resultado.innerHTML = `<h3>${esc(b.inv)}${b.desc ? ` · ${esc(b.desc)}` : ''}</h3>
        ${!observada ? '<p class="note">Consulta de la hoja. Selecciona ubicación y custodio y presiona Enter para registrar la revisión.</p>' : diferencias.length ? `<p class="revision-aviso" role="alert"><strong>Alerta: ${esc(diferencias.join(' y '))}.</strong> El bien fue encontrado, pero su asignación no coincide con la hoja.</p>` : '<p class="revision-ok"><strong>Encontrado: ubicación y custodio coinciden con la hoja.</strong></p>'}
        ${compararAsignacion(b, observada)}
        <button type="button" class="btn" data-editar="${ultimo.i}">Corregir asignación</button>`;
    };
    const pintarAlertas = () => {
      const alertas = BIENES.map((b, i) => [b, i]).filter(([b]) => diferenciasAsignacion(b).length && (!lugar.value || b.verificacion.ubic === lugar.value) && (!custodio.value || b.verificacion.custodio == custodio.value));
      const contenedor = $('#alertas-revision');
      contenedor.hidden = !alertas.length;
      contenedor.innerHTML = `<h3>Alertas de esta revisión (${alertas.length})</h3>` + alertas.map(([b, i]) => `<article class="bien">
        <h4>${esc(b.inv)}${b.desc ? ` · ${esc(b.desc)}` : ''}</h4>
        <p class="revision-aviso">${esc(diferenciasAsignacion(b).join(' y '))}</p>
        <p>En la hoja: ${esc(cust(b.custodio))} · ${esc(ubicacion(b))}</p>
        <p>Observado: ${esc(cust(b.verificacion.custodio))} · ${esc(b.verificacion.ubic)}</p>
        <button type="button" class="btn" data-editar="${i}">Corregir asignación</button></article>`).join('');
    };
    const pintar = () => {
      pintarResultado(); pintarAlertas();
      const activo = Boolean(lugar.value || custodio.value);
      $('#controles-ubicacion').hidden = !activo;
      if (!activo) {
        $('#resumen-ubicacion').innerHTML = '';
        $('#cantidad-bienes').textContent = '';
        $('#lista').innerHTML = '<div class="estado-vacio"><h3>Consulta un inventario o selecciona una ubicación</h3><p class="muted">La hoja ya contiene 48 bienes de ejemplo. Selecciona ubicación y custodio para ver qué bienes les corresponden y revisarlos uno por uno.</p></div>';
        return;
      }
      const seleccion = b => (!lugar.value || ubicacion(b) === lugar.value) && (!custodio.value || b.custodio == custodio.value);
      const bienes = BIENES.filter(seleccion), c = conteo(bienes);
      const contexto = [lugar.value, custodio.value ? cust(custodio.value) : ''].filter(Boolean).join(' · ');
      $('#resumen-ubicacion').innerHTML = `<h3 class="titulo-ubicacion">Bienes según la hoja: ${esc(contexto)}</h3>
        <div class="stats">
          <div class="stat"><b>${bienes.length}</b><span>Bienes asignados</span></div>
          <div class="stat"><b>${c.pendiente}</b><span>Pendientes de verificar</span></div>
          <div class="stat"><b>${c.encontrado}</b><span>Encontrados de la hoja</span></div>
          <div class="stat"><b>${c.no}</b><span>No encontrados</span></div>
          <div class="stat"><b>${BIENES.filter(b => diferenciasAsignacion(b).length && (!lugar.value || b.verificacion.ubic === lugar.value) && (!custodio.value || b.verificacion.custodio == custodio.value)).length}</b><span>Alertas detectadas aquí</span></div>
        </div>`;
      const q = $('#q').value.trim().toLocaleLowerCase('es'), estado = $('#fe').value;
      const lista = BIENES.map((b, i) => [b, i]).filter(([b]) => seleccion(b) &&
        (!q || `${b.inv} ${b.desc}`.toLocaleLowerCase('es').includes(q)) &&
        (!estado || (estado === 'alerta' ? diferenciasAsignacion(b).length : b.estado === estado)));
      $('#cantidad-bienes').textContent = `Mostrando ${lista.length} de ${bienes.length} bienes de la hoja: ${contexto}.`;
      $('#lista').innerHTML = lista.map(([b, i]) => `<article class="bien" data-bien="${esc(b.inv)}">
        <div class="bien-cabecera"><h4>${esc(b.inv)}${b.desc ? ` · ${esc(b.desc)}` : ''}</h4><div class="bien-acciones">${badge(b.estado)}${diferenciasAsignacion(b).length ? '<span class="st alerta">Revisar asignación</span>' : ''}<button type="button" class="link" data-editar="${i}">Corregir asignación</button></div></div>
        <p>Ubicación en la hoja: <strong>${esc(ubicacion(b))}</strong></p>
        <p>Custodio responsable en la hoja: <strong>${esc(cust(b.custodio))}</strong></p>
        ${b.verificacion ? `<p class="${diferenciasAsignacion(b).length ? 'revision-aviso' : 'muted small'}">Última revisión: ${esc(cust(b.verificacion.custodio))} · ${esc(b.verificacion.ubic)}</p>` : ''}
        <div class="choices" role="group" aria-label="Verificación de ${esc(b.inv)}">${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" class="btn ${b.estado === k ? 'sel' : ''}" aria-pressed="${b.estado === k}" data-i="${i}" data-e="${k}">${v}</button>`).join('')}</div>
        <label class="observaciones-bien">Observaciones<input data-o="${i}" value="${esc(b.obs)}" placeholder="Notas de la revisión"></label>
      </article>`).join('') || '<div class="estado-vacio"><p class="muted">No hay bienes asignados que coincidan con esta selección. Puedes buscar cualquier número en el campo de revisión.</p></div>';
    };
    const revisar = i => {
      const b = BIENES[i];
      const completo = lugar.value && lugar.value !== 'Sin ubicación' && custodio.value;
      if (completo) {
        b.verificacion = { ubic: lugar.value, custodio: Number(custodio.value), registrada: { ubic: b.ubic, custodio: b.custodio } };
        b.estado = 'encontrado';
      }
      ultimo = { i, verificado: Boolean(completo) };
      pintar();
      if (completo) {
        inventario.value = '';
        toast(diferenciasAsignacion(b).length ? `${b.inv}: encontrado con alerta de asignación` : `${b.inv}: Encontrado, coincide con la hoja`);
      }
      inventario.focus();
    };
    const abrirEdicion = i => {
      editando = i;
      const b = BIENES[i], v = b.verificacion;
      $('#edicion-form').reset();
      $('#edicion-error').hidden = true;
      $('#edicion-titulo').textContent = `Corregir asignación de ${b.inv}`;
      $('#edicion-inv').value = b.inv;
      $('#edicion-custodio').innerHTML = '<option value="">Selecciona un custodio</option>' + CUSTODIOS.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
      $('#edicion-ubic').innerHTML = '<option value="">Selecciona una ubicación</option>' + lugaresDisponibles().map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
      $('#edicion-custodio').value = String(v?.custodio ?? b.custodio);
      $('#edicion-ubic').value = v?.ubic ?? b.ubic;
      $('#editar-asignacion').hidden = false;
      $('#edicion-custodio').focus();
    };
    const cerrarEdicion = () => { editando = null; $('#editar-asignacion').hidden = true; inventario.focus(); };
    $('#cancelar-edicion').onclick = cerrarEdicion;
    $('#edicion-form').oninput = () => $('#edicion-error').hidden = true;
    $('#edicion-form').onsubmit = e => {
      e.preventDefault();
      if (editando === null) return;
      const inv = $('#edicion-inv').value.trim(), ubic = $('#edicion-ubic').value, responsable = Number($('#edicion-custodio').value);
      const error = mensaje => { $('#edicion-error').textContent = mensaje; $('#edicion-error').hidden = false; $('#edicion-inv').focus(); };
      if (!inv) return error('Escribe el número de inventario.');
      if (BIENES.some((b, i) => i !== editando && b.inv.trim().toLocaleLowerCase('es') === inv.toLocaleLowerCase('es'))) return error('Ese número de inventario ya existe.');
      if (!ubic || !CUSTODIOS.some(c => c.id === responsable)) return error('Selecciona ubicación y custodio.');
      const b = BIENES[editando];
      Object.assign(b, { inv, ubic, custodio: responsable });
      cerrarEdicion(); actualizarOpciones(); pintar();
      toast(`${inv}: asignación corregida en la hoja`);
    };
    $('#revision-form').oninput = () => $('#revision-error').hidden = true;
    $('#revision-form').onkeydown = e => {
      if (e.key !== 'Enter' || e.isComposing || e.target !== inventario) return;
      e.preventDefault();
      if (!e.repeat) $('#revision-form').requestSubmit();
    };
    $('#revision-form').onsubmit = e => {
      e.preventDefault();
      const inv = inventario.value.trim().toLocaleLowerCase('es');
      const i = BIENES.findIndex(b => b.inv.trim().toLocaleLowerCase('es') === inv);
      if (!inv || i === -1) {
        ultimo = null; pintarResultado();
        $('#revision-error').textContent = inv ? 'Este inventario no existe en la hoja. Revisa el número o importa la base; no se creó ningún bien.' : 'Escribe el número de inventario.';
        $('#revision-error').hidden = false; inventario.focus(); return;
      }
      $('#revision-error').hidden = true; revisar(i);
    };
    const cambiarContexto = () => {
      ultimo = null; $('#revision-error').hidden = true;
      $('#q').value = ''; $('#fe').value = '';
      actualizarOpciones(); pintar();
      if (lugar.value && custodio.value) inventario.focus();
    };
    lugar.onchange = cambiarContexto; custodio.onchange = cambiarContexto;
    ['#q', '#fe'].forEach(s => $(s).oninput = pintar);
    ['#resultado-revision', '#alertas-revision', '#lista'].forEach(s => $(s).onclick = e => {
      const editar = e.target.closest('[data-editar]');
      if (editar) { abrirEdicion(Number(editar.dataset.editar)); return; }
      const boton = e.target.closest('[data-e]');
      if (!boton) return;
      const i = Number(boton.dataset.i);
      if (boton.dataset.e === 'encontrado') { revisar(i); return; }
      BIENES[i].estado = boton.dataset.e;
      delete BIENES[i].verificacion;
      if (ultimo?.i === i) ultimo = null;
      pintar(); toast('Verificación registrada: ' + ESTADOS[boton.dataset.e]);
    });
    $('#lista').oninput = e => {
      if (e.target.dataset.o !== undefined) BIENES[e.target.dataset.o].obs = e.target.value;
    };
    actualizarOpciones(); pintar(); inventario.focus();
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
    const disc = BIENES.filter(b => b.estado === 'no' || diferenciasAsignacion(b).length);
    $('#vista').innerHTML = `
     <div class="tools"><button class="btn primary" id="csv">Exportar discrepancias (CSV)</button></div>
     <div class="card"><h3>Resultados generales</h3><div style="max-width:420px;height:240px"><canvas id="ch"></canvas></div></div>
     <div class="card tbl"><h3>Resultados por custodio</h3><table><thead><tr><th>Custodio</th><th>Total</th><th>Encontrados</th><th>No encontrados</th><th>Pendientes</th></tr></thead><tbody>
       ${CUSTODIOS.map(x => fila(x.nombre, BIENES.filter(b => b.custodio == x.id))).join('')}</tbody></table></div>
     <div class="card tbl" id="reporte-discrepancias"><h3>Bienes con discrepancias (${disc.length})</h3><table><thead><tr><th>Inventario</th><th>Descripción</th><th>Custodio en la hoja</th><th>Custodio observado</th><th>Ubicación en la hoja</th><th>Ubicación observada</th><th>Estado</th><th>Alerta</th></tr></thead><tbody>
       ${disc.map(b => `<tr><td>${esc(b.inv)}</td><td>${esc(b.desc)}</td><td>${esc(cust(b.custodio))}</td><td>${b.verificacion ? esc(cust(b.verificacion.custodio)) : '—'}</td><td>${esc(ubicacion(b))}</td><td>${esc(b.verificacion?.ubic || '—')}</td><td>${badge(b.estado)}</td><td>${esc(b.estado === 'no' ? 'No encontrado' : diferenciasAsignacion(b).join(' y '))}</td></tr>`).join('')}</tbody></table></div>`;
    const css = getComputedStyle(document.documentElement);
    if (chart) chart.destroy();
    if (typeof Chart === 'undefined') {
      const aviso = document.createElement('p');
      aviso.className = 'muted small';
      aviso.textContent = 'La gráfica no está disponible. Los resultados y la exportación se muestran abajo.';
      $('#ch').parentElement.style.height = 'auto';
      $('#ch').replaceWith(aviso);
    } else chart = new Chart($('#ch'), {
      type: 'doughnut', data: {
        labels: Object.values(ESTADOS),
        datasets: [{ data: Object.keys(c).map(k => c[k]), backgroundColor: Object.keys(c).map(k => css.getPropertyValue(COLOR[k]).trim()), borderWidth: 0 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: css.getPropertyValue('--ink').trim() } } } }
    });
    $('#csv').onclick = () => {
      const filas = [['Inventario', 'Descripcion', 'Custodio en hoja', 'Custodio observado', 'Ubicacion en hoja', 'Ubicacion observada', 'Estado', 'Alerta', 'Observaciones'],
      ...disc.map(b => [b.inv, b.desc, cust(b.custodio), b.verificacion ? cust(b.verificacion.custodio) : '', ubicacion(b), b.verificacion?.ubic || '', ESTADOS[b.estado], b.estado === 'no' ? 'No encontrado' : diferenciasAsignacion(b).join(' y '), b.obs])];
      const txt = '\ufeff' + filas.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' }));
      a.download = 'discrepancias-2026.csv'; a.click();
    };
  }
};

// ubic es la asignación de la hoja; verificacion conserva lo observado y la asignación al revisar.
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
function registrarCustodio(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return null;
  const existente = CUSTODIOS.find(c => c.nombre.toLocaleLowerCase('es') === limpio.toLocaleLowerCase('es'));
  if (existente) return existente;
  const custodio = { id: Math.max(0, ...CUSTODIOS.map(c => c.id)) + 1, nombre: limpio, empleado: '—', area: '—' };
  CUSTODIOS.push(custodio);
  return custodio;
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
        const c = registrarCustodio(nombreC);
        const ub = registrarLugar(m.ubic ? r[m.ubic] : '');
        BIENES.push({ inv: id, desc: m.desc ? r[m.desc] : '', custodio: c ? c.id : 0, ubic: ub, estado: 'pendiente', obs: '' }); n++;
      });
      toast(n + ' bienes importados como Pendientes'); location.hash = 'panel';
    };
  };
  document.querySelectorAll('[data-k]').forEach(s => s.onchange = resumen); resumen();
}
