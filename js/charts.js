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
// 2. CÁLCULOS Y PROCESAMIENTO DE DATOS
// ==========================================
/**
 * Calcula el valor acumulado según la métrica elegida (Max Peso o Volumen)
 * @param {Array} logs - Registros filtrados de la fecha y usuario
 * @param {string} metric - 'max' (peso máximo) o 'vol' (volumen = peso x reps)
 * @returns {number|null}
 */
function calculateMetricValue(logs, metric) {
  if (!logs.length) return null;

  if (metric === 'max') {
    return Math.max(...logs.map(log => log.weight));
  }

  // Volumen total (Suma de Peso * Repeticiones de cada serie)
  return logs.reduce((total, log) => total + (log.weight * log.reps), 0);
}

/**
 * Prepara las series de datos (datasets) para Chart.js
 * @param {Array} users - Lista de usuarios a procesar (['ariel'], ['eric'] o ambos)
 * @param {Array} dates - Lista ordenada de fechas únicas
 * @param {Array} filteredLogs - Registros de entrenamiento filtrados
 * @param {string} metric - Métrica activa ('max' o 'vol')
 * @returns {Array} Datasets listos para Chart.js
 */
function buildDatasets(users, dates, filteredLogs, metric) {
  return users.map(user => {
    const dataPoints = dates.map(date => {
      const logsByDate = filteredLogs.filter(log => log.user === user && log.date === date);
      return calculateMetricValue(logsByDate, metric);
    });

    const colors = PROFILE_COLORS[user];

    return {
      label: PROFILE_NAMES[user],
      data: dataPoints,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      pointBackgroundColor: colors.point,
      pointRadius: 5,
      tension: 0.35,
      fill: true,
      spanGaps: true
    };
  });
}

// ==========================================
// 3. RENDERIZADO DEL GRÁFICO (CHART.JS)
// ==========================================
/**
 * Renderiza o actualiza la gráfica de evolución del entrenamiento
 * @param {HTMLCanvasElement} canvasElement - Elemento <canvas> del DOM
 * @param {Array} logs - Lista completa de registros
 * @param {Object} options - Opciones del filtro { tab, metric, exId }
 */
export function drawChart(canvasElement, logs, { tab, metric, exId }) {
  if (!canvasElement || typeof Chart === 'undefined') return;

  // 1. Filtrar registros por ejercicio si hay uno seleccionado
  const filteredLogs = logs.filter(log => !exId || log.exId === exId);

  // 2. Determinar usuarios a mostrar (Pestaña 'comp' muestra a ambos)
  const users = tab === 'comp' ? ['ariel', 'eric'] : [tab];

  // 3. Extraer y ordenar las fechas únicas de los registros de los usuarios seleccionados
  const dates = [...new Set(
    filteredLogs
      .filter(log => users.includes(log.user))
      .map(log => log.date)
  )].sort();

  // 4. Generar los datasets con la información procesada
  const datasets = buildDatasets(users, dates, filteredLogs, metric);

  // 5. Destruir la instancia anterior para evitar parpadeos o superposición
  if (chartInstance) {
    chartInstance.destroy();
  }

  // Estilos visuales del tema bajo el mar
  const textColor = '#e6f7ff';
  const gridColor = '#1de9d022';
  const yAxisTitle = metric === 'max' ? 'kg' : 'kg × reps';

  // 6. Crear la nueva instancia de Chart.js
  chartInstance = new Chart(canvasElement, {
    type: 'line',
    data: {
      labels: dates,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor },
          title: {
            display: true,
            color: textColor,
            text: yAxisTitle
          }
        }
      }
    }
  });
}