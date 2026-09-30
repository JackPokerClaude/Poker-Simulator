// Your equity against his real range (the tracker's weights), computed, never from memory.
// Turn and river are exact; the flop samples the turn+river runouts (the count is shown).
import { evaluate } from '../engine/eval.js';
import { COMBOS } from '../range/tracker.js';

// Small seeded PRNG so the same hand always shows the same numbers.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runouts(hero, board, { samples = 160, seed = 7 } = {}) {
  const dead = new Set([...hero, ...board]);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  const need = 5 - board.length;
  if (need === 0) return { list: [[]], exact: true };
  if (need === 1) return { list: deck.map((c) => [c]), exact: true };
  const rnd = mulberry32(seed + board.reduce((a, c) => a * 53 + c, 0) + hero[0] * 7 + hero[1]);
  const list = [];
  for (let n = 0; n < samples; n++) {
    const picked = new Set();
    while (picked.size < need) picked.add(deck[Math.floor(rnd() * deck.length)]);
    list.push([...picked]);
  }
  return { list, exact: false };
}

// Per-combo equity for every combo with weight > 0, and the weighted total.
export function equityVsRange(hero, board, w, opts = {}) {
  const { list, exact } = runouts(hero, board, opts);
  const eq = new Float64Array(COMBOS.length).fill(NaN);
  const heroVals = list.map((r) => evaluate([...hero, ...board, ...r]));
  let tw = 0, te = 0, combos = 0;
  for (let k = 0; k < COMBOS.length; k++) {
    if (!(w[k] > 0)) continue;
    const [a, b] = COMBOS[k];
    let win = 0, tie = 0, n = 0;
    for (let j = 0; j < list.length; j++) {
      const r = list[j];
      if (r.includes(a) || r.includes(b)) continue;
      const v = evaluate([a, b, ...board, ...r]);
      if (heroVals[j] > v) win++; else if (heroVals[j] === v) tie++;
      n++;
    }
    if (!n) continue;
    eq[k] = (win + tie / 2) / n;
    tw += w[k]; te += w[k] * eq[k]; combos++;
  }
  return { eq, total: tw ? te / tw : 0, combos, runouts: list.length, exact };
}

// Weighted equity over a sub-range (e.g. just the hands that call).
export function equityOver(eqArr, weights) {
  let tw = 0, te = 0;
  for (let k = 0; k < weights.length; k++) if (weights[k] > 0 && !Number.isNaN(eqArr[k])) { tw += weights[k]; te += weights[k] * eqArr[k]; }
  return tw ? te / tw : 0;
}
