// ==========================================
// 1. CONFIGURACIÓN DE COLORES Y PERFILES
// ==========================================
/** Opciones de color según el tema visual de cada personaje */
const PROFILE_COLORS = {
  ariel: {
    line: '#ff6b81',
    fill: 'rgba(255, 107, 129, 0.18)',
    point: '#ff6b81'
  },
  eric: {
  line: '#ffd166',
  fill: 'rgba(255, 209, 102, 0.14)',
  point: '#ffd166'
}
};

const PROFILE_NAMES = {
  ariel: 'Ariel',
  eric: 'Príncipe Eric'
};

// Instancia global del gráfico Chart.js para su posterior destrucción/renderizado
let chartInstance = null;

// ==========================================
// 2. DATOS: MÉTRICA, CICLO Y CONTEXTO DE FATIGA
// ==========================================
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const inPeriod = (periods, d) => periods.some(p => p.start <= d && d <= (p.end || '9999-12-31'));

function metricValue(rows, metric) {
  if (!rows.length) return null;
  return metric === 'max'
    ? Math.max(...rows.map(l => l.weight))
    : rows.reduce((t, l) => t + l.weight * l.reps, 0);
}

/** Texto del ciclo para una fecha (null si no hay datos) */
function cycleText(periods, date) {
  const p = periods.find(x => x.start <= date && date <= (x.end || '9999-12-31'));
  if (p) return `Día ${daysBetween(p.start, date) + 1} de la regla`;
  const prev = [...periods].filter(x => x.start <= date).pop();
  return prev ? `Día ${daysBetween(prev.start, date) + 1} del ciclo` : null;
}

function buildDatasets(users, dates, logs, metric, { exId, ctx, periods }) {
  return users.map(user => {
    const colors = PROFILE_COLORS[user];
    const userPeriods = user === 'ariel' ? periods : [];
    const points = dates.map(date => {
      const rows = logs.filter(l => l.user === user && l.date === date);
      const lines = [];
      let fatigued = false;
      const c = exId && ctx.get(`${user}|${date}|${exId}`);
      if (c) {
        lines.push(`Ejercicio nº ${c.pos} de ${c.total} del día`);
        fatigued = c.priorSets > 0;
        lines.push(fatigued
          ? `Antes: ${c.prior.join(', ')} (${c.priorSets} series de ${c.group})`
          : 'Sin fatiga previa del mismo grupo');
      }
      const cyc = cycleText(userPeriods, date);
      if (cyc) lines.push(`🌙 ${cyc}`);
      return { value: metricValue(rows, metric), lines, fatigued };
    });
    return {
      label: PROFILE_NAMES[user],
      data: points.map(p => p.value),
      meta: points,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      pointBorderColor: colors.point,
      pointBorderWidth: 2,
      pointBackgroundColor: c => (c.dataset.meta?.[c.dataIndex]?.fatigued ? 'rgba(6,24,43,1)' : colors.point),
      pointStyle: c => (c.dataset.meta?.[c.dataIndex]?.fatigued ? 'rectRot' : 'circle'),
      pointRadius: c => (c.dataset.meta?.[c.dataIndex]?.fatigued ? 7 : 5),
      tension: 0.35,
      fill: true,
      spanGaps: true
    };
  });
}

/** Franjas suaves detrás de los días que caen dentro de la regla */
const bandsPlugin = periods => ({
  id: 'bands',
  beforeDatasetsDraw(chart) {
    const labels = chart.data.labels;
    if (!labels.length || !periods.length) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const step = labels.length > 1 ? x.getPixelForValue(1) - x.getPixelForValue(0) : a.width;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 107, 129, 0.16)';
    labels.forEach((d, i) => {
      if (!inPeriod(periods, d)) return;
      const cx = x.getPixelForValue(i);
      const left = Math.max(a.left, cx - step / 2);
      const right = Math.min(a.right, cx + step / 2);
      ctx.fillRect(left, a.top, right - left, a.bottom - a.top);
    });
    ctx.restore();
  }
});

// ==========================================
// 3. RENDERIZADO DEL GRÁFICO (CHART.JS)
// ==========================================
/** options: { tab, metric, exId, ctx (Map de fatiga), periods (regla de Ariel) } */
export function drawChart(canvas, logs, { tab, metric, exId, ctx = new Map(), periods = [] }) {
  if (!canvas || typeof Chart === 'undefined') return;
  const rows = logs.filter(l => !exId || l.exId === exId);
  const users = tab === 'comp' ? ['ariel', 'eric'] : [tab];
  const dates = [...new Set(rows.filter(l => users.includes(l.user)).map(l => l.date))].sort();
  const datasets = buildDatasets(users, dates, rows, metric, { exId, ctx, periods });

  chartInstance?.destroy();
  const text = '#e6f7ff', grid = '#1de9d022';
  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: dates, datasets },
    plugins: [bandsPlugin(users.includes('ariel') ? periods : [])],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: text } },
        tooltip: { callbacks: { afterLabel: c => c.dataset.meta?.[c.dataIndex]?.lines || [] } }
      },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid } },
        y: { ticks: { color: text }, grid: { color: grid },
             title: { display: true, color: text, text: metric === 'max' ? 'kg' : 'kg × reps' } }
      }
    }
  });
}
