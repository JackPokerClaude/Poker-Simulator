// Hand history on the device (localStorage), stats, CSV export/import.
import { parseCSV, toCSV } from './csv.js';
import { SPOT_LABELS } from '../engine/scenario.js';

const KEY = 'hhp-sim-history-v1';
let memory = null; // fallback if storage is blocked

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return memory || [];
  }
}

export function saveHistory(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
  catch { memory = list; return false; }
}

export function addHand(rec) {
  const list = loadHistory();
  list.unshift(rec);
  return saveHistory(list);
}

export function clearHistory() { saveHistory([]); }

const GOOD = new Set(['correct', 'mixed']);

export function computeStats(list) {
  const byKind = {};
  const missed = {};
  let graded = 0, good = 0, sizingChecks = 0, sizingOk = 0;
  for (const h of list) {
    for (const d of h.decisions || []) {
      for (const z of d.sizing || []) { sizingChecks++; if (z.ok) sizingOk++; else {
        const k = `${z.rule}|${d.label}`;
        missed[k] ||= { spot: d.label, chart: z.rule, code: 'sizing', count: 0, example: z.message };
        missed[k].count++;
      } }
      if (d.verdict === 'nochart') continue;
      const b = byKind[d.kind] ||= { kind: d.kind, label: SPOT_LABELS[d.kind] || d.kind, total: 0, good: 0, situational: 0 };
      b.total++;
      if (d.verdict === 'situational') { b.situational++; continue; }
      graded++;
      if (GOOD.has(d.verdict)) { b.good++; good++; }
      else {
        const k = `${d.chart}|${d.code}|${d.heroAction}`;
        missed[k] ||= { spot: d.label, chart: d.chart, code: d.code, action: d.heroAction, count: 0, example: d.message };
        missed[k].count++;
      }
    }
  }
  const kinds = Object.values(byKind).map((b) => ({ ...b, pct: b.total - b.situational ? Math.round((b.good / (b.total - b.situational)) * 100) : null }));
  kinds.sort((a, b) => b.total - a.total);
  const topMissed = Object.values(missed).sort((a, b) => b.count - a.count).slice(0, 12);
  return {
    hands: list.length, graded, good, pct: graded ? Math.round((good / graded) * 100) : null,
    sizingChecks, sizingOk, kinds, topMissed,
  };
}

const COLS = ['id', 'timestamp', 'drill', 'stakes', 'hero_pos', 'hero_cards', 'hand', 'spot', 'chart', 'exact_chart',
  'hero_actions', 'verdicts', 'sizing_notes', 'net_usd', 'net_bb', 'final_pot', 'reached_river', 'coach_text', 'record_json'];

export function exportCSV(list) {
  const rows = [COLS];
  for (const h of list) {
    rows.push([
      h.id, h.ts, h.drill, h.stakes, h.heroPos, h.heroCards, h.heroCode, h.spot?.kind, h.spot?.chart, h.spot?.exact ? 'yes' : 'no',
      (h.decisions || []).map((d) => `${d.heroAction}${d.to ? ` $${d.to}` : ''}`).join(' > '),
      (h.decisions || []).map((d) => d.verdict).join(' > '),
      (h.decisions || []).flatMap((d) => (d.sizing || []).map((z) => `${z.ok ? 'OK' : 'MISS'}: ${z.message}`)).join(' | '),
      h.net, h.netBB, h.pot, h.reachedRiver ? 'yes' : 'no', h.coachText, JSON.stringify(h),
    ]);
  }
  return toCSV(rows);
}

// Merge imported CSV into history (skips ids already on the device). Returns count added.
export function importCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('Empty file.');
  const header = rows.shift().map((h) => h.trim());
  const jsonCol = header.indexOf('record_json');
  if (jsonCol < 0) throw new Error('Not a simulator history CSV (missing record_json column).');
  const list = loadHistory();
  const have = new Set(list.map((h) => h.id));
  let added = 0;
  for (const r of rows) {
    let rec;
    try { rec = JSON.parse(r[jsonCol]); } catch { continue; }
    if (!rec || !rec.id || have.has(rec.id)) continue;
    list.push(rec); have.add(rec.id); added++;
  }
  list.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  saveHistory(list);
  return added;
}
