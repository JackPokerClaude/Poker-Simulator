// Loads the vendored pokersolver into globalThis (the browser gets it via <script>).
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/vendor/pokersolver.js', import.meta.url), 'utf8');
new Function('window', 'exports', src)(globalThis, undefined);
// Charts come straight from the brain CSV, parsed the same way the app does it, and the
// villain model from the compiled layer checked against the real brain files.
import { parseCharts } from '../js/brain/parse.js';
import { buildModel, setModel } from '../js/villains/model.js';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('config/brain-files.json', root), 'utf8'));
export const brainTexts = Object.fromEntries(manifest.files.map((f) => [f.name, readFileSync(new URL(`brain/${f.name}`, root), 'utf8')]));
export const compiled = JSON.parse(readFileSync(new URL('brain-compiled/behavior.json', root), 'utf8'));
export const model = buildModel(compiled, brainTexts);
setModel(model);
export const ranges = parseCharts(brainTexts['preflop-ranges.csv']);
Object.assign(ranges.charts, model.charts);
