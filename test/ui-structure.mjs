import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(html.includes('id="track-panel"') && html.includes('id="scale-card"'), 'scale controls must live in the Track panel');
assert(!html.includes('id="scale-dialog"'), 'scale must not block the workspace in a dialog');
assert(html.includes('id="analysis-start"') && html.includes('id="analysis-end"'), 'analysis range controls are required');
assert(html.includes('id="track-panel"') && html.includes('id="graph-panel"'), 'separate track and graph panels are required');
assert(/#overlay\s*\{[^}]*pointer-events:\s*none;/.test(css), 'overlay must pass through pointer events when selection is inactive');
assert(!html.includes('type="module"'), 'the app must not rely on ES modules under file URLs');
assert(html.includes('./js/state.js') && html.includes('./js/main.js'), 'classic scripts must load the application in dependency order');
assert(html.includes('@techstark/opencv-js@4.10.0-release.1/dist/opencv.js'), 'OpenCV must use the package browser bundle path');
const analysisLayoutStart = html.indexOf('<div id="analysis-layout">');
assert(analysisLayoutStart >= 0, 'video and workspace must share an analysis layout container');
assert(html.indexOf('id="video-stage"', analysisLayoutStart) < html.indexOf('id="workspace"', analysisLayoutStart), 'wide analysis layout must place video before controls');
assert(css.includes('@media (min-width: 64rem)') && css.includes('#analysis-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(21rem, 3fr);'), 'wide screens must use a 2:3 video-left controls-right layout');
assert(css.includes('#graph-panel > article:first-of-type { container-type: inline-size; }') && css.includes('@container (max-width: 42rem) { #position-analysis-layout { grid-template-columns: 1fr; } }'), 'position interpolation controls must stack when their card is narrow');

for (const id of ['position-analysis-layout', 'interpolation-enabled', 'interpolation-points', 'interpolation-points-value', 'interpolation-status']) {
  assert(html.includes(`id="${id}"`), `missing interpolation UI element: ${id}`);
}
assert(html.includes('id="interpolation-enabled" type="checkbox"'), 'interpolation must be a checkbox');
assert(html.includes('id="interpolation-points" type="range" min="1" max="10" value="1" disabled'), 'interpolation slider must default to disabled at one point');

const chartConfigs = [];
const chartContext = vm.createContext({
  window: { T2G: {} },
  document: { getElementById: (id) => ({ id }) },
  Chart: class Chart { constructor(_node, config) { chartConfigs.push(config); } destroy() {} },
});
vm.runInContext(readFileSync(new URL('../js/charts.js', import.meta.url), 'utf8'), chartContext, { filename: 'js/charts.js' });
chartContext.window.T2G.renderMotion([{ t: 0, x: 0, y: 0 }], [{ t: 0, x: 0, y: 0 }, { t: .5, x: .5, y: .5, interpolated: true }], [], [], true);
const positionDatasets = chartConfigs[0].data.datasets;
assert(positionDatasets.length === 4, 'interpolated position chart must use four datasets');
assert(positionDatasets.map((dataset) => dataset.label).join(',') === 'Interpolated x,Interpolated y,Measured x,Measured y', 'position datasets must distinguish raw and interpolated samples');
assert(positionDatasets[2].showLine === false && positionDatasets[2].pointRadius === 3, 'measured positions must be prominent unconnected points');

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
for (const fragment of [
  'function resetInterpolation()',
  'function refreshAnalysis()',
  "e['interpolation-enabled'].addEventListener('change'",
  "e['interpolation-points'].addEventListener('input'",
  'selectAnalysisPositions(state.positions, interpolation.enabled, interpolation.points)',
]) {
  assert(main.includes(fragment), `missing interpolation lifecycle wiring: ${fragment}`);
}

console.log('UI structure checks: passed');
