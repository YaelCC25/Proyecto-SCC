/* Control de Inventario: bienes, custodios y ubicaciones cargados desde la hoja del usuario. */
const $ = (s, r = document) => r.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CUSTODIOS = [];
const LUGARES = [];
const LUGARES_ENCONTRADO = Object.freeze([
  "CCL",
  "SITE",
  "Dirección",
  "Bodega Norte",
  "Bodega Central",
  "Bodega Sur",
  "Bodega Planta alta",
  "Aula 1",
  "Auditorio 1",
  "Auditorio 2",
  "Auditorio 3",
  "Auditorio 4",
  "Laboratorio 1",
  "Laboratorio 2",
  "Laboratorio 3",
  "Laboratorio 4",
  "Laboratorio 5",
  "L. Redes",
  "L. CISCO",
  "L. Arquitectura",
  "CC Licenciatura",
  "D Comp Lab",
  "Aula 1 Posg.",
  "Aula 2 Posg.",
  "Aula 3 Posg.",
  "CC Posgrado",
  "Sala de Exdirectores",
  "Cubículos A",
  "Cubículos B"
]);
let BIENES = [];
// La hoja conserva la asignación registrada; cada revisión puede guardar lo observado por separado.
const ESTADOS = { encontrado: 'Encontrado', no: 'No encontrado', pendiente: 'Pendiente de verificar' };
const COLOR = { encontrado: '--ok', no: '--no', pendiente: '--pen' };
const RUTAS = { panel: 'Panel principal', importar: 'Importar base', levantamiento: 'Levantamiento', custodios: 'Custodios', reportes: 'Reportes' };
const PERMISOS = { Administrador: Object.keys(RUTAS), 'Responsable de inventario': Object.keys(RUTAS), Verificador: ['panel', 'levantamiento', 'custodios'] };
let user = null, chart = null;

/* Guardado local del inventario. Las credenciales de acceso nunca se guardan aquí. */
const CLAVE_DATOS = 'scc-inventario-v1';
let almacenamientoDisponible = true;
const avisoAlmacenamiento = mensaje => {
  $('#storage-status').textContent = mensaje;
  $('#storage-status').hidden = false;
};
function estadoDatos() {
  return { version: 1, bienes: BIENES, custodios: CUSTODIOS, lugares: LUGARES };
}
function restaurarDatos(estado) {
  BIENES = estado.bienes;
  CUSTODIOS.splice(0, CUSTODIOS.length, ...estado.custodios);
  LUGARES.splice(0, LUGARES.length, ...estado.lugares);
}
function actualizarDatos(cambiar) {
  if (!almacenamientoDisponible) return false;
  const anterior = JSON.parse(JSON.stringify(estadoDatos()));
  try {
    cambiar();
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(estadoDatos()));
    $('#storage-status').hidden = true;
    return true;
  } catch {
    restaurarDatos(anterior);
    avisoAlmacenamiento('No se pudieron guardar los cambios en este navegador. La operación no se aplicó. Revisa el espacio y los permisos de almacenamiento antes de intentarlo de nuevo.');
    return false;
  }
}
try {
  const guardado = localStorage.getItem(CLAVE_DATOS);
  if (guardado) {
    const estado = JSON.parse(guardado);
    if (estado.version !== 1 || !Array.isArray(estado.bienes) || !Array.isArray(estado.custodios) || !Array.isArray(estado.lugares)
      || !estado.bienes.every(b => b && typeof b.inv === 'string' && b.inv.trim() && typeof b.desc === 'string' && typeof b.ubic === 'string' && typeof b.obs === 'string' && Object.hasOwn(ESTADOS, b.estado) && Number.isFinite(b.custodio))
      || !estado.custodios.every(c => c && Number.isFinite(c.id) && typeof c.nombre === 'string' && typeof c.empleado === 'string' && typeof c.area === 'string')
      || !estado.lugares.every(l => typeof l === 'string')) throw new Error('Inventario local no válido');
    restaurarDatos(estado);
  }
} catch {
  almacenamientoDisponible = false;
  avisoAlmacenamiento('No se pudo abrir el inventario guardado. No se sobrescribirán los datos existentes. Comprueba que el almacenamiento del navegador esté disponible.');
}

