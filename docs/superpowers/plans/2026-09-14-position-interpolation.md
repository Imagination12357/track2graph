# Position Interpolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Catmull-Rom position interpolation that feeds the existing motion graphs without altering tracked measurements.

**Architecture:** Measured tracker samples remain in `state.positions`. `physics.js` creates a separate timestamp-aware Catmull-Rom analysis series; `main.js` selects that series based on Graph-tab controls and recomputes all derived quantities. `charts.js` renders raw and interpolated position datasets distinctly while Velocity, Acceleration, and Energy consume only the selected analysis series.

**Tech Stack:** Vanilla JavaScript, native ES modules disabled/classic deferred scripts, Chart.js 4, Pico CSS, Node VM-based tests.

**Spec:** `docs/superpowers/specs/2026-09-14-position-interpolation-design.md`

## Global Constraints

- Preserve `state.positions` as raw tracker measurements; never overwrite it with interpolation output.
- Interpolation is position-only; velocity, acceleration, and energy must be recomputed from the selected position series.
- Use timestamp-aware Catmull-Rom expressed as cubic Hermite interpolation.
- Default interpolation is off; slider default is `1`, range is integer `1` through `10`.
- Do not add dependencies, server code, regression libraries, or global smoothing.
- Keep local-only Git commits; never modify a Git remote.

---

## File structure

- `js/physics.js` — pure interpolation and existing physical derivatives.
- `test/position-interpolation.mjs` — pure numerical interpolation behavior.
- `index.html` — Position-card control markup and updated assumption copy.
- `style.css` — responsive Position graph/control layout.
- `js/ui.js` — control element lookup and enabled/disabled presentation state.
- `js/charts.js` — raw/interpolated Position datasets and unchanged derivative charts.
- `test/ui-structure.mjs` — static markup and classic-script structural checks.
- `js/main.js` — control lifecycle, selected analysis series, and redraw orchestration.

### Task 1: Timestamp-aware Catmull-Rom position interpolation

**Files:**
- Modify: `js/physics.js`
- Create: `test/position-interpolation.mjs`

**Interfaces:**
- Consumes: `Array<{t: number, x: number, y: number}>` measured positions and an integer `insertions`.
- Produces: `interpolatePositions(samples, insertions): Array<{t: number, x: number, y: number, interpolated: boolean}>` and `selectAnalysisPositions(measured, enabled, insertions)` exported through `window.T2G`.
- Rules: original samples have `interpolated: false`; generated samples have `interpolated: true`; `insertions` generated samples occur in every valid adjacent measured interval.

- [ ] **Step 1: Write the failing interpolation test**

Create `test/position-interpolation.mjs` using the same `vm` loader pattern as `test/rescale-positions.mjs`.

```js
const measured = [
  { t: 0, x: 0, y: 0 },
  { t: 1, x: 1, y: 2 },
  { t: 3, x: 5, y: 4 },
];
const output = context.window.T2G.interpolatePositions(measured, 2);
if (output.length !== 7) throw new Error('two insertions per two measured intervals must produce seven positions');
if (output[0].x !== 0 || output[0].y !== 0 || output[3].x !== 1 || output[3].y !== 2 || output[6].x !== 5 || output[6].y !== 4) throw new Error('Catmull-Rom output must pass through every measured point');
if (output[1].t !== 1 / 3 || output[2].t !== 2 / 3 || !output[1].interpolated || output[3].interpolated) throw new Error('inserted positions must have interpolated timestamps and provenance');
if (context.window.T2G.interpolatePositions(measured, 0) !== measured) throw new Error('zero insertions must return the measured series unchanged');
if (context.window.T2G.selectAnalysisPositions(measured, false, 2) !== measured) throw new Error('interpolation off must preserve the measured analysis series');
if (context.window.T2G.selectAnalysisPositions(measured, true, 2).length !== 7) throw new Error('interpolation on must select the interpolated analysis series');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node test\\position-interpolation.mjs`

Expected: failure because `interpolatePositions` is not exported.

- [ ] **Step 3: Implement the minimal interpolation helper**

In `js/physics.js`, add a pure helper. Compute per-sample tangents using actual timestamps: use the one-sided adjacent segment at each endpoint and `(next - previous) / (next.t - previous.t)` at each interior sample. For each segment, evaluate cubic Hermite basis functions at `u = insertedIndex / (insertions + 1)` and use `dt = right.t - left.t` to scale both endpoint tangents.

