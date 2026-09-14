const Stage = Object.freeze({ EMPTY: 0, SCALE: 1, TRACK: 2, GRAPH: 3 });

const state = {
  stage: Stage.EMPTY, videoUrl: null, scale: null, scalePoints: [], roi: null,
  positions: [], tracking: false, range: { start: 0, end: 0 }, cvReady: false,
};

function clearTracking() { state.roi = null; state.positions = []; state.tracking = false; if (state.stage > Stage.TRACK) state.stage = Stage.TRACK; }
function clearScale() { state.scale = null; state.scalePoints = []; clearTracking(); state.stage = Stage.SCALE; }
function loadVideo(url) { if (state.videoUrl) URL.revokeObjectURL(state.videoUrl); state.videoUrl = url; state.scale = null; state.scalePoints = []; state.roi = null; state.positions = []; state.tracking = false; state.range = { start: 0, end: 0 }; state.stage = Stage.SCALE; }

window.T2G = { ...(window.T2G ?? {}), Stage, state, clearTracking, clearScale, loadVideo };
