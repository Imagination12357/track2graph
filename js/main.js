(() => {
const { Stage, state, clearTracking, loadVideo, canvasPoint, waitForSeek, trackTemplate, rescalePositions, selectAnalysisPositions, deriveEnergy, deriveMotion, renderEnergy, renderMotion, makeUI } = window.T2G;
console.info('[T2G:App] boot', { href: location.href, cvType: typeof window.cv, t2gKeys: Object.keys(window.T2G) });

const ui = makeUI();
const { elements: e } = ui;
const workCanvas = document.createElement('canvas');
let mode = null, dragStart = null, cancelRequested = false, motion = null;
let interpolation = { enabled: false, points: 1 };

function setMode(next) { mode = next; e.overlay.classList.toggle('is-interactive', Boolean(next)); }
function resetAnalysis() { motion = null; e.mass.value = ''; e['graph-status'].textContent = 'Finish tracking to see graphs.'; }
function resetInterpolation() {
  interpolation = { enabled: false, points: 1 };
  e['interpolation-enabled'].checked = false;
  e['interpolation-points'].value = '1';
  e['interpolation-points-value'].value = '1';
  e['interpolation-points-value'].textContent = '1';
  e['interpolation-status'].textContent = 'Off — using measured positions.';
}
function refreshAnalysis() {
  if (state.positions.length < 3) return;
  const analysisPositions = selectAnalysisPositions(state.positions, interpolation.enabled, interpolation.points);
  motion = deriveMotion(analysisPositions);
  state.stage = Stage.GRAPH;
  renderMotion(state.positions, analysisPositions, motion.velocity, motion.acceleration, interpolation.enabled);
  e['interpolation-status'].textContent = interpolation.enabled ? `${interpolation.points} points/frame — analyzing ${analysisPositions.length} positions.` : `Off — using ${state.positions.length} measured positions.`;
  const mass = Number(e.mass.value);
  if (mass > 0) { renderEnergy(deriveEnergy(motion.velocity, mass)); e['graph-status'].textContent = 'Energy graph updated from the selected position series.'; }
  else e['graph-status'].textContent = 'Enter a mass to show energy.';
}
function refreshScaledAnalysis() {
  if (state.positions.length < 2 || !state.scale) return;
  state.positions = rescalePositions(state.positions, state.scale);
  refreshAnalysis();
}
function configureVideo() {
  e.overlay.width = e.video.videoWidth; e.overlay.height = e.video.videoHeight;
  workCanvas.width = e.video.videoWidth; workCanvas.height = e.video.videoHeight;
  e['video-stage'].hidden = false;
  state.range = { start: 0, end: e.video.duration };
  e['analysis-start'].value = '0'; e['analysis-end'].value = e.video.duration.toFixed(3);
  e['analysis-start'].max = e.video.duration; e['analysis-end'].max = e.video.duration;
}
function actualMeters() { return Number(e['scale-length'].value) * ({ m: 1, cm: .01, mm: .001 }[e['scale-unit'].value]); }
function setRangeStatus(message = '') { e['range-status'].textContent = message || `Analyzing ${state.range.start.toFixed(3)} s to ${state.range.end.toFixed(3)} s.`; }
function readRange() {
  const start = Number(e['analysis-start'].value), end = Number(e['analysis-end'].value);
  if (!(start >= 0 && end > start && end <= e.video.duration)) { e['range-status'].textContent = 'End must be after start and within the video duration.'; return null; }
  return { start, end };
}
function updateRange() {
  const range = readRange(); if (!range) return false;
  state.range = range; clearTracking(); resetAnalysis(); resetInterpolation(); setRangeStatus(); ui.refresh(); return true;
}
async function seekTo(time) { e.video.pause(); if (Math.abs(e.video.currentTime - time) > .0001) { e.video.currentTime = time; await waitForSeek(e.video); } }

e['video-file'].addEventListener('change', () => {
  const file = e['video-file'].files[0]; if (!file) return;
  loadVideo(URL.createObjectURL(file)); resetAnalysis(); resetInterpolation(); setMode(null);
  e.video.src = state.videoUrl; e['video-status'].textContent = `${file.name} loaded.`; e['scale-status'].textContent = 'Choose a reference frame, then select two endpoints.'; ui.refresh();
});
e.video.addEventListener('loadedmetadata', () => { console.info('[T2G:Video] metadata loaded', { duration: e.video.duration, width: e.video.videoWidth, height: e.video.videoHeight }); configureVideo(); ui.refresh(); });
e['set-scale'].addEventListener('click', () => { state.scalePoints = []; setMode('scale'); e['scale-status'].textContent = 'Click the first endpoint of the known distance.'; ui.refresh(); });
e['scale-length'].addEventListener('input', ui.refresh);
e['confirm-scale'].addEventListener('click', () => {
  const [a, b] = state.scalePoints, pixels = Math.hypot(b.x - a.x, b.y - a.y), meters = actualMeters();
  if (!(pixels > 0 && meters > 0)) return;
  state.scale = meters / pixels; if (state.stage < Stage.TRACK) state.stage = Stage.TRACK; setMode(null); refreshScaledAnalysis(); setRangeStatus();
  e['scale-status'].textContent = `Scale applied: ${state.scale.toPrecision(5)} m per pixel.`;
  e['track-status'].textContent = state.positions.length ? 'Existing tracking was rescaled.' : 'Choose an analysis interval, then select an ROI.';
  ui.refresh();
});
e['set-start'].addEventListener('click', () => { e['analysis-start'].value = e.video.currentTime.toFixed(3); updateRange(); });
e['set-end'].addEventListener('click', () => { e['analysis-end'].value = e.video.currentTime.toFixed(3); updateRange(); });
e['analysis-start'].addEventListener('change', updateRange); e['analysis-end'].addEventListener('change', updateRange);
e['select-roi'].addEventListener('click', async () => {
  if (!updateRange()) return;
  await seekTo(state.range.start); clearTracking(); resetAnalysis(); resetInterpolation(); setMode('roi'); e['track-status'].textContent = 'Draw a rectangle around the object at the analysis start frame.'; ui.refresh();
});
e.overlay.addEventListener('pointerdown', (event) => {
  if (state.tracking || !mode) return;
  const point = canvasPoint(event, e.overlay);
  if (mode === 'scale') { state.scalePoints.push(point); if (state.scalePoints.length === 2) { setMode(null); e['scale-status'].textContent = 'Enter the known length and confirm the scale.'; } ui.refresh(); return; }
  if (mode === 'roi') { dragStart = point; e.overlay.setPointerCapture(event.pointerId); }
});
e.overlay.addEventListener('pointermove', (event) => { if (!dragStart) return; const point = canvasPoint(event, e.overlay); state.roi = { x: Math.min(dragStart.x, point.x), y: Math.min(dragStart.y, point.y), width: Math.abs(point.x - dragStart.x), height: Math.abs(point.y - dragStart.y) }; ui.redraw(); });
e.overlay.addEventListener('pointerup', (event) => { if (!dragStart) return; e.overlay.releasePointerCapture(event.pointerId); dragStart = null; if (state.roi.width < 8 || state.roi.height < 8) state.roi = null; setMode(null); e['track-status'].textContent = state.roi ? 'ROI selected. Start tracking when ready.' : 'ROI was too small; select it again.'; ui.refresh(); });
e['start-tracking'].addEventListener('click', async () => {
  const requestedRange = readRange();
  console.info('[T2G:Track] button clicked', { stage: state.stage, hasScale: Boolean(state.scale), hasRoi: Boolean(state.roi), tracking: state.tracking, requestedRange, storedRange: state.range, cvType: typeof window.cv });
  if (!state.scale || !state.roi || state.tracking || !requestedRange) return;
  if (requestedRange.start !== state.range.start || requestedRange.end !== state.range.end) { e['track-status'].textContent = 'The interval changed. Select the ROI again at the new start frame.'; return; }
  resetInterpolation(); state.positions = []; state.tracking = true; cancelRequested = false; e['tracking-progress'].hidden = false; e['tracking-progress'].value = 0; e['track-status'].textContent = 'Tracking frames…'; ui.refresh();
  try {
    await trackTemplate({ video: e.video, frameCanvas: workCanvas, roi: state.roi, startTime: state.range.start, endTime: state.range.end, cancelled: () => cancelRequested, onProgress: (v) => { e['tracking-progress'].value = v; }, onSample: ({ t, px, py, confidence }) => { if (confidence < .2) return; const first = state.positions[0] ?? { px, py }; state.positions.push({ t, px, py, x: (px - first.px) * state.scale, y: -(py - first.py) * state.scale }); ui.redraw(); } });
    if (cancelRequested) { e['track-status'].textContent = 'Tracking cancelled; result discarded.'; state.positions = []; }
    else if (state.positions.length < 3) { e['track-status'].textContent = 'Too few confident samples. Try a more distinctive, tighter ROI.'; }
    else { refreshAnalysis(); e['track-status'].textContent = `${state.positions.length} position samples tracked.`; }
  } catch (error) { state.positions = []; e['track-status'].textContent = error.message; }
  finally { state.tracking = false; e['tracking-progress'].hidden = true; ui.refresh(); }
});
e['cancel-tracking'].addEventListener('click', () => { cancelRequested = true; e['track-status'].textContent = 'Cancelling after the current frame…'; });
e['interpolation-enabled'].addEventListener('change', () => {
  interpolation.enabled = e['interpolation-enabled'].checked;
  ui.refresh();
  refreshAnalysis();
});
e['interpolation-points'].addEventListener('input', () => {
  interpolation.points = Number(e['interpolation-points'].value);
  e['interpolation-points-value'].value = String(interpolation.points);
  e['interpolation-points-value'].textContent = String(interpolation.points);
  refreshAnalysis();
});
e.mass.addEventListener('input', () => { if (motion) refreshAnalysis(); });
ui.refresh();
})();
