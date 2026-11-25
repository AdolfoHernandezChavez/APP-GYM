import { drawChart } from './charts.js';

// ==========================================
// 1. UTILIDADES
// ==========================================
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const PROFILES = {
  ariel: { name: 'Ariel', emoji: '🧜‍♀️' },
  eric: { name: 'Príncipe Eric', emoji: '🤴' }
};

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Brazos', 'Core', 'Cardio'];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const safeUrl = url => (/^https?:\/\//i.test(url || '') ? url : '');

const slugify = text => String(text)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// ==========================================
// 2. ESTADO
// ==========================================
const state = {
  activeUser: null,
  //baseExercises: [],   // del archivo exercise.txt
  exercises: [],       // de Firestore
  statsEx: null,       // ejercicio elegido en la gráfica (null = automático)
  logs: [],
  selectedExercise: null,
  activeGroup: '',
  activeTab: 'comp'
};

let cloud = null; // módulo db-config.js (null si no se pudo cargar)

function showCloudStatus(message) {
  const box = $('#cloud-status');
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}

/** Lanza una operación de Firestore sin bloquear la UI (funciona offline) */
function runCloud(action, errorMsg) {
  if (!cloud) {
    alert('Sin conexión con la base de datos. Revisa la configuración de Firebase.');
    return;
  }
  action(cloud).catch(err => {
    console.error(err);
    alert(errorMsg);
  });
}

// ==========================================
// 3. EJERCICIOS (TXT + FIRESTORE)
// ==========================================
/*
async function loadBaseExercises() {
  try {
    const response = await fetch('./assets/data/exercise.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    state.baseExercises = text.split(/\r?\n/).filter(line => line.trim()).map(line => {
      const [name, target, videoUrl] = line.split('|').map(item => item?.trim());
      return {
        id: slugify(name || 'ejercicio'),
        name: name || 'Ejercicio sin nombre',
        target: target || 'General',
        videoUrl: videoUrl || ''
      };
    });
  } catch (error) {
    console.error('No se pudo leer exercise.txt:', error);
  }
  mergeExercises();
}
*/

function setExercises(list) {
  state.exercises = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  renderExerciseList();
}

function initCategoryChips() {
  const categories = ['Todos', ...MUSCLE_GROUPS];
  $('#chips').innerHTML = categories
    .map(group => `<button class="${group === 'Todos' ? 'on' : ''}">${group}</button>`)
    .join('');

  $$('#chips button').forEach(button => {
    button.onclick = () => {
      state.activeGroup = button.textContent === 'Todos' ? '' : button.textContent;
      $$('#chips button').forEach(chip => chip.classList.toggle('on', chip === button));
      renderExerciseList();
    };
  });
}

function renderExerciseList() {
  const term = $('#q').value.toLowerCase().trim();

  const filtered = state.exercises.filter(ex => {
    const matchesText = ex.name.toLowerCase().includes(term);
    const matchesGroup = !state.activeGroup || ex.target.toLowerCase() === state.activeGroup.toLowerCase();
    return matchesText && matchesGroup;
  });

  $('#exlist').innerHTML = filtered.map(ex => `
    <li data-id="${escapeHtml(ex.id)}" style="cursor:pointer">
      <span>${escapeHtml(ex.name)} <small>🎯 ${escapeHtml(ex.target)}</small></span>
      <span>›</span>
    </li>
  `).join('') || '<li>No hay ejercicios todavía. Pulsa “＋ Ejercicio” para añadir el primero.</li>';
}

// ==========================================
// 4. MODALES
// ==========================================
function openExerciseModal(exercise) {
  $('#dn').textContent = exercise.name;
  $('#dtarget').textContent = `Músculo principal: ${exercise.target}`;

  const videoBtn = $('#dvideo');
  const url = safeUrl(exercise.videoUrl);
  if (url) {
    videoBtn.href = url;
    videoBtn.classList.remove('hidden');
  } else {
    videoBtn.classList.add('hidden');
  }

  $('#use').onclick = () => selectExerciseForLog(exercise);
  $('#del-ex').onclick = () => {
    if (!confirm(`¿Eliminar "${exercise.name}"? Las series ya guardadas se conservan.`)) return;
    runCloud(c => c.deleteExercise(exercise.id), 'No se pudo eliminar el ejercicio.');
    if (state.selectedExercise?.id === exercise.id) state.selectedExercise = null;
    $('#dlg').close();
  };
  $('#dlg').showModal();
}