```js
function interpolatePositions(samples, insertions) {
  if (!Number.isInteger(insertions) || insertions < 1 || samples.length < 2) return samples;
  const tangent = (index, key) => {
    const left = samples[Math.max(0, index - 1)], right = samples[Math.min(samples.length - 1, index + 1)];
    return (right[key] - left[key]) / (right.t - left.t);
  };
  const output = [{ ...samples[0], interpolated: false }];
  // append insertions evaluated Hermite samples, then the exact right measured sample per segment
  return output;
}
```

Skip a segment whose timestamps are not strictly increasing rather than generating invalid samples. Export it with the existing `window.T2G` object spread.

Add the pure selector beside the interpolation helper:

```js
function selectAnalysisPositions(measured, enabled, insertions) {
  return enabled ? interpolatePositions(measured, insertions) : measured;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node test\\position-interpolation.mjs`

Expected: exit code `0` and a success message.

- [ ] **Step 5: Run the existing physics regression test**

Run: `node test\\rescale-positions.mjs`

Expected: exit code `0`; the existing central-velocity and four-frame-acceleration behavior remains unchanged.

- [ ] **Step 6: Commit the numerical feature**

```powershell
git add js/physics.js test/position-interpolation.mjs
git commit -m "Add Catmull-Rom position interpolation"
```

### Task 2: Position chart provenance and Graph-tab controls

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/ui.js`
- Modify: `js/charts.js`
- Modify: `test/ui-structure.mjs`

**Interfaces:**
- Consumes: `renderMotion(measuredPositions, analysisPositions, velocity, acceleration, interpolationEnabled)`.
- Produces: Position graph datasets named `Measured x`, `Interpolated x`, `Measured y`, and `Interpolated y` when enabled; existing Velocity and Acceleration graph datasets remain unchanged.
- UI IDs: `interpolation-enabled`, `interpolation-points`, `interpolation-points-value`, `interpolation-status`, `position-analysis-layout`.

- [ ] **Step 1: Write failing static UI checks**

Extend `test/ui-structure.mjs` with assertions for the required Graph-tab controls and default state.

```js
for (const id of ['position-analysis-layout', 'interpolation-enabled', 'interpolation-points', 'interpolation-points-value', 'interpolation-status']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`missing interpolation UI element: ${id}`);
}
if (!html.includes('id="interpolation-enabled" type="checkbox"')) throw new Error('interpolation must be a checkbox');
if (!html.includes('id="interpolation-points" type="range" min="1" max="10" value="1" disabled')) throw new Error('interpolation slider must default to disabled at one point');
```

Add a VM test for `charts.js` with a fake `Chart` constructor. Call `renderMotion(measured, interpolated, [], [], true)` and assert that the first four Position datasets have labels and styling matching the required raw/interpolated order.

- [ ] **Step 2: Run the static test to verify it fails**

Run: `node test\\ui-structure.mjs`

Expected: failure naming the first missing interpolation UI element.

- [ ] **Step 3: Add the Graph-tab markup and responsive layout**

Replace the current Position article body with a `div#position-analysis-layout` containing the chart wrapper and an `article`/control card. Include:

```html
<label><input id="interpolation-enabled" type="checkbox" /> Enable interpolation</label>
<label>Points inserted per frame interval
  <input id="interpolation-points" type="range" min="1" max="10" value="1" disabled />
  <output id="interpolation-points-value" for="interpolation-points">1</output>
</label>
<p id="interpolation-status" class="status">Off — using measured positions.</p>
```

Add CSS for a two-column grid in `#position-analysis-layout` and one-column fallback under `48rem`. Keep the chart wrapper wide and avoid changing the Velocity, Acceleration, or Energy cards.

- [ ] **Step 4: Update UI lookup and Position chart rendering**

Add the new IDs to `makeUI()` and disable `interpolation-points` unless Graph is available and `interpolation-enabled.checked` is true.

Change `renderMotion` to receive measured and selected analysis positions. When interpolation is false, preserve the current two Position datasets. When true, construct datasets in this order:

```js
[
  { label: 'Interpolated x', data: series(analysisPositions, 'x'), borderColor: '#6ea8fe', pointRadius: 1 },
  { label: 'Interpolated y', data: series(analysisPositions, 'y'), borderColor: '#e685b5', pointRadius: 1 },
  { label: 'Measured x', data: series(measuredPositions, 'x'), borderColor: '#0d6efd', pointRadius: 3, showLine: false },
  { label: 'Measured y', data: series(measuredPositions, 'y'), borderColor: '#d63384', pointRadius: 3, showLine: false },
]
```

Allow `plot()` to preserve a dataset-provided `borderColor`, `backgroundColor`, `pointRadius`, and `showLine`; continue providing palette defaults only when absent.

- [ ] **Step 5: Run UI and chart checks to verify they pass**

Run: `node test\\ui-structure.mjs`

Expected: exit code `0`, including the Position graph dataset assertions.

- [ ] **Step 6: Commit the UI and rendering layer**

```powershell
git add index.html style.css js/ui.js js/charts.js test/ui-structure.mjs
git commit -m "Add interpolation controls and position graph layers"
```

### Task 3: Analysis-series orchestration and lifecycle reset

**Files:**
- Modify: `js/main.js`
- Modify: `test/ui-structure.mjs`
- Modify: `test/position-interpolation.mjs`

**Interfaces:**
- Consumes: `selectAnalysisPositions(state.positions, interpolation.enabled, interpolation.points)` and the Graph-tab controls from Task 2.
- Produces: one `refreshAnalysis()` function that derives `motion` and optional energy from the currently selected analysis series, then invokes `renderMotion(state.positions, analysisPositions, motion.velocity, motion.acceleration, enabled)`.

- [ ] **Step 1: Add a failing lifecycle wiring test**

Extend `test/ui-structure.mjs` to read `js/main.js` and assert that its source contains each required lifecycle call. This test protects the existing browser-only event wiring without requiring a DOM emulator.

```js
const main = readFileSync('js/main.js', 'utf8');
for (const fragment of [
  'function resetInterpolation()',
  'function refreshAnalysis()',
  "e['interpolation-enabled'].addEventListener('change'",
  "e['interpolation-points'].addEventListener('input'",
  'selectAnalysisPositions(state.positions, interpolation.enabled, interpolation.points)',
]) {
  if (!main.includes(fragment)) throw new Error(`missing interpolation lifecycle wiring: ${fragment}`);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node test\\ui-structure.mjs`

Expected: failure naming the first missing interpolation lifecycle fragment.

- [ ] **Step 3: Implement redraw orchestration**

Add a local `interpolation = { enabled: false, points: 1 }` in `js/main.js`. Implement `resetInterpolation()` to uncheck the checkbox, reset the slider/output to `1`, and refresh UI state. Call it on new video, interval change, ROI selection, and before a new tracking run.

Implement `refreshAnalysis()` to select positions, call `deriveMotion`, render all motion graphs, then render energy when mass is positive. Use it after tracking, scale changes, checkbox changes, slider input, and mass input. Keep `state.positions` as the measured series in every call.

Use these event handlers:

```js
e['interpolation-enabled'].addEventListener('change', () => {
  interpolation.enabled = e['interpolation-enabled'].checked;
  ui.refresh();
  refreshAnalysis();
});
e['interpolation-points'].addEventListener('input', () => {
  interpolation.points = Number(e['interpolation-points'].value);
  e['interpolation-points-value'].value = String(interpolation.points);
  refreshAnalysis();
});
```

Update the assumption copy in `index.html` to say that no interpolation is applied unless the user enables it.

- [ ] **Step 4: Run focused selector and full regression checks**

Run:

```powershell
node test\position-interpolation.mjs
node test\rescale-positions.mjs
node test\tracker-video-frames.mjs
node test\opencv-ready-object.mjs
node test\classic-script-scope.mjs
node test\ui-structure.mjs
node --check js\physics.js
node --check js\charts.js
node --check js\ui.js
node --check js\main.js
git diff --check
```

Expected: every Node command exits `0`, and `git diff --check` emits no whitespace errors.

- [ ] **Step 5: Commit orchestration**

```powershell
git add js/main.js index.html test/position-interpolation.mjs test/ui-structure.mjs
git commit -m "Apply interpolation to motion analysis"
```
