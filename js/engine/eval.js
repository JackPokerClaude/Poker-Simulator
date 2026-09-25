// Fast 5-7 card evaluator used by the villain AI (thousands of evals per decision).
// Official showdowns use pokersolver (see showdown.js); tests check these agree.
import { rankOf, suitOf } from './cards.js';

export const CATEGORY_NAMES = ['High card', 'Pair', 'Two pair', 'Trips', 'Straight', 'Flush', 'Full house', 'Quads', 'Straight flush'];

function straightHigh(mask) {
  // mask bit r set for rank r (0..12); ace also plays low.
  const full = (mask << 1) | ((mask >> 12) & 1); // bit0 = ace-low, bit r+1 = rank r
  for (let hi = 13; hi >= 4; hi--) {
    if (((full >> (hi - 4)) & 0b11111) === 0b11111) return hi - 1; // rank of top card (wheel = 3)
  }
  return -1;
}

const pack = (cat, ks) => {
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 16 + (ks[i] ?? 0);
  return v;
};

// Returns a comparable integer: higher is better.
export function evaluate(cards) {
  const rc = new Array(13).fill(0);
  const sc = [0, 0, 0, 0];
  const sm = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = rankOf(c), s = suitOf(c);
    rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r;
  }
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const sf = straightHigh(sm[flushSuit]);
    if (sf >= 0) return pack(8, [sf]);
  }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) quads.push(r);
    else if (rc[r] === 3) trips.push(r);
    else if (rc[r] === 2) pairs.push(r);
    else if (rc[r] === 1) singles.push(r);
  }
  if (quads.length) {
    const kick = Math.max(...[...trips, ...pairs, ...singles]);
    return pack(7, [quads[0], kick]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pr = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return pack(6, [trips[0], pr]);
  }
  if (flushSuit >= 0) {
    const ks = [];
    for (let r = 12; r >= 0 && ks.length < 5; r--) if (sm[flushSuit] & (1 << r)) ks.push(r);
    return pack(5, ks);
  }
  const st = straightHigh(mask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) {
    const kick = Math.max(pairs[2] ?? -1, singles[0] ?? -1);
    return pack(2, [pairs[0], pairs[1], kick]);
  }
  if (pairs.length) return pack(1, [pairs[0], ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}

export const categoryOf = (score) => Math.floor(score / 16 ** 5);