function selectExerciseForLog(exercise) {
  state.selectedExercise = exercise;
  $('#dlg').close();
  switchView('v-log');
  renderLog();
}

function openAddExerciseModal() {
  $('#new-ex-name').value = '';
  $('#new-ex-video').value = '';
  $('#new-ex-target').value = 'Pecho';
  $('#dlg-add-ex').showModal();
}

function closeAddExerciseModal() {
  $('#dlg-add-ex').close();
}

function handleSaveNewExercise() {
  const name = $('#new-ex-name').value.trim();
  const target = $('#new-ex-target').value;
  const id = slugify(name);

  if (!id) return alert('Por favor, escribe un nombre válido para el ejercicio.');
  if (state.exercises.some(ex => ex.id === id)) return alert('Ese ejercicio ya existe.');

  const videoUrl = safeUrl($('#new-ex-video').value.trim());
  runCloud(c => c.addExercise({ id, name, target, videoUrl }), 'No se pudo guardar el ejercicio.');
  closeAddExerciseModal();
}

// ==========================================
// 5. PERFILES, REGISTRO Y ESTADÍSTICAS
// ==========================================
function selectProfile(profileId) {
  state.activeUser = profileId;

  $('#welcome').classList.add('hidden');
  $('#app').classList.remove('hidden');
  document.body.className = `in is-${profileId}`;

  const profile = PROFILES[profileId];
  $('#who').textContent = `${profile.emoji} ${profile.name}`;

  $('#date').value = todayLocal();
  state.statsEx = null;
  renderLog();
}

function showMainMenu() {
  state.activeUser = null;
  $('#app').classList.add('hidden');
  $('#welcome').classList.remove('hidden');
  document.body.className = '';
}

function switchView(viewId) {
  $$('main > section').forEach(section => {
    section.classList.toggle('hidden', section.id !== viewId);
  });
  $$('nav button').forEach(button => {
    button.classList.toggle('on', button.dataset.v === viewId);
  });
  if (viewId === 'v-stats') renderStats();
}

function handleAddSet() {
  const weight = parseFloat($('#w').value.replace(',', '.'));
  const reps = parseInt($('#r').value, 10);
  const date = $('#date').value;

  if (!state.selectedExercise) return alert('Elige primero un ejercicio en 🔍');
  if (isNaN(weight) || weight < 0 || isNaN(reps) || reps <= 0 || !date) {
    return alert('Rellena peso, repeticiones y fecha.');
  }

  const setNo = state.logs.filter(log =>
    log.user === state.activeUser && log.date === date && log.exId === state.selectedExercise.id
  ).length + 1;

  runCloud(c => c.addSet({
    user: state.activeUser,
    date,
    exId: state.selectedExercise.id,
    exName: state.selectedExercise.name,
    setNo,
    weight,
    reps
  }), 'No se pudo guardar la serie.');

  $('#r').value = '';
}

function renderLog() {
  $('#curEx').textContent = state.selectedExercise
    ? state.selectedExercise.name
    : 'Elige un ejercicio en 🔍';

  const selectedDate = $('#date').value;
  const userLogs = state.logs
    .filter(log => log.user === state.activeUser && log.date === selectedDate)
    .sort((a, b) => a.ts - b.ts);

  $('#sets').innerHTML = userLogs.map(log => `
    <li>
      <span>${escapeHtml(log.exName)}<small>Serie ${log.setNo}: <b>${log.weight} kg × ${log.reps}</b></small></span>
      <span>
        <button data-e="${escapeHtml(log.id)}" aria-label="Editar serie">✏️</button>
        <button data-d="${escapeHtml(log.id)}" aria-label="Eliminar serie">🗑️</button>
      </span>
    </li>
  `).join('') || '<li>Sin series este día</li>';
}

function handleSetsClick(event) {
  const btn = event.target.closest('button');
  if (!btn) return;

  if (btn.dataset.d) {
    if (confirm('¿Eliminar serie?')) {
      runCloud(c => c.deleteSet(btn.dataset.d), 'No se pudo eliminar la serie.');
    }
  } else if (btn.dataset.e) {
    const log = state.logs.find(x => x.id === btn.dataset.e);
    if (!log) return;
    const wText = prompt('Peso (kg)', log.weight);
    const rText = prompt('Repeticiones', log.reps);
    if (wText === null || rText === null) return;
    const weight = parseFloat(wText.replace(',', '.'));
    const reps = parseInt(rText, 10);
    if (!isNaN(weight) && !isNaN(reps) && reps > 0) {
      runCloud(c => c.updateSet(log.id, { weight, reps }), 'No se pudo actualizar la serie.');
    }
  }
}