/* ---------- Apariencia y visibilidad de la contraseña ---------- */
const temaSistema = window.matchMedia('(prefers-color-scheme: dark)');
let temaElegido = false;
function aplicarTema(oscuro) {
  document.documentElement.dataset.theme = oscuro ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-toggle]').forEach(boton => {
    const siguiente = oscuro ? 'claro' : 'oscuro';
    boton.setAttribute('aria-pressed', String(oscuro));
    boton.setAttribute('aria-label', `Activar modo ${siguiente}`);
    boton.title = `Activar modo ${siguiente}`;
    $('[data-theme-label]', boton).textContent = `Modo ${siguiente}`;
  });
  if (chart && $('#ch')) {
    const css = getComputedStyle(document.documentElement);
    chart.data.datasets[0].backgroundColor = Object.values(COLOR).map(color => css.getPropertyValue(color).trim());
    chart.options.plugins.legend.labels.color = css.getPropertyValue('--ink').trim();
    chart.update('none');
  }
}
document.querySelectorAll('[data-theme-toggle]').forEach(boton => {
  boton.onclick = () => {
    temaElegido = true;
    aplicarTema(document.documentElement.dataset.theme !== 'dark');
  };
});
temaSistema.addEventListener('change', e => {
  if (!temaElegido) aplicarTema(e.matches);
});
aplicarTema(temaSistema.matches);

