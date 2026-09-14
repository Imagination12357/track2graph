export const Stage = Object.freeze({ EMPTY: 0, SCALE: 1, TRACK: 2, GRAPH: 3 });

export const state = {
  stage: Stage.EMPTY, videoUrl: null, scale: null, scalePoints: [], roi: null,
  positions: [], tracking: false, cvReady: false,
};

export function clearTracking() { state.roi = null; state.positions = []; state.tracking = false; if (state.stage > Stage.TRACK) state.stage = Stage.TRACK; }
export function clearScale() { state.scale = null; state.scalePoints = []; clearTracking(); state.stage = Stage.SCALE; }
export function loadVideo(url) { if (state.videoUrl) URL.revokeObjectURL(state.videoUrl); state.videoUrl = url; state.scale = null; state.scalePoints = []; state.roi = null; state.positions = []; state.tracking = false; state.stage = Stage.SCALE; }
