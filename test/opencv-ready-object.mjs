import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const readyThenable = { Mat: function Mat() {}, then() { throw new Error('ready OpenCV object must not be awaited'); } };
const context = vm.createContext({
  window: { T2G: {}, cv: readyThenable },
  location: { href: 'test://t2g' },
  console: { info() {}, error() {} },
  setTimeout,
  clearTimeout,
});
vm.runInContext(readFileSync('js/tracker.js', 'utf8'), context, { filename: 'js/tracker.js' });

try {
  await context.window.T2G.trackTemplate({
    video: { duration: 0 }, frameCanvas: {}, roi: {}, startTime: 0, endTime: 0,
    onSample() {}, onProgress() {}, cancelled: () => false,
  });
  throw new Error('tracking should reject its invalid time range');
} catch (error) {
  if (error.message !== 'Choose a valid analysis interval.') throw error;
}

console.log('Ready OpenCV objects are used without awaiting their then method.');
