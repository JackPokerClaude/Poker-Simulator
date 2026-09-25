// Loads the vendored pokersolver into globalThis (the browser gets it via <script>).
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/vendor/pokersolver.js', import.meta.url), 'utf8');
new Function('window', 'exports', src)(globalThis, undefined);
export const ranges = JSON.parse(readFileSync(new URL('../data/ranges.json', import.meta.url), 'utf8'));
