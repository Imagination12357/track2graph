import { Stage, state } from './state.js';

export function makeUI() {
  const $ = (id) => document.getElementById(id);
  const elements = Object.fromEntries(['video-file', 'video', 'overlay', 'video-stage', 'video-status', 'scale-section', 'scale-length', 'scale-unit', 'set-scale', 'confirm-scale', 'scale-status', 'track-section', 'select-roi', 'start-tracking', 'cancel-tracking', 'tracking-progress', 'track-status', 'graph-section', 'graph-status', 'mass'].map((id) => [id, $(id)]));
  const redraw = () => {
    const { overlay } = elements, ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.lineWidth = 3; ctx.font = '18px sans-serif';
    if (state.scalePoints.length) { ctx.strokeStyle = '#f5c518'; ctx.fillStyle = '#f5c518'; state.scalePoints.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }); if (state.scalePoints.length === 2) { ctx.beginPath(); ctx.moveTo(state.scalePoints[0].x, state.scalePoints[0].y); ctx.lineTo(state.scalePoints[1].x, state.scalePoints[1].y); ctx.stroke(); } }
    if (state.roi) { ctx.strokeStyle = '#0d6efd'; ctx.strokeRect(state.roi.x, state.roi.y, state.roi.width, state.roi.height); }
    if (state.positions.length) { ctx.fillStyle = '#dc3545'; state.positions.forEach((p) => { ctx.beginPath(); ctx.arc(p.px, p.py, 2, 0, Math.PI * 2); ctx.fill(); }); const p = state.positions.at(-1); ctx.beginPath(); ctx.arc(p.px, p.py, 6, 0, Math.PI * 2); ctx.fill(); }
  };
  const refresh = () => {
    const scaleReady = state.stage >= Stage.TRACK, graphReady = state.stage >= Stage.GRAPH;
    elements['scale-section'].classList.toggle('locked', state.stage < Stage.SCALE);
    elements['track-section'].classList.toggle('locked', !scaleReady);
    elements['graph-section'].classList.toggle('locked', !graphReady);
    elements['set-scale'].disabled = state.stage < Stage.SCALE || state.tracking;
    elements['confirm-scale'].disabled = state.scalePoints.length !== 2 || !(Number(elements['scale-length'].value) > 0) || state.tracking;
    elements['select-roi'].disabled = !scaleReady || state.tracking;
    elements['start-tracking'].disabled = !state.roi || state.tracking;
    elements['cancel-tracking'].disabled = !state.tracking;
    elements.mass.disabled = !graphReady;
    redraw();
  };
  const status = (name, text) => { elements[name].textContent = text; };
  return { elements, redraw, refresh, status };
}