function renderStats() {
  const select = $('#sex');

  // Ejercicios con series guardadas, el más reciente primero
  const byRecent = [...state.logs].sort((a, b) => b.ts - a.ts);
  const exerciseMap = new Map();
  byRecent.forEach(log => { if (!exerciseMap.has(log.exId)) exerciseMap.set(log.exId, log.exName); });

  // Por defecto: el último ejercicio entrenado por el perfil activo
  const lastMine = byRecent.find(log => log.user === state.activeUser);
  let chosen = state.statsEx;
  if (chosen === null || (chosen !== '' && !exerciseMap.has(chosen))) chosen = lastMine ? lastMine.exId : '';

  select.innerHTML = '<option value="">Todos los ejercicios</option>' +
    [...exerciseMap].map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
  select.value = chosen;

  if ($('#v-stats').classList.contains('hidden')) return;

  drawChart($('#chart'), state.logs, {
    tab: state.activeTab,
    metric: $('#met').value,
    exId: select.value
  });
}

// ==========================================
// 6. NUBE (FIREBASE) Y PWA
// ==========================================
async function connectCloud() {
  try {
    cloud = await import('./db-config.js');

    cloud.subscribeExercises(
      list => setExercises(list),
      () => showCloudStatus('⚠️ No se pueden leer los ejercicios de la nube (revisa reglas/permisos).')
    );

    // Series guardadas: sin esto no aparecen en el registro ni en las gráficas
    cloud.subscribe(
      list => { state.logs = list; renderLog(); renderStats(); },
      () => showCloudStatus('⚠️ No se pueden leer las series de la nube (revisa reglas/permisos).')
    );
  } catch (error) {
    console.error('Firebase no se pudo cargar:', error);
    cloud = null;
    showCloudStatus('⚠️ Sin conexión con la base de datos. Revisa db-config.js.');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW no registrado:', err));
  }
}

function createBubbles() {
  const container = $('#bubbles');
  for (let i = 0; i < 14; i++) {
    const bubble = document.createElement('span');
    const size = 6 + Math.random() * 22;
    bubble.style.cssText =
      `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
      `animation-duration:${8 + Math.random() * 12}s;animation-delay:${-Math.random() * 15}s`;
    container.appendChild(bubble);
  }
}

// ==========================================
// 7. INICIALIZACIÓN
// ==========================================
function initApp() {
  // --- Primero toda la interfaz (así los clics funcionan siempre) ---
  initCategoryChips();
  createBubbles();
  $('#date').value = todayLocal();

  $$('.hot').forEach(btn => {
    btn.onclick = event => {
      event.preventDefault();
      selectProfile(btn.dataset.p);
    };
  });

  $('#menu-btn').onclick = showMainMenu;
  $$('nav button').forEach(btn => btn.onclick = () => switchView(btn.dataset.v));

  $('#q').oninput = renderExerciseList;
  $('#exlist').addEventListener('click', event => {
    const li = event.target.closest('li[data-id]');
    const exercise = li && state.exercises.find(ex => ex.id === li.dataset.id);
    if (exercise) openExerciseModal(exercise);
  });

  $('#cls').onclick = () => $('#dlg').close();
  $('#date').onchange = renderLog;
  $('#add').onclick = handleAddSet;
  $('#sets').addEventListener('click', handleSetsClick);

  $('#open-add-ex').onclick = openAddExerciseModal;
  $('#close-add-ex').onclick = closeAddExerciseModal;
  $('#save-new-ex').onclick = handleSaveNewExercise;

  $$('.tabs button').forEach(btn => btn.onclick = () => {
    state.activeTab = btn.dataset.t;
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === btn));
    renderStats();
  });
  $('#sex').onchange = () => { state.statsEx = $('#sex').value; renderStats(); };
  $('#met').onchange = renderStats;

  $('#welcome').classList.remove('hidden');
  $('#app').classList.add('hidden');

  // --- Después, datos y PWA ---
  //loadBaseExercises();
  connectCloud();
  registerServiceWorker();
}

initApp();