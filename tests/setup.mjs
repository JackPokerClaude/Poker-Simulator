// Loads the vendored pokersolver into globalThis (the browser gets it via <script>).
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/vendor/pokersolver.js', import.meta.url), 'utf8');
new Function('window', 'exports', src)(globalThis, undefined);
// Charts come straight from the brain CSV, parsed the same way the app does it.
import { parseCharts } from '../js/brain/parse.js';
export const ranges = parseCharts(readFileSync(new URL('../brain/preflop-ranges.csv', import.meta.url), 'utf8'));
