(() => {
let charts = {};
const palette = ['#0d6efd', '#d63384', '#198754'];
function plot(id, datasets) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), { type: 'line', data: { datasets: datasets.map((d, i) => ({ ...d, borderColor: d.borderColor ?? palette[i], backgroundColor: d.backgroundColor ?? d.borderColor ?? palette[i], pointRadius: d.pointRadius ?? 1.5, tension: 0 })) }, options: { parsing: false, responsive: true, maintainAspectRatio: false, scales: { x: { type: 'linear', title: { display: true, text: 'Time (s)' } } }, plugins: { legend: { position: 'bottom' } } } });
}
const series = (samples, key) => samples.map((s) => ({ x: s.t, y: s[key] }));
function renderMotion(measuredPositions, analysisPositions, velocity, acceleration, interpolationEnabled) {
  if (interpolationEnabled === undefined) { interpolationEnabled = false; acceleration = velocity; velocity = analysisPositions; analysisPositions = measuredPositions; }
  const positionDatasets = interpolationEnabled
    ? [{ label: 'Interpolated x', data: series(analysisPositions, 'x'), borderColor: '#6ea8fe', pointRadius: 1 }, { label: 'Interpolated y', data: series(analysisPositions, 'y'), borderColor: '#e685b5', pointRadius: 1 }, { label: 'Measured x', data: series(measuredPositions, 'x'), borderColor: '#0d6efd', pointRadius: 3, showLine: false }, { label: 'Measured y', data: series(measuredPositions, 'y'), borderColor: '#d63384', pointRadius: 3, showLine: false }]
    : [{ label: 'x', data: series(measuredPositions, 'x') }, { label: 'y', data: series(measuredPositions, 'y') }];
  plot('position-chart', positionDatasets);
  plot('velocity-chart', [{ label: 'vx', data: series(velocity, 'vx') }, { label: 'vy', data: series(velocity, 'vy') }, { label: '|v|', data: series(velocity, 'magnitude') }]);
  plot('acceleration-chart', [{ label: 'ax', data: series(acceleration, 'ax') }, { label: 'ay', data: series(acceleration, 'ay') }, { label: '|a|', data: series(acceleration, 'magnitude') }]);
}
function renderEnergy(energy) { plot('energy-chart', [{ label: 'Potential U', data: series(energy, 'potential') }, { label: 'Kinetic K', data: series(energy, 'kinetic') }, { label: 'Mechanical E', data: series(energy, 'mechanical') }]); }

window.T2G = { ...(window.T2G ?? {}), renderMotion, renderEnergy };
})();
