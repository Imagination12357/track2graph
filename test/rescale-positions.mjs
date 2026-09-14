import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: { T2G: {} } });
vm.runInContext(readFileSync('js/physics.js', 'utf8'), context, { filename: 'js/physics.js' });

const raw = [{ t: 0, px: 10, py: 20 }, { t: 1, px: 14, py: 16 }, { t: 2, px: 18, py: 12 }];
const positions = context.window.T2G.rescalePositions(raw, .5);
const { velocity, acceleration } = context.window.T2G.deriveMotion(positions);

if (positions[0].x !== 0 || positions[0].y !== 0 || positions[1].x !== 2 || positions[1].y !== 2) throw new Error('rescaling must use the first pixel sample as the physical origin');
if (velocity[0].vx !== 2 || velocity[0].vy !== 2 || acceleration[0].ax !== 0 || acceleration[0].ay !== 0) throw new Error('rescaled positions must feed consistent motion values');
if (velocity.length !== 1 || velocity[0].t !== 1 || acceleration.length !== 1 || acceleration[0].t !== 1) throw new Error('central differences must omit the two boundary positions');

const nonUniformPositions = [{ t: 0, x: 0, y: 0 }, { t: 1, x: 1, y: 0 }, { t: 3, x: 9, y: 0 }];
const nonUniformMotion = context.window.T2G.deriveMotion(nonUniformPositions);
if (nonUniformMotion.velocity[0].vx !== 3 || nonUniformMotion.acceleration[0].ax !== 2) throw new Error('central differences must respect irregular decoded-frame timestamps');
console.log('Raw pixel positions rescale without changing their timestamps or trajectory.');
