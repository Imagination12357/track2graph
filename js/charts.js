let charts = {};
const palette = ['#0d6efd', '#d63384', '#198754'];
function plot(id, datasets) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), { type: 'line', data: { datasets: datasets.map((d, i) => ({ ...d, borderColor: palette[i], backgroundColor: palette[i], pointRadius: 1.5, tension: 0 })) }, options: { parsing: false, responsive: true, maintainAspectRatio: false, scales: { x: { type: 'linear', title: { display: true, text: 'Time (s)' } } }, plugins: { legend: { position: 'bottom' } } } });
}
const series = (samples, key) => samples.map((s) => ({ x: s.t, y: s[key] }));
export function renderMotion(positions, velocity, acceleration) {
  plot('position-chart', [{ label: 'x', data: series(positions, 'x') }, { label: 'y', data: series(positions, 'y') }]);
  plot('velocity-chart', [{ label: 'vx', data: series(velocity, 'vx') }, { label: 'vy', data: series(velocity, 'vy') }, { label: '|v|', data: series(velocity, 'magnitude') }]);
  plot('acceleration-chart', [{ label: 'ax', data: series(acceleration, 'ax') }, { label: 'ay', data: series(acceleration, 'ay') }, { label: '|a|', data: series(acceleration, 'magnitude') }]);
}
export function renderEnergy(energy) { plot('energy-chart', [{ label: 'Potential U', data: series(energy, 'potential') }, { label: 'Kinetic K', data: series(energy, 'kinetic') }, { label: 'Mechanical E', data: series(energy, 'mechanical') }]); }
