import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: { T2G: {} } });
vm.runInContext(readFileSync('js/physics.js', 'utf8'), context, { filename: 'js/physics.js' });

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

console.log('Catmull-Rom interpolation preserves measured positions and analysis selection.');