function mostrarContrasena(visible) {
  $('#l-pass').type = visible ? 'text' : 'password';
  const boton = $('#toggle-password');
  const etiqueta = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
  boton.setAttribute('aria-pressed', String(visible));
  boton.setAttribute('aria-label', etiqueta);
  boton.title = etiqueta;
}
$('#toggle-password').onclick = () => mostrarContrasena($('#l-pass').type === 'password');

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
function validarCorreoLogin() {
  const correo = $('#l-correo'), error = $('#correo-error');
  const valido = correo.validity.valid;
  correo.setAttribute('aria-invalid', String(!valido));
  error.hidden = valido;
  error.textContent = valido ? '' : correo.validity.valueMissing
    ? 'Escribe tu correo.'
    : 'Escribe un correo válido, por ejemplo: nombre@correo.com';
  return valido;
}
$('#l-correo').addEventListener('input', () => {
  if ($('#l-correo').getAttribute('aria-invalid') === 'true') validarCorreoLogin();
});
function validarContrasenaLogin() {
  const campo = $('#l-pass'), error = $('#password-error');
  const valido = campo.value.trim().length > 0;
  campo.setAttribute('aria-invalid', String(!valido));
  error.hidden = valido;
  error.textContent = valido ? '' : 'Escribe tu contraseña.';
  return valido;
}
$('#l-pass').addEventListener('input', () => {
  if ($('#l-pass').getAttribute('aria-invalid') === 'true') validarContrasenaLogin();
});
function limpiarLogin() {
  $('#login-form').reset();
  $('#l-correo').value = '';
  $('#l-pass').value = '';
  ['#l-correo', '#l-pass'].forEach(selector => $(selector).removeAttribute('aria-invalid'));
  ['#correo-error', '#password-error'].forEach(selector => {
    $(selector).hidden = true;
    $(selector).textContent = '';
  });
  mostrarContrasena(false);
}
$('#login-form').onsubmit = e => {
  e.preventDefault();
  $('#l-correo').value = $('#l-correo').value.trim();
  const correoValido = validarCorreoLogin(), contrasenaValida = validarContrasenaLogin();
  if (!correoValido || !contrasenaValida) {
    $(correoValido ? '#l-pass' : '#l-correo').focus();
    return;
  }
  user = { correo: $('#l-correo').value, rol: $('#l-rol').value };
  limpiarLogin();
  $('#login').hidden = true; $('#app').hidden = false;
  $('#u-info').textContent = user.correo + ' · ' + user.rol;
  $('#nav').innerHTML = PERMISOS[user.rol].map(r => `<a href="#${r}" data-r="${r}">${RUTAS[r]}</a>`).join('');
  route();
};
$('#salir').onclick = () => {
  user = null;
  limpiarLogin();
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#u-info').textContent = '';
  $('#toast').hidden = true;
  $('#l-correo').focus();
};
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
     ${!n ? '<div class="card estado-vacio"><h3>Aún no hay una base cargada</h3><p class="muted">Carga tu archivo Excel o CSV desde Importar base para comenzar.</p></div>' : ''}
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
    if (!BIENES.length) {
      $('#vista').innerHTML = '<div class="card estado-vacio"><h3>No hay bienes cargados</h3><p class="muted">Importa tu hoja de inventario para comenzar el levantamiento.</p>' + (PERMISOS[user.rol].includes('importar') ? '<a class="btn primary" href="#importar">Importar base</a>' : '<p>Solicita la carga de la base al responsable de inventario.</p>') + '</div>';
      return;
    }
    $('#vista').innerHTML = `
      <div class="card">
        <form id="revision-form" aria-labelledby="revision-titulo">
          <h3 id="revision-titulo">Revisar la hoja de inventario</h3>
          <p class="muted small" id="revision-ayuda">Selecciona el lugar donde encontraste el bien y el custodio. Puedes filtrar por la ubicación que figura en la hoja. Escribe un inventario y presiona Enter: si coincide, queda Encontrado; si difiere, se registra una alerta. También puedes consultar un número sin seleccionar contexto.</p>
          <div class="registro-grid revision-grid">
            <label>Filtrar ubicación en la hoja<select id="fu"><option value="">Todas las ubicaciones</option></select></label>
            <label>Lugar donde se encontró el bien<select id="revision-ubicacion"><option value="">Selecciona un lugar</option>${LUGARES_ENCONTRADO.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select></label>
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

    const lugar = $('#fu'), lugarEncontrado = $('#revision-ubicacion'), custodio = $('#fc'), inventario = $('#revision-inv');
    let ultimo = null, editando = null, lugarElegido = false;
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
        ${!observada ? '<p class="note">Consulta de la hoja. Selecciona el lugar donde se encontró el bien y el custodio, y presiona Enter para registrar la revisión.</p>' : diferencias.length ? `<p class="revision-aviso" role="alert"><strong>Alerta: ${esc(diferencias.join(' y '))}.</strong> El bien fue encontrado, pero su asignación no coincide con la hoja.</p>` : '<p class="revision-ok"><strong>Encontrado: ubicación y custodio coinciden con la hoja.</strong></p>'}
        ${compararAsignacion(b, observada)}
        <button type="button" class="btn" data-editar="${ultimo.i}">Corregir asignación</button>`;
    };
    const pintarAlertas = () => {
      const alertas = BIENES.map((b, i) => [b, i]).filter(([b]) => diferenciasAsignacion(b).length && (!lugarEncontrado.value || b.verificacion.ubic === lugarEncontrado.value) && (!custodio.value || b.verificacion.custodio == custodio.value));
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
        $('#lista').innerHTML = '<div class="estado-vacio"><h3>Consulta un inventario o selecciona una ubicación</h3><p class="muted">Selecciona ubicación y custodio para ver los bienes de la hoja importada y revisarlos uno por uno.</p></div>';
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
          <div class="stat"><b>${BIENES.filter(b => diferenciasAsignacion(b).length && (!lugarEncontrado.value || b.verificacion.ubic === lugarEncontrado.value) && (!custodio.value || b.verificacion.custodio == custodio.value)).length}</b><span>Alertas detectadas aquí</span></div>
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
      const completo = LUGARES_ENCONTRADO.includes(lugarEncontrado.value) && custodio.value;
      if (completo) {
        if (!actualizarDatos(() => {
          b.verificacion = { ubic: lugarEncontrado.value, custodio: Number(custodio.value), registrada: { ubic: b.ubic, custodio: b.custodio } };
          b.estado = 'encontrado';
        })) return;
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
      $('#edicion-ubic').innerHTML = '<option value="">Selecciona una ubicación</option>' + LUGARES_ENCONTRADO.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
      $('#edicion-custodio').value = String(v?.custodio ?? b.custodio);
      const propuesta = v?.ubic ?? b.ubic;
      $('#edicion-ubic').value = LUGARES_ENCONTRADO.includes(propuesta) ? propuesta : '';
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
      if (!LUGARES_ENCONTRADO.includes(ubic) || !CUSTODIOS.some(c => c.id === responsable)) return error('Selecciona ubicación y custodio.');
      const b = BIENES[editando];
      if (!actualizarDatos(() => Object.assign(b, { inv, ubic, custodio: responsable }))) return;
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
      if (lugarEncontrado.value && custodio.value) inventario.focus();
    };
    lugar.onchange = () => {
      if (!lugarElegido) lugarEncontrado.value = LUGARES_ENCONTRADO.includes(lugar.value) ? lugar.value : '';
      cambiarContexto();
    };
    custodio.onchange = cambiarContexto;
    lugarEncontrado.onchange = () => {
      lugarElegido = true;
      ultimo = null;
      $('#revision-error').hidden = true;
      pintar();
      if (lugarEncontrado.value && custodio.value) inventario.focus();
    };
    ['#q', '#fe'].forEach(s => $(s).oninput = pintar);
    ['#resultado-revision', '#alertas-revision', '#lista'].forEach(s => $(s).onclick = e => {
      const editar = e.target.closest('[data-editar]');
      if (editar) { abrirEdicion(Number(editar.dataset.editar)); return; }
      const boton = e.target.closest('[data-e]');
      if (!boton) return;
      const i = Number(boton.dataset.i);
      if (boton.dataset.e === 'encontrado') { revisar(i); return; }
      if (!actualizarDatos(() => {
        BIENES[i].estado = boton.dataset.e;
        delete BIENES[i].verificacion;
      })) return;
      if (ultimo?.i === i) ultimo = null;
      pintar(); toast('Verificación registrada: ' + ESTADOS[boton.dataset.e]);
    });
    $('#lista').oninput = e => {
      if (e.target.dataset.o !== undefined && !actualizarDatos(() => { BIENES[e.target.dataset.o].obs = e.target.value; })) e.target.value = BIENES[e.target.dataset.o].obs;
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
    if (!BIENES.length || typeof Chart === 'undefined') {
      const aviso = document.createElement('p');
      aviso.className = 'muted small';
      aviso.textContent = !BIENES.length ? 'Importa tu base de inventario para ver los resultados.' : 'La gráfica no está disponible. Los resultados y la exportación se muestran abajo.';
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
const claveInventario = valor => String(valor ?? '').trim().toLocaleLowerCase('es');
const CAMPOS = [['inv', 'Número de inventario'], ['desc', 'Descripción'], ['custodio', 'Custodio'], ['ubic', 'Ubicación']];
function leer(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') return toast('No se pudo cargar el lector de Excel/CSV. Comprueba tu conexión y vuelve a abrir la página.');
  const rd = new FileReader();
  rd.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      if (!filas.length) return toast('El archivo no tiene registros');
      vistaPrevia(filas, file.name);
    } catch { toast('No se pudo leer el archivo'); }
  };
  rd.onerror = () => toast('No se pudo abrir el archivo. Vuelve a seleccionarlo.');
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
    const ids = m.inv ? filas.map(r => claveInventario(r[m.inv])) : [];
    const registrados = new Set(BIENES.map(b => claveInventario(b.inv)));
    const vistos = new Set();
    let nuevos = 0, duplicados = 0, vacios = 0, existentes = 0;
    ids.forEach(id => {
      if (!id) { vacios++; return; }
      if (vistos.has(id)) { duplicados++; return; }
      vistos.add(id);
      if (registrados.has(id)) existentes++;
      else nuevos++;
    });
    $('#res').innerHTML = `<h3>Resumen antes de confirmar</h3>
         <div class="stats"><div class="stat"><b>${filas.length}</b><span>Registros leídos</span></div>
         <div class="stat"><b>${nuevos}</b><span>Bienes nuevos</span></div>
         <div class="stat"><b>${existentes}</b><span>Ya existen</span></div>
         <div class="stat"><b>${duplicados}</b><span>Duplicados en el archivo</span></div>
         <div class="stat"><b>${vacios}</b><span>Sin identificador</span></div></div>
         <button class="btn primary" id="ok" ${m.inv && nuevos ? '' : 'disabled'}>Confirmar importación</button>
         <p class="muted small">Se agregan solo los bienes nuevos, como Pendientes. Nada se elimina ni se marca como verificado.</p>`;
    $('#ok').onclick = () => {
      if (!confirm(`¿Importar los bienes nuevos de ${nombre}?`)) return;
      let n = 0;
      if (!actualizarDatos(() => filas.forEach(r => {
        const id = String(r[m.inv] ?? '').trim();
        if (!id || BIENES.some(b => claveInventario(b.inv) === claveInventario(id))) return;
        const nombreC = m.custodio ? String(r[m.custodio] ?? '').trim() : '';
        const c = registrarCustodio(nombreC);
        const ub = registrarLugar(m.ubic ? r[m.ubic] : '');
        BIENES.push({ inv: id, desc: m.desc ? String(r[m.desc] ?? '') : '', custodio: c ? c.id : 0, ubic: ub, estado: 'pendiente', obs: '' }); n++;
      }))) return;
      toast(n + ' bienes importados como Pendientes'); location.hash = 'panel';
    };
  };
  document.querySelectorAll('[data-k]').forEach(s => s.onchange = resumen); resumen();
}
