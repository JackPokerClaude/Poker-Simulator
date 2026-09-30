// Parsers for the brain/ files. Pure functions (no fetch, no DOM) so the tests and the
// deploy check run the exact same code the app runs.
//
// Nothing here interprets strategy. It only turns the files into indexed text:
//   preflop-ranges.csv      -> charts (SUPERSEDED charts dropped, kept on record)
//   playbook-*.md           -> entries (heading path, dates, flags), villain catalog,
//                              conflicts (⚖ Joan to decide) and open questions (♣)
//   project-instructions.md -> leak tags, known leaks, the open-chart note
import { parseCSV } from '../storage/csv.js';

// ---------- dates ----------
// Tags look like [05-12], [08-25, 09-15], [2025-07-15], [2025-07-15 HHP], [undated HHP].
// Short tags are 2026: the playbooks say full-year tags are the older videos.
export const SHORT_TAG_YEAR = 2026;

export function dateTags(text) {
  const out = [];
  for (const m of String(text).matchAll(/\[([^\]\n]{1,80})\]/g)) {
    const inner = m[1];
    if (/undated/i.test(inner)) { out.push('undated'); continue; }
    for (const d of inner.matchAll(/(?<![\d-])(?:(\d{4})-)?(\d{2})-(\d{2})(?![\d-])/g)) {
      const mm = Number(d[2]), dd = Number(d[3]);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
      out.push(`${d[1] || SHORT_TAG_YEAR}-${d[2]}-${d[3]}`);
    }
  }
  return [...new Set(out)];
}

// ---------- preflop-ranges.csv ----------
const CHART_COLS = ['chart', 'hero_position', 'scenario', 'vs', 'villain_type', 'hand', 'aggressive_action',
  'aggressive_pct', 'call_action', 'call_pct', 'other_action', 'other_pct', 'fold_pct', 'notes', 'situational'];

