import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(html.includes('id="scale-dialog"'), 'scale dialog is required');
assert(html.includes('id="analysis-start"') && html.includes('id="analysis-end"'), 'analysis range controls are required');
assert(html.includes('id="track-panel"') && html.includes('id="graph-panel"'), 'separate track and graph panels are required');
assert(/#overlay\s*\{[^}]*pointer-events:\s*none;/.test(css), 'overlay must pass through pointer events when selection is inactive');

console.log('UI structure checks: passed');
