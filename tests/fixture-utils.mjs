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
  tag: /\[(?:HHP|OUTSIDE SOURCE|YOUR LOG)\][^\]\[<]*?(?=$|\s\[|\s(?:“|")|[.;]\s|\s—|\s\(|\s{2})/g,
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
export function missingTokens(before, after, { counted = ['mark', 'bare'] } = {}) {
  const a = tokens(before), b = tokens(after);
  const miss = [];
  for (const k of Object.keys(a)) for (const [t, n] of Object.entries(a[k])) {
    const have = b[k][t] || 0;
    if (counted.includes(k) ? have < n : have === 0) miss.push(`${k} ${t} (${n} before, ${have} after)`);
  }
  return miss;
}
