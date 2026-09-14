(() => {
const { Stage, state } = window.T2G;

function makeUI() {
  const $ = (id) => document.getElementById(id);
  const ids = ['video-file', 'video', 'overlay', 'video-stage', 'video-status', 'scale-dialog', 'scale-length', 'scale-unit', 'set-scale', 'confirm-scale', 'scale-status', 'workspace', 'track-tab', 'graph-tab', 'track-panel', 'graph-panel', 'analysis-start', 'analysis-end', 'set-start', 'set-end', 'range-status', 'select-roi', 'start-tracking', 'cancel-tracking', 'tracking-progress', 'track-status', 'graph-status', 'mass'];
  const elements = Object.fromEntries(ids.map((id) => [id, $(id)]));
  const redraw = () => {
    const { overlay } = elements, ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, overlay.width, overlay.height); ctx.lineWidth = 3;
    if (state.scalePoints.length) { ctx.strokeStyle = '#f5c518'; ctx.fillStyle = '#f5c518'; state.scalePoints.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }); if (state.scalePoints.length === 2) { ctx.beginPath(); ctx.moveTo(state.scalePoints[0].x, state.scalePoints[0].y); ctx.lineTo(state.scalePoints[1].x, state.scalePoints[1].y); ctx.stroke(); } }
    if (state.roi) { ctx.strokeStyle = '#0d6efd'; ctx.strokeRect(state.roi.x, state.roi.y, state.roi.width, state.roi.height); }
    if (state.positions.length) { ctx.fillStyle = '#dc3545'; state.positions.forEach((p) => { ctx.beginPath(); ctx.arc(p.px, p.py, 2, 0, Math.PI * 2); ctx.fill(); }); }
  };
  const refresh = () => {
    const hasScale = state.stage >= Stage.TRACK, hasGraph = state.stage >= Stage.GRAPH;
    elements['scale-dialog'].hidden = state.stage !== Stage.SCALE;
    elements.workspace.hidden = !hasScale;
    elements['confirm-scale'].disabled = state.scalePoints.length !== 2 || !(Number(elements['scale-length'].value) > 0);
    elements['select-roi'].disabled = !hasScale || state.tracking;
    elements['start-tracking'].disabled = !state.roi || state.tracking;
    elements['cancel-tracking'].disabled = !state.tracking;
    elements['graph-tab'].hidden = !hasGraph;
    elements.mass.disabled = !hasGraph;
    redraw();
  };
  return { elements, redraw, refresh };
}

window.T2G = { ...(window.T2G ?? {}), makeUI };
})();
