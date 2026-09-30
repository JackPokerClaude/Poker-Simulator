// Loads the brain/ files at runtime and indexes them (see parse.js).
//
// Every file is fetched fresh. If a file can't be fetched or parsed, the last copy that parsed
// cleanly is used instead and a notice says so, so a bad upload never breaks the app.
// Only the chart file is required: without charts there is nothing to deal or grade.
import { parseCharts, parsePlaybook, parseInstructions } from './parse.js';

const PARSERS = {
  charts: (text) => parseCharts(text),
  playbook: (text, name) => parsePlaybook(text, name),
  instructions: (text) => parseInstructions(text),
};

// Browser store for the last good copy of each file (Cache API: the CSV is too big for localStorage).
export function browserLastGood(cacheName = 'hhp-brain-last-good') {
  const key = (name) => new Request(`./brain-last-good/${name}`);
  const open = () => (typeof caches === 'undefined' ? Promise.reject(new Error('no Cache API')) : caches.open(cacheName));
  return {
    async get(name) {
      try { const hit = await (await open()).match(key(name)); return hit ? hit.text() : null; } catch { return null; }
    },
    async save(name, text) {
      try { await (await open()).put(key(name), new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } })); } catch { /* private mode */ }
    },
  };
}

export function memoryLastGood() {
  const m = new Map();
  return { get: async (n) => m.get(n) ?? null, save: async (n, t) => { m.set(n, t); } };
}

export async function browserFetchText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const newest = (dates) => dates.filter((d) => d !== 'undated').sort().pop() || '';

// manifest: { dir, files: [{ name, kind }] } from config/brain-files.json
export async function loadBrain({ manifest, fetchText, lastGood }) {
  const dir = manifest.dir || 'brain/';
  const files = [];
  const parsed = {};
  const texts = {}; // raw text of each file in use, for the compiled-layer quote check
  const notices = [];

  await Promise.all(manifest.files.map(async ({ name, kind }) => {
    const parse = PARSERS[kind];
    const f = { name, kind, status: 'missing', bytes: 0, error: '', newest: '' };
    files.push(f);
    if (!parse) { f.error = `unknown kind "${kind}" in config/brain-files.json`; return; }
    let freshError = '';
    try {
      const text = await fetchText(dir + name);
      parsed[name] = parse(text, name);
      texts[name] = text;
      f.status = 'ok';
      f.bytes = text.length;
      await lastGood.save(name, text);
    } catch (e) {
      freshError = e.message || String(e);
    }
    if (f.status === 'ok') return;
    const old = await lastGood.get(name);
    if (old != null) {
      try {
        parsed[name] = parse(old, name);
        texts[name] = old;
        f.status = 'fallback';
        f.bytes = old.length;
        f.error = freshError;
        notices.push(`Brain update couldn't be read: ${name}. Using the last good version.`);
        return;
      } catch { /* the saved copy is bad too */ }
    }
    f.error = freshError;
    notices.push(`${name} couldn't be loaded (${freshError}), and there's no saved copy.`);
  }));
  files.sort((a, b) => manifest.files.findIndex((x) => x.name === a.name) - manifest.files.findIndex((x) => x.name === b.name));

  const chartFile = manifest.files.find((x) => x.kind === 'charts');
  const charts = chartFile && parsed[chartFile.name];
  if (!charts) throw new Error(notices.join(' ') || 'No chart file listed in config/brain-files.json.');

  const playbooks = manifest.files.filter((x) => x.kind === 'playbook' && parsed[x.name]).map((x) => parsed[x.name]);
  const instrFile = manifest.files.find((x) => x.kind === 'instructions');
  const instr = (instrFile && parsed[instrFile.name]) || { leakTags: [], knownLeaks: [], openCharts: '', seatMapping: '', warnings: [] };

  for (const p of playbooks) {
    const f = files.find((x) => x.name === p.file);
    f.newest = newest(p.entries.flatMap((e) => e.dates));
    f.counts = { entries: p.entries.length, villains: p.villains.length, conflicts: p.conflicts.filter((c) => !c.summary).length, open: p.openQuestions.length };
  }
  const cf = files.find((x) => x.name === chartFile.name);
  cf.newest = newest(Object.values(charts.charts).map((c) => c.date));
  cf.counts = { charts: Object.keys(charts.charts).length, superseded: Object.keys(charts.superseded).length };
  if (instrFile && parsed[instrFile.name]) {
    files.find((x) => x.name === instrFile.name).counts = { leakTags: instr.leakTags.length, knownLeaks: instr.knownLeaks.length };
  }

  return {
    loadedAt: new Date().toISOString(),
    files,
    texts,
    notices,
    warnings: [...instr.warnings],
    charts,
    playbooks,
    entries: playbooks.flatMap((p) => p.entries),
    villains: playbooks.flatMap((p) => p.villains),
    conflicts: playbooks.flatMap((p) => p.conflicts),
    openQuestions: playbooks.flatMap((p) => p.openQuestions),
    leakTags: instr.leakTags,
    knownLeaks: instr.knownLeaks,
    openCharts: instr.openCharts,
    seatMapping: instr.seatMapping,
  };
}

// Chart names the app asks for that the brain doesn't have (renamed or removed in the CSV).
export function missingCharts(brain, names) {
  return [...new Set(names)].filter((n) => !brain.charts.charts[n]);
}
