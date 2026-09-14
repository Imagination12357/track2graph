import { Stage, state, clearScale, clearTracking, loadVideo } from './state.js';
import { canvasPoint } from './video.js';
import { trackTemplate } from './tracker.js';
import { deriveEnergy, deriveMotion } from './physics.js';
import { renderEnergy, renderMotion } from './charts.js';
import { makeUI } from './ui.js';

const ui = makeUI();
const { elements: e } = ui;
const workCanvas = document.createElement('canvas');
let mode = null, dragStart = null, cancelRequested = false, motion = null;

function setMode(next) { mode = next; e.overlay.style.cursor = next ? 'crosshair' : 'default'; }
function resetAnalysis() { motion = null; e.mass.value = ''; e['graph-status'].textContent = 'Finish tracking to see graphs.'; }
function configureVideo() {
  e.overlay.width = e.video.videoWidth; e.overlay.height = e.video.videoHeight;
  workCanvas.width = e.video.videoWidth; workCanvas.height = e.video.videoHeight;
  e['video-stage'].hidden = false;
}
function actualMeters() { const value = Number(e['scale-length'].value); return value * ({ m: 1, cm: .01, mm: .001 }[e['scale-unit'].value]); }

e['video-file'].addEventListener('change', () => {
  const file = e['video-file'].files[0]; if (!file) return;
  loadVideo(URL.createObjectURL(file)); resetAnalysis(); setMode(null);
  e.video.src = state.videoUrl; e['video-status'].textContent = `${file.name} loaded. Set a scale.`; e['scale-status'].textContent = 'Click “Set scale points”, then click two reference endpoints.'; e['track-status'].textContent = 'Set the scale to unlock tracking.'; ui.refresh();
});
e.video.addEventListener('loadedmetadata', () => { configureVideo(); ui.refresh(); });
e['set-scale'].addEventListener('click', () => { clearScale(); resetAnalysis(); setMode('scale'); e['scale-status'].textContent = 'Click the first endpoint of the known distance.'; ui.refresh(); });
e['scale-length'].addEventListener('input', ui.refresh);
e['confirm-scale'].addEventListener('click', () => {
  const [a, b] = state.scalePoints, pixels = Math.hypot(b.x - a.x, b.y - a.y), meters = actualMeters();
  if (!(pixels > 0 && meters > 0)) return;
  state.scale = meters / pixels; state.stage = Stage.TRACK; setMode(null); clearTracking(); resetAnalysis();
  e['scale-status'].textContent = `Scale set: ${state.scale.toPrecision(5)} m per pixel.`; e['track-status'].textContent = 'Select a tracking ROI.'; ui.refresh();
});
e['select-roi'].addEventListener('click', () => { clearTracking(); resetAnalysis(); setMode('roi'); e['track-status'].textContent = 'Drag a rectangle around the object.'; ui.refresh(); });
e.overlay.addEventListener('pointerdown', (event) => {
  if (state.tracking || !mode) return;
  const point = canvasPoint(event, e.overlay);
  if (mode === 'scale') { state.scalePoints.push(point); if (state.scalePoints.length === 2) { setMode(null); e['scale-status'].textContent = 'Enter the known length and confirm the scale.'; } ui.refresh(); return; }
  if (mode === 'roi') { dragStart = point; e.overlay.setPointerCapture(event.pointerId); }
});
e.overlay.addEventListener('pointermove', (event) => { if (!dragStart) return; const point = canvasPoint(event, e.overlay); state.roi = { x: Math.min(dragStart.x, point.x), y: Math.min(dragStart.y, point.y), width: Math.abs(point.x - dragStart.x), height: Math.abs(point.y - dragStart.y) }; ui.redraw(); });
e.overlay.addEventListener('pointerup', (event) => { if (!dragStart) return; e.overlay.releasePointerCapture(event.pointerId); dragStart = null; if (state.roi.width < 8 || state.roi.height < 8) state.roi = null; setMode(null); e['track-status'].textContent = state.roi ? 'ROI selected. Start tracking when ready.' : 'ROI was too small; select it again.'; ui.refresh(); });
e['start-tracking'].addEventListener('click', async () => {
  if (!state.scale || !state.roi || state.tracking) return;
  state.positions = []; state.tracking = true; cancelRequested = false; e['tracking-progress'].hidden = false; e['tracking-progress'].value = 0; e['track-status'].textContent = 'Tracking frames…'; ui.refresh();
  try {
    await trackTemplate({ video: e.video, frameCanvas: workCanvas, roi: state.roi, cancelled: () => cancelRequested, onProgress: (v) => { e['tracking-progress'].value = v; }, onSample: ({ t, px, py, confidence }) => { if (confidence < .2) return; const first = state.positions[0] ?? { px, py }; state.positions.push({ t, px, py, x: (px - first.px) * state.scale, y: -(py - first.py) * state.scale }); ui.redraw(); } });
    if (cancelRequested) { e['track-status'].textContent = 'Tracking cancelled; result discarded.'; state.positions = []; }
    else if (state.positions.length < 3) { e['track-status'].textContent = 'Too few confident samples. Try a more distinctive, tighter ROI.'; }
    else { motion = deriveMotion(state.positions); state.stage = Stage.GRAPH; renderMotion(state.positions, motion.velocity, motion.acceleration); e['track-status'].textContent = `${state.positions.length} position samples tracked.`; e['graph-status'].textContent = 'Enter a mass to show energy.'; }
  } catch (error) { state.positions = []; e['track-status'].textContent = error.message; }
  finally { state.tracking = false; e['tracking-progress'].hidden = true; ui.refresh(); }
});
e['cancel-tracking'].addEventListener('click', () => { cancelRequested = true; e['track-status'].textContent = 'Cancelling after the current frame…'; });
e.mass.addEventListener('input', () => { const mass = Number(e.mass.value); if (motion && mass > 0) { renderEnergy(deriveEnergy(motion.velocity, mass)); e['graph-status'].textContent = 'Energy graph updated from measured velocity and midpoint position.'; } });
ui.refresh();
