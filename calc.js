// ── Referencias DOM ──────────────────────────────────────────────────────────
const registrosEl   = document.getElementById('registros');
const btnAdd        = document.getElementById('btn-add');
const btnCalc       = document.getElementById('btn-calc');
const errorMsg      = document.getElementById('error-msg');
const resultado     = document.getElementById('resultado');
const inputHoras    = document.getElementById('jornada-horas');
const inputMinutos  = document.getElementById('jornada-minutos');
const configPreview = document.getElementById('config-preview');

// ── Preview de jornada ────────────────────────────────────────────────────────
function actualizarPreview() {
  const h = parseInt(inputHoras.value) || 0;
  const m = parseInt(inputMinutos.value) || 0;
  configPreview.textContent = `${h}h ${String(m).padStart(2, '0')}m`;
}

inputHoras.addEventListener('input', actualizarPreview);
inputMinutos.addEventListener('input', actualizarPreview);
actualizarPreview();

// ── Utilidades de tiempo ──────────────────────────────────────────────────────

/** "07:56:12" → segundos. Acepta "07:56" sin segundos. */
function parseTime(str) {
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) parts.push(0);
  const [h, m, s] = parts;
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
}

/** Segundos (absolutos) → "HH:MM:SS" */
function formatSecs(secs) {
  const neg = secs < 0;
  secs = Math.abs(Math.round(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = n => String(n).padStart(2, '0');
  return (neg ? '-' : '') + `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Segundos del día → "HH:MM:SS" con wrap 24h */
function secsToHHMMSS(secs) {
  secs = ((Math.round(secs) % 86400) + 86400) % 86400;
  return formatSecs(secs);
}

// ── Gestión de filas ──────────────────────────────────────────────────────────
let filaCount = 0;

function crearFila(entradaVal = '', salidaVal = '') {
  filaCount++;
  const n = filaCount;

  const div = document.createElement('div');
  div.className = 'fila';
  div.dataset.id = n;

  div.innerHTML = `
    <span class="fila-label">${n}</span>
    <input type="time" step="1" class="entrada" value="${entradaVal}"
           id="entrada-${n}" title="Hora de entrada" />
    <input type="time" step="1" class="salida" value="${salidaVal}"
           id="salida-${n}" title="Hora de salida (dejar vacío en el último tramo)" />
    <button class="btn-remove" title="Eliminar tramo" data-fila="${n}">✕</button>
  `;

  div.querySelector('.btn-remove').addEventListener('click', () => {
    if (registrosEl.querySelectorAll('.fila').length <= 1) return;
    div.remove();
    renumerarFilas();
  });

  return div;
}

function renumerarFilas() {
  registrosEl.querySelectorAll('.fila').forEach((fila, i) => {
    fila.querySelector('.fila-label').textContent = i + 1;
  });
}

function agregarFila(entradaVal = '', salidaVal = '') {
  registrosEl.appendChild(crearFila(entradaVal, salidaVal));
}

// Inicializar con 3 filas vacías
agregarFila();
agregarFila();
agregarFila();

btnAdd.addEventListener('click', () => {
  agregarFila();
  // Hacer scroll suave a la nueva fila
  registrosEl.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ── Cálculo principal ─────────────────────────────────────────────────────────
btnCalc.addEventListener('click', calcular);

function calcular() {
  errorMsg.textContent = '';
  resultado.hidden = true;

  // Jornada configurada en segundos
  const h = parseInt(inputHoras.value);
  const m = parseInt(inputMinutos.value);
  if (isNaN(h) || isNaN(m) || h < 0 || m < 0 || m > 59) {
    errorMsg.textContent = 'Introduce un valor de jornada válido (ej. 8h 15m).';
    return;
  }
  const jornadaSecs = h * 3600 + m * 60;
  if (jornadaSecs === 0) {
    errorMsg.textContent = 'La jornada debe ser mayor de 0 minutos.';
    return;
  }

  // Leer pares de la tabla
  const filas = [...registrosEl.querySelectorAll('.fila')];
  const pares = filas.map(f => ({
    entrada: parseTime(f.querySelector('.entrada').value),
    salida:  parseTime(f.querySelector('.salida').value),
  }));

  // Validaciones
  let ultimaEntrada = null;
  let trabajadoSecs = 0;
  let filasConDatos = 0;

  for (let i = 0; i < pares.length; i++) {
    const { entrada, salida } = pares[i];
    const numFila = i + 1;

    if (entrada === null && salida === null) continue; // fila vacía → saltar

    filasConDatos++;

    if (entrada === null) {
      errorMsg.textContent = `Fila ${numFila}: falta la hora de entrada.`;
      return;
    }

    if (salida !== null) {
      // Tramo completo
      if (salida < entrada) {
        errorMsg.textContent = `Fila ${numFila}: la salida no puede ser anterior a la entrada.`;
        return;
      }
      trabajadoSecs += salida - entrada;
    } else {
      // Entrada sin salida → es el tramo actual (debe ser la última con datos)
      if (ultimaEntrada !== null) {
        errorMsg.textContent = `Solo puedes dejar vacía la última salida. Revisa la fila ${numFila}.`;
        return;
      }
      ultimaEntrada = entrada;
    }
  }

  if (filasConDatos === 0) {
    errorMsg.textContent = 'Introduce al menos una hora de entrada.';
    return;
  }

  if (ultimaEntrada === null) {
    errorMsg.textContent = 'Deja vacía la última salida para calcular la hora de fin de jornada.';
    return;
  }

  // Calcular
  const restanteSecs = jornadaSecs - trabajadoSecs;
  const salidaSecs   = ultimaEntrada + restanteSecs;

  // Mostrar resultado
  document.getElementById('res-trabajado').textContent = formatSecs(trabajadoSecs);
  document.getElementById('res-restante').textContent  = formatSecs(restanteSecs);
  document.getElementById('res-salida').textContent    = secsToHHMMSS(salidaSecs);

  resultado.hidden = false;
  resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── KairosHR: importar fichajes ───────────────────────────────────────────────
const btnKairos    = document.getElementById('btn-kairos');
const kairosStatus = document.getElementById('kairos-status');
const kairosDniEl  = document.getElementById('kairos-dni');

btnKairos.addEventListener('click', async () => {
  const nif = kairosDniEl.value.trim().toUpperCase();

  if (!nif) {
    setKairosStatus('error', 'Introduce el NIF/DNI del empleado.');
    kairosDniEl.focus();
    return;
  }

  setKairosStatus('loading', 'Conectando con KairosHR…');
  btnKairos.disabled = true;

  try {
    // Fecha de hoy en formato YYYY-MM-DD
    const hoy = new Date().toISOString().slice(0, 10);

    // 1. Obtener fichajes del día (date_start = date_end = hoy, filtrado por NIF)
    KairosService.logout(); // forzar login fresco al cambiar de usuario
    const records = await KairosService.getCheckins({
      nif,
      date_start: hoy,
      date_end:   hoy,
    });

    if (!records.length) {
      setKairosStatus('warn', 'No se encontraron fichajes para hoy.');
      return;
    }

    // 2. Parsear a pares entrada/salida, filtrando por NIF
    const pares = KairosService.parsearFichajes(records, nif);

    if (!pares.length) {
      setKairosStatus('warn',
        `Se recibieron ${records.length} registro(s) pero no se pudieron interpretar como pares de entrada/salida.`);
      return;
    }

    // 3. Rellenar filas (limpiar las existentes primero)
    registrosEl.innerHTML = '';
    filaCount = 0;

    pares.forEach(({ entrada, salida }) => agregarFila(entrada, salida));

    // Si el último tramo ya tiene salida, añadir una fila vacía para el tramo actual
    const ultimaFila   = registrosEl.lastElementChild;
    const ultimaSalida = ultimaFila?.querySelector('.salida');
    if (ultimaSalida && ultimaSalida.value) {
      agregarFila();
    }

    setKairosStatus('ok', `✓ ${pares.length} tramo(s) importado(s) correctamente.`);

  } catch (err) {
    console.error('[KairosHR]', err);
    setKairosStatus('error', err.message || 'Error inesperado al conectar con la API.');
  } finally {
    btnKairos.disabled = false;
  }
});

/**
 * Actualiza el mensaje de estado del bloque KairosHR.
 * @param {'loading'|'ok'|'warn'|'error'} tipo
 * @param {string} texto
 */
function setKairosStatus(tipo, texto) {
  kairosStatus.textContent = texto;
  kairosStatus.className = `kairos-status kairos-status--${tipo}`;
}
