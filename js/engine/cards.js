// Cards are ints 0..51: rank = c >> 2 (0 = deuce .. 12 = ace), suit = c & 3.
export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';
export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };

export const rankOf = (c) => c >> 2;
export const suitOf = (c) => c & 3;
export const cardStr = (c) => RANKS[rankOf(c)] + SUITS[suitOf(c)]; // "As" (pokersolver format)
export const cardPretty = (c) => RANKS[rankOf(c)] + SUIT_SYMBOLS[SUITS[suitOf(c)]];
export const cardsPretty = (cs) => cs.map(cardPretty).join(' ');
export const parseCard = (s) => RANKS.indexOf(s[0].toUpperCase()) * 4 + SUITS.indexOf(s[1].toLowerCase());

// Unbiased random int in [0, n) using crypto when available.
export function randInt(n) {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    let x;
    do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }
  return Math.floor(Math.random() * n);
}
export const rand = () => randInt(0x40000000) / 0x40000000;
export const pick = (arr) => arr[randInt(arr.length)];
export function weightedPick(obj) {
  const entries = Object.entries(obj);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
  return entries[entries.length - 1][0];
}

// Real 52-card Fisher-Yates shuffle.
export function shuffledDeck() {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// "AKs", "T9o", "77"
export function handCode(a, b) {
  let r1 = rankOf(a), r2 = rankOf(b);
  if (r1 < r2) [r1, r2] = [r2, r1];
  if (r1 === r2) return RANKS[r1] + RANKS[r2];
  return RANKS[r1] + RANKS[r2] + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

export const ALL_CODES = (() => {
  const out = [];
  for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) {
    if (i === j) out.push(RANKS[i] + RANKS[j]);
    else if (i > j) out.push(RANKS[i] + RANKS[j] + 's');
    else out.push(RANKS[j] + RANKS[i] + 'o');
  }
  return out;
})();

export const combosOf = (code) => (code.length === 2 ? 6 : code[2] === 's' ? 4 : 12);

// Chen-style playability score, used to order hands for villain ranges ("top X%").
function chen(code) {
  const hi = RANKS.indexOf(code[0]), lo = RANKS.indexOf(code[1]);
  const pts = (r) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  let s = pts(hi);
  if (hi === lo) return Math.max(s * 2, 5) + 0.01 * hi;
  if (code[2] === 's') s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  return s + 0.01 * lo;
}

// Ordered best -> worst with cumulative percentile (fraction of 1326 combos, inclusive).
export const HAND_ORDER = [...ALL_CODES].sort((a, b) => chen(b) - chen(a));
export const HAND_PCT = (() => {
  const m = {};
  let cum = 0;
  for (const c of HAND_ORDER) { cum += combosOf(c); m[c] = cum / 1326; }
  return m;
})();

// Expand simple range notation: "JJ+", "AK", "AKs", "A5s-A2s", "QQ".
export function expandRange(list) {
  const out = new Set();
  for (const raw of list) {
    const t = raw.trim();
    const m = /^([2-9TJQKA])([2-9TJQKA])([so]?)(\+?)(?:-([2-9TJQKA])([2-9TJQKA])[so]?)?$/.exec(t);
    if (!m) continue;
    const [, a, b, suf, plus, , b2] = m;
    const ra = RANKS.indexOf(a), rb = RANKS.indexOf(b);
    const add = (hi, lo) => {
      if (hi === lo) out.add(RANKS[hi] + RANKS[lo]);
      else if (!suf) { out.add(RANKS[hi] + RANKS[lo] + 's'); out.add(RANKS[hi] + RANKS[lo] + 'o'); }
      else out.add(RANKS[hi] + RANKS[lo] + suf);
    };
    if (ra === rb) {
      for (let r = ra; r <= (plus ? 12 : ra); r++) add(r, r);
    } else if (b2) {
      const r2 = RANKS.indexOf(b2);
      for (let r = Math.min(rb, r2); r <= Math.max(rb, r2); r++) add(ra, r);
    } else {
      for (let r = rb; r <= (plus ? ra - 1 : rb); r++) add(ra, r);
    }
  }
  return out;
}
