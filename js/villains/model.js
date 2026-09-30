// The villain model the engine plays from: the compiled layer (brain-compiled/behavior.json,
// checked against the brain) turned into nested objects, plus where every number came from.
import { resolveCompiled, sourceTag } from '../brain/compiled.js';
import { ALL_CODES } from '../engine/cards.js';
import { setClassInfo } from '../range/classes.js';

function setPath(obj, path, v) {
  const parts = path.split('.');
  let o = obj;
  for (let k = 0; k < parts.length - 1; k++) o = o[parts[k]] ??= {};
  o[parts[parts.length - 1]] = v;
}

// Compiled charts (e.g. the LJ open) in the same shape as the CSV charts.
function compiledCharts(values) {
  const out = {};
  for (const [key, rec] of Object.entries(values)) {
    if (!key.startsWith('charts.') || !rec.v || rec.tag !== 'HHP') continue;
    const c = rec.v;
    const opens = new Set(c.opens);
    const hands = {};
    for (const code of ALL_CODES) hands[code] = opens.has(code) ? [100, 0, 0, 0, 0, -1] : [0, 0, 0, 100, 0, -1];
    out[c.name] = {
      name: c.name, heroPosition: c.heroPosition, scenario: c.scenario, vs: '', villainType: '',
      actions: { aggressive: 'raise', call: '', other: '' }, source: c.source, date: c.date,
      status: 'COMPILED', compiled: true, sourceTag: sourceTag(rec), hands,
    };
  }
  return out;
}

export function buildModel(compiled, texts) {
  const resolved = resolveCompiled(compiled, texts);
  const tree = {};
  for (const [key, rec] of Object.entries(resolved.values)) if (!key.startsWith('charts.')) setPath(tree, key, rec.v);
  const reads = {};
  for (const [group, items] of Object.entries(tree.reads || {})) {
    reads[group] = Object.entries(items).filter(([, t]) => t).map(([n, text]) => ({ text, key: `reads.${group}.${n}` }));
  }
  const m = {
    resolved,
    types: tree.types || {},
    styles: tree.styles || {},
    pool: tree.pool || {},
    buckets: tree.buckets || {},
    reads,
    charts: compiledCharts(resolved.values),
    rec: (key) => resolved.values[key],
    tag: (key) => sourceTag(resolved.values[key]),
  };
  setClassInfo(m);
  return m;
}

let current = null;
export const setModel = (m) => { current = m; };
export const getModel = () => {
  if (!current) throw new Error('Villain model not loaded.');
  return current;
};
export const typeLabel = (type) => current?.types[type]?.label || type;
export const styleLabel = (style) => current?.styles[style]?.label || style;
export const villainLabel = (p) => (p.style && p.style !== 'whale' ? `${typeLabel(p.type)} · ${styleLabel(p.style).toLowerCase()}` : typeLabel(p.type));