// Returns { charts, superseded, notes, format }. Throws on a file the app can't use, so a bad
// upload falls back to the last good copy instead of dealing from a broken chart.
export function parseCharts(text) {
  const rows = parseCSV(text);
  const header = (rows.shift() || []).map((h) => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const missing = CHART_COLS.filter((n) => !(n in col));
  if (missing.length) throw new Error(`preflop-ranges.csv is missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);

  const notes = [];
  const noteIndex = (n) => {
    if (!n) return -1;
    let i = notes.indexOf(n);
    if (i < 0) { notes.push(n); i = notes.length - 1; }
    return i;
  };
  const all = {};
  rows.forEach((r, k) => {
    if (!r[col.chart]) return;
    const g = (key) => (r[col[key]] ?? '').trim();
    const name = g('chart');
    const c = all[name] ||= {
      name,
      heroPosition: g('hero_position'),
      scenario: g('scenario'),
      vs: g('vs'),
      villainType: g('villain_type'),
      actions: { aggressive: '', call: '', other: '' },
      sourceVideo: g('source_video'),
      date: g('video_date'),
      source: g('source_video') ? `${g('source_video')} ${g('video_date')}`.trim() : '',
      status: '',
      statusNote: '',
      line: k + 2,
      hands: {},
    };
    if (g('aggressive_action')) c.actions.aggressive = g('aggressive_action');
    if (g('call_action')) c.actions.call = g('call_action');
    if (g('other_action')) c.actions.other = g('other_action');
    const note = g('notes');
    const st = /^(SUPERSEDED|ACTIVE)\b/i.exec(note);
    if (st && !c.status) { c.status = st[1].toUpperCase(); c.statusNote = note; }
    const num = (key) => {
      const v = g(key);
      const n = Number(v || 0);
      if (!Number.isFinite(n)) throw new Error(`preflop-ranges.csv line ${k + 2}: "${v}" in ${key} is not a number`);
      return n;
    };
    // [aggressive%, call%, other%, fold%, situational(0/1), noteIndex]
    c.hands[g('hand')] = [num('aggressive_pct'), num('call_pct'), num('other_pct'), num('fold_pct'),
      g('situational').toLowerCase() === 'yes' ? 1 : 0, st ? -1 : noteIndex(note)];
  });

  const charts = {}, superseded = {};
  for (const c of Object.values(all)) {
    const n = Object.keys(c.hands).length;
    if (n !== 169) throw new Error(`preflop-ranges.csv: chart "${c.name}" has ${n} hands, not 169`);
    (c.status === 'SUPERSEDED' ? superseded : charts)[c.name] = c;
  }
  if (!Object.keys(charts).length) throw new Error('preflop-ranges.csv has no usable charts');
  return { format: 'hands: [aggressivePct, callPct, otherPct, foldPct, situational, noteIndex]', charts, superseded, notes };
}

// ---------- playbook-*.md ----------
const HEADING = /^(#{1,6})\s+(.*)$/;
const BOLD_START = /^\*\*(.+?)\*\*/;
const FIELD = /^\s*-\s+\*([^*]+?):\*\s*(.*)$/; // "- *Range:* ..." in the villain catalog
// A conflict entry starts with the marker; a mention in an intro note (in backticks) doesn't count.
const CONFLICT = /^\s*(?:(?:-|\*|\d+\.)\s+)?(?:\*\*)?⚖ CONFLICT: Joan to decide/;
const NUMBERED_CONFLICT = /^\*\*⚖\s*(\d+)\.\s*(.+?)\*\*/;
const OPEN_Q = /♣ OPEN #(\d+):\s*([^*]+?)\*\*/;

const clean = (s) => String(s).replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
const shortTitle = (s, n = 140) => { const t = clean(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// Stable id from file + title, so a ruling survives edits elsewhere in the file.
export function stableId(prefix, file, title) {
  let h = 2166136261;
  for (const ch of `${file}|${clean(title).toLowerCase()}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

// Splits a playbook into entries. An entry is a top-level bullet or a paragraph, plus anything
// indented under it (sub-bullets, tables). A bold "**Name** [tags]" line followed by
// "- *Field:*" bullets is one villain-catalog entry.
export function parsePlaybook(text, file) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const title = clean((lines.find((l) => /^#\s/.test(l)) || '').replace(/^#\s+/, '')) || file;
  const stack = []; // [{level, text}]
  const entries = [];
  const openQuestions = [];
  let cur = null;
  let openQ = null;

  const close = () => {
    if (!cur) return;
    cur.text = cur.lines.join('\n').trim();
    delete cur.lines;
    cur.dates = dateTags(cur.text);
    cur.flags = {
      conflict: CONFLICT.test(cur.firstLine) || NUMBERED_CONFLICT.test(cur.firstLine),
      sideBySide: /⚖/.test(cur.text),
      situational: /↔/.test(cur.text),
      open: /♣/.test(cur.text),
      outside: /\[OUTSIDE SOURCE\]/.test(cur.text),
    };
    if (cur.text) entries.push(cur);
    cur = null;
  };
  const start = (line, n, kind) => {
    close();
    cur = { file, line: n, kind, heading: stack.map((h) => h.text), firstLine: line, lines: [line], fields: null };
  };

  lines.forEach((raw, i) => {
    const n = i + 1;
    const h = HEADING.exec(raw);
    if (h) {
      close();
      if (openQ) { openQuestions.push(openQ); openQ = null; }
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: clean(h[2]) });
      return;
    }
    if (/^---+\s*$/.test(raw)) { close(); if (openQ) { openQuestions.push(openQ); openQ = null; } return; }

    const oq = OPEN_Q.exec(raw);
    if (oq) {
      if (openQ) openQuestions.push(openQ);
      openQ = { id: `open-${oq[1]}`, number: Number(oq[1]), title: clean(oq[2]), file, line: n, heading: stack.map((x) => x.text), lines: [] };
    }
    if (openQ && !oq) {
      // The question runs until the next heading, rule, or unindented bold paragraph.
      if (/^\S/.test(raw) && !/^-/.test(raw) && BOLD_START.test(raw)) { openQuestions.push(openQ); openQ = null; }
      else openQ.lines.push(raw);
    }

    if (!raw.trim()) { if (cur && cur.kind === 'para') close(); return; }
    const field = FIELD.exec(raw);
    if (field && cur && (cur.kind === 'villain' || (cur.kind === 'para' && BOLD_START.test(cur.firstLine)))) {
      cur.kind = 'villain';
      (cur.fields ||= []).push({ name: clean(field[1]), text: clean(field[2]), line: n });
      cur.lines.push(raw);
      return;
    }
    if (/^\s+\S/.test(raw) || /^\|/.test(raw) || /^>/.test(raw)) {
      // Indented or table/quote lines belong to the current entry.
      if (cur) cur.lines.push(raw); else start(raw, n, /^\|/.test(raw) ? 'table' : 'para');
      return;
    }
    if (/^(?:-|\*|\d+\.)\s/.test(raw)) { start(raw, n, 'bullet'); return; }
    if (cur && cur.kind === 'para' && !BOLD_START.test(raw)) { cur.lines.push(raw); return; }
    start(raw, n, 'para');
  });
  close();
  if (openQ) openQuestions.push(openQ);

  for (const e of entries) {
    const bold = BOLD_START.exec(e.firstLine.replace(/^\s*(?:-|\*|\d+\.)\s+/, ''));
    e.title = shortTitle(bold ? bold[1] : e.firstLine.replace(/^\s*(?:-|\*|\d+\.)\s+/, ''));
    e.section = e.heading.slice(1).join(' › ') || title;
    e.id = stableId('e', file, `${e.section}|${e.title}`);
    delete e.firstLine;
  }

  const villains = entries.filter((e) => e.kind === 'villain' && e.fields?.length && !e.flags.conflict).map((e) => ({
    id: e.id, name: e.title.replace(/\s*\[[^\]]*\]\s*$/, ''), file, line: e.line, section: e.section,
    dates: e.dates, fields: e.fields, flags: e.flags,
  }));

  // Conflicts are found line by line: many sit indented under a parent bullet. A block is the
  // marker line plus everything indented deeper (or table lines) right after it.
  const conflicts = [];
  const heads = [];
  lines.forEach((raw, i) => {
    const h = HEADING.exec(raw);
    if (h) {
      const level = h[1].length;
      while (heads.length && heads[heads.length - 1].level >= level) heads.pop();
      heads.push({ level, text: clean(h[2]) });
      return;
    }
    const bare = raw.replace(/^\s*(?:(?:-|\*|\d+\.)\s+)?/, '');
    const num = NUMBERED_CONFLICT.exec(bare);
    if (!CONFLICT.test(raw) && !num) return;
    const indent = raw.length - raw.trimStart().length;
    const block = [raw];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (HEADING.test(l) || /^---+\s*$/.test(l)) break;
      if (!l.trim()) { if (num) { block.push(l); continue; } break; }
      const ind = l.length - l.trimStart().length;
      if (num ? (NUMBERED_CONFLICT.test(l) || (ind === 0 && !/^[-|]/.test(l))) : (ind <= indent && !/^\s*\|/.test(l))) break;
      block.push(l);
    }
    const after = /⚖ CONFLICT: Joan to decide[.:]?\s*(.*)/.exec(clean(raw));
    const t = num ? clean(num[2]) : shortTitle((/\*\*⚖ CONFLICT: Joan to decide\.?\s*(.+?)\*\*/.exec(raw)?.[1]) || (after ? after[1] : raw), 200);
    const text = block.join('\n').trim();
    conflicts.push({
      id: stableId('c', file, t), title: t, file, line: i + 1,
      section: heads.slice(1).map((x) => x.text).join(' › ') || title,
      dates: dateTags(text), text,
      // One-line recaps in an "open items" list point at a conflict logged in full elsewhere.
      summary: !/\*\*⚖/.test(raw) && !num,
    });
  });

  return {
    file, title, entries, villains, conflicts,
    openQuestions: openQuestions.map((q) => ({ ...q, text: q.lines.join('\n').trim(), dates: dateTags(q.lines.join('\n')), lines: undefined })),
  };
}

// ---------- project-instructions.md ----------
// Plain text, no markdown headings, so this reads between known anchor lines. Missing
// anchors are reported as warnings, never guessed.
export function parseInstructions(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const warnings = [];
  const find = (re) => lines.findIndex((l) => re.test(l));

  // The tag list is the first comma-separated line of lowercase-hyphen words after a
  // "Leak tags" line (the file mentions "Leak tags" more than once).
  let leakTags = [];
  lines.forEach((l, i) => {
    if (leakTags.length || !/^Leak tags\b/i.test(l)) return;
    const next = lines.slice(i + 1).find((x) => x.trim()) || '';
    const tags = next.split(',').map((t) => t.trim());
    if (tags.length >= 3 && tags.every((t) => /^[a-z0-9-]+$/.test(t))) leakTags = tags;
  });
  if (!leakTags.length) warnings.push('project-instructions.md: no leak tag list found after a "Leak tags" line.');

  let knownLeaks = [];
  const kl = find(/^Known leaks\b/i);
  const knownLeaksFrom = kl >= 0 ? (/\(([^)]*)\)/.exec(lines[kl]) || [])[1] || '' : '';
  const fw = find(/^How to think through/i);
  if (kl < 0) warnings.push('project-instructions.md: no "Known leaks" line found.');
  else {
    const end = fw > kl ? fw : lines.length;
    knownLeaks = lines.slice(kl + 1, end).map((l) => l.trim()).filter(Boolean)
      .map((l) => { const m = /^([^.]+)\.\s*(.*)$/.exec(l); return m ? { title: m[1], text: m[2] } : { title: l, text: '' }; });
  }

  const openCharts = (lines.find((l) => /^Open charts:/i.test(l)) || '').trim();
  const seatMapping = (lines.find((l) => /^Seat mapping/i.test(l)) || '').trim();
  return { leakTags, knownLeaks, knownLeaksFrom, openCharts, seatMapping, warnings };
}
