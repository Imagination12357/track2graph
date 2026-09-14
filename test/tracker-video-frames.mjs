import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const callbacks = [];
const actions = [];
const makeFrame = () => ({ cols: 100, rows: 100, roi: () => ({ cols: 10, rows: 10, clone: () => ({ cols: 10, rows: 10, delete() {} }), delete() {} }), delete() {} });
const context = vm.createContext({
  window: { T2G: { frameToCanvas() {}, waitForSeek: async () => {} }, cv: { Mat: function Mat() { this.delete = () => {}; }, Rect: function Rect() {}, imread: makeFrame, matchTemplate() { actions.push('match'); }, minMaxLoc: () => ({ maxLoc: { x: 2, y: 3 }, maxVal: 1 }), TM_CCOEFF_NORMED: 1 } },
  location: { href: 'test://t2g' }, console: { info() {}, error() {} }, setTimeout, clearTimeout,
});
vm.runInContext(readFileSync('js/tracker.js', 'utf8'), context, { filename: 'js/tracker.js' });

const video = {
  duration: 1, currentTime: 0, pause() { actions.push('pause'); }, play: async () => { actions.push('play'); },
  requestVideoFrameCallback(callback) { actions.push('request'); callbacks.push(callback); return callbacks.length; },
};
const samples = [];
const tracking = context.window.T2G.trackTemplate({
  video, frameCanvas: {}, roi: { x: 0, y: 0, width: 10, height: 10 }, startTime: 0, endTime: .1,
  onSample: (sample) => samples.push(sample), onProgress() {}, cancelled: () => false,
});

for (let i = 0; i < 5; i += 1) await Promise.resolve();
if (callbacks.length !== 1) throw new Error('tracker must request the next decoded video frame');
if (actions.join(',') !== 'pause,request,play') throw new Error(`expected playback before the first independent match, got ${actions.join(',')}`);
if (samples.length !== 0) throw new Error(`expected no self-match sample before playback, got ${JSON.stringify(samples)}`);
actions.length = 0;
callbacks.shift()(0, { mediaTime: .033 });
await Promise.resolve();
if (actions.join(',') !== 'pause,match,request,play') throw new Error(`expected pause-match-resume ordering, got ${actions.join(',')}`);
if (samples[0].t !== 0 || samples[0].px !== 7 || samples[0].py !== 8 || samples[0].confidence !== 1) throw new Error(`expected first sample from the first advanced frame, got ${JSON.stringify(samples[0])}`);
callbacks.shift()(0, { mediaTime: .066 });
await Promise.resolve();
callbacks.shift()(0, { mediaTime: .101 });
await tracking;

if (samples.length !== 2 || samples[0].t !== 0 || samples[1].t !== .033) throw new Error(`expected one sample per decoded frame after the initial advance, got ${JSON.stringify(samples)}`);
console.log('Tracker samples each decoded video frame once.');
