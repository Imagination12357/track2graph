import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });

for (const file of ['js/state.js', 'js/ui.js']) {
  vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
}

console.log('Classic scripts share no conflicting top-level bindings.');
