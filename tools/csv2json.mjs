#!/usr/bin/env node
// Converts data/preflop-ranges.csv (HHP charts) into data/ranges.json for the app.
// Usage: node tools/csv2json.mjs [input.csv] [output.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCSV } from '../js/storage/csv.js';

const input = process.argv[2] || 'data/preflop-ranges.csv';
const output = process.argv[3] || 'data/ranges.json';

const rows = parseCSV(readFileSync(input, 'utf8'));
const header = rows.shift();
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const need = ['chart', 'hero_position', 'scenario', 'vs', 'villain_type', 'hand', 'aggressive_action',
  'aggressive_pct', 'call_action', 'call_pct', 'other_action', 'other_pct', 'fold_pct', 'notes', 'situational'];
for (const n of need) if (!(n in col)) throw new Error(`CSV missing column: ${n}`);

const notes = [];
const noteIndex = (n) => {
  if (!n) return -1;
  let i = notes.indexOf(n);
  if (i < 0) { notes.push(n); i = notes.length - 1; }
  return i;
};

const charts = {};
for (const r of rows) {
  if (r.length < header.length || !r[col.chart]) continue;
  const g = (k) => (r[col[k]] ?? '').trim();
  const name = g('chart');
  const c = charts[name] ||= {
    name,
    heroPosition: g('hero_position'),
    scenario: g('scenario'),
    vs: g('vs'),
    villainType: g('villain_type'),
    actions: { aggressive: '', call: '', other: '' },
    source: g('source_video') ? `${g('source_video')} ${g('video_date')} @ ${g('timestamp')}` : '',
    hands: {},
  };
  if (g('aggressive_action')) c.actions.aggressive = g('aggressive_action');
  if (g('call_action')) c.actions.call = g('call_action');
  if (g('other_action')) c.actions.other = g('other_action');
  const num = (k) => Number(g(k) || 0);
  // [aggressive%, call%, other%, fold%, situational(0/1), noteIndex]
  c.hands[g('hand')] = [num('aggressive_pct'), num('call_pct'), num('other_pct'), num('fold_pct'),
    g('situational').toLowerCase() === 'yes' ? 1 : 0, noteIndex(g('notes'))];
}

const out = {
  format: 'hands: [aggressivePct, callPct, otherPct, foldPct, situational, noteIndex]',
  generatedFrom: input.split('/').pop(),
  notes,
  charts,
};
writeFileSync(output, JSON.stringify(out));
console.log(`Wrote ${output}: ${Object.keys(charts).length} charts, ${rows.length} rows, ${notes.length} notes.`);
