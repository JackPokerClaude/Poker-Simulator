// Helpers for the fixture hands: brain hash, HTML → text, and the content tokens the voice
// layer must carry over unchanged (numbers, sizes, %, dates, grade marks, source tags).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);

// Hash of everything the feedback reads from the brain: a brain update changes it.
export function brainHash() {
  const manifest = JSON.parse(readFileSync(new URL('config/brain-files.json', root), 'utf8'));
  const h = createHash('sha256');
  for (const f of manifest.files) h.update(readFileSync(new URL(`brain/${f.name}`, root), 'utf8').replace(/\r\n?/g, '\n'));
  h.update(readFileSync(new URL('brain-compiled/behavior.json', root), 'utf8').replace(/\r\n?/g, '\n'));
  return h.digest('hex').slice(0, 16);
}

export const loadFixtures = () => JSON.parse(readFileSync(new URL('tests/fixtures/hands.json', root), 'utf8'));

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
// Visible text of an HTML string (tags become spaces, entities decoded, spaces collapsed).
export function htmlText(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENT[m]).replace(/\s+/g, ' ').trim();
}

// Every content token in a text, with counts.
const PATTERNS = {
  money: /[−-]?\+?\$\d[\d,]*(?:\.\d+)?/g,
  pct: /\d+(?:\.\d+)?%/g,
  bb: /\d+(?:\.\d+)?bb/g,
  date: /\b(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2})\b/g,
  mark: /✅|⚠️|❌|⚖|♣/g,
  bare: /\[(?:HHP|OUTSIDE SOURCE|YOUR LOG)\]/g,
  number: /(?<![\w$.−-])\d+(?:\.\d+)?(?![\d%]|bb)/g,
};
export function tokens(text) {
  const out = {};
  for (const [k, re] of Object.entries(PATTERNS)) {
    const m = {};
    for (const x of String(text).matchAll(re)) m[x[0].trim()] = (m[x[0].trim()] || 0) + 1;
    out[k] = m;
  }
  return out;
}

// Tokens in `before` that are missing (or fewer) in `after`. Counted kinds must keep their count.
export function missingTokens(before, after, { counted = ['money', 'pct', 'bb', 'date', 'mark', 'bare'] } = {}) {
  const a = tokens(before), b = tokens(after);
  const miss = [];
  for (const k of Object.keys(a)) for (const [t, n] of Object.entries(a[k])) {
    const have = b[k][t] || 0;
    if (counted.includes(k) ? have < n : have === 0) miss.push(`${k} ${t} (${n} before, ${have} after)`);
  }
  return miss;
}

// Every source tag the feedback object carries (verdicts, reasons, numbers, brain entries,
// conflicts, the known leak...), exactly as the engine wrote it.
export function sourceTags(fb) {
  const out = new Set();
  const seen = new Set();
  const walk = (x) => {
    if (!x || typeof x !== 'object' || seen.has(x) || ArrayBuffer.isView(x)) return;
    seen.add(x);
    for (const v of Array.isArray(x) ? x : Object.values(x)) {
      if (typeof v === 'string' && /^\[(HHP|OUTSIDE SOURCE|YOUR LOG)\]/.test(v)) out.add(v);
      else walk(v);
    }
    if (x.block?.file) out.add(`[HHP] ${x.block.file} › ${x.block.section}${x.block.dates?.length ? ` · ${x.block.dates.join(', ')}` : ''}`);
    if (x.open?.file) out.add(`[HHP] ${x.open.file} · ♣ OPEN #${x.open.number}`);
  };
  walk(fb);
  return [...out];
}
const count = (text, t) => { let n = 0, k = 0; while ((k = text.indexOf(t, k)) >= 0) { n++; k += t.length; } return n; };
// Tags that show fewer times in `after` than in `before`.
export function missingTags(fb, before, after) {
  return sourceTags(fb).filter((t) => count(after, t) < count(before, t)).map((t) => `${t} (${count(before, t)} before, ${count(after, t)} after)`);
}
