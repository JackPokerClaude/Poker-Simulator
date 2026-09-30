// HHP's seven hand classes for postflop ranges, strongest first (the brain's order: "can play
// for stacks > thick value > thin value > draws > showdown value > air"). Every range view,
// grid, legend and "what happens if" breakdown reads the class list from here.
//
// Sorting rules (definitions and quotes in brain-compiled/behavior.json, "classes.*"):
//   CPFS      sets, trips, two pair using both hole cards, straights, flushes, boats and up
//   thick     overpairs; top pair with the best or second-best kicker still available
//   thin      top pair with a weaker kicker
//   highDraw  8+ outs (flush draws, open-enders, combos), flop and turn
//   lowDraw   4-7 outs (gutshots), flop and turn
//   sdv       second pair and lower, underpairs, AK/AQ-high
//   air       everything else (busted draws on the river)
// A hand that fits two classes takes the higher one in the brain's order, which puts draws
// above showdown value: a weak pair with a flush draw is a high-equity draw.
import { rankOf } from '../engine/cards.js';
import { evaluate, categoryOf } from '../engine/eval.js';
import { drawInfo } from '../engine/strength.js';
import { COMBOS } from './tracker.js';

export const CLASSES = [
  { key: 'cpfs', label: 'CPFS', color: 'var(--g-cpfs)' },
  { key: 'thick', label: 'Thick value', color: 'var(--g-thick)' },
  { key: 'thin', label: 'Thin value', color: 'var(--g-thin)' },
  { key: 'highDraw', label: 'High-equity draws', color: 'var(--g-hdraw)' },
  { key: 'lowDraw', label: 'Low-equity draws', color: 'var(--g-ldraw)' },
  { key: 'sdv', label: 'Showdown value', color: 'var(--g-sdv)' },
  { key: 'air', label: 'Air', color: 'var(--g-air)' },
];
export const CLASS_KEYS = CLASSES.map((c) => c.key);
export const CLASS_LABEL = Object.fromEntries(CLASSES.map((c) => [c.key, c.label]));

// Coarse groups, used by brain-rule conditions (heroBucket) and range claims.
export const GROUP_OF = { cpfs: 'strong', thick: 'strong', thin: 'medium', sdv: 'medium', highDraw: 'draws', lowDraw: 'draws', air: 'air' };
export const GROUPS = {
  strongValue: ['cpfs', 'thick'],
  value: ['cpfs', 'thick', 'thin'],
  draws: ['highDraw', 'lowDraw'],
  air: ['air'],
  medium: ['thin', 'sdv'],
};

// The made-hand class alone (no draws).
function madeClass(hole, board) {
  const cat = categoryOf(evaluate([...hole, ...board]));
  const boardCat = categoryOf(evaluate(board));
  if (cat >= 4 && cat > boardCat) return 'cpfs'; // straight, flush, full house, quads using your cards
  const br = board.map(rankOf);
  const uniq = [...new Set(br)].sort((a, b) => b - a);
  const [h1, h2] = hole.map(rankOf).sort((a, b) => b - a);
  const count = (r) => br.filter((x) => x === r).length;
  if (h1 === h2) {
    if (count(h1) >= 1) return 'cpfs'; // set (or better)
    if (h1 > uniq[0]) return 'thick'; // overpair
    return 'sdv'; // underpair
  }
  const m1 = count(h1), m2 = count(h2);
  if (m1 >= 2 || m2 >= 2) return 'cpfs'; // trips with a hole card
  if (m1 && m2) return 'cpfs'; // two pair using both hole cards
  const paired = m1 ? h1 : m2 ? h2 : null;
  if (paired == null) {
    // No pair of your own: AK / AQ high keeps showdown value, the rest is air.
    if (h1 === 12 && h2 >= 10 && !br.includes(12)) return 'sdv';
    return 'air';
  }
  if (paired === uniq[0]) {
    const kicker = paired === h1 ? h2 : h1;
    const avail = [];
    for (let r = 12; r >= 0 && avail.length < 2; r--) if (!br.includes(r) && r !== paired) avail.push(r);
    return avail.includes(kicker) ? 'thick' : 'thin';
  }
  return 'sdv'; // second pair or lower
}

export function classify(hole, board, street) {
  const made = madeClass(hole, board);
  if (made === 'cpfs' || made === 'thick' || made === 'thin') return made;
  if (street !== 'river') {
    const d = drawInfo(hole, board);
    if (d.flushDraw || d.oesd || d.outs >= 8) return 'highDraw';
    if (d.gutshot || d.outs >= 4) return 'lowDraw';
  }
  return made;
}

// Class of every combo on this board (null where the combo uses a board card).
export function comboClasses(board, street) {
  const dead = new Set(board);
  return COMBOS.map((c) => (dead.has(c[0]) || dead.has(c[1]) ? null : classify(c, board, street)));
}

// Share of the weighted range in each class (0-1, sums to 1 when the range isn't empty).
export function classShares(w, classes) {
  const s = Object.fromEntries(CLASS_KEYS.map((k) => [k, 0]));
  let t = 0;
  for (let k = 0; k < w.length; k++) if (w[k] > 0 && classes[k]) { s[classes[k]] += w[k]; t += w[k]; }
  for (const k of CLASS_KEYS) s[k] = t ? s[k] / t : 0;
  return s;
}

export const groupShare = (shares, group) => (GROUPS[group] || []).reduce((a, k) => a + (shares[k] || 0), 0);

// Definitions shown when you tap a class, filled from the compiled layer (classes.*).
export const CLASS_INFO = {};
export function setClassInfo(model) {
  for (const k of CLASS_KEYS) {
    const rec = model.rec(`classes.${k}`);
    if (!rec) continue;
    CLASS_INFO[k] = {
      label: rec.v?.label || CLASS_LABEL[k],
      rule: rec.v?.rule || '',
      quote: rec.tag === 'HHP' ? rec.src.quote : null,
      tag: rec.tag === 'HHP' ? `[HHP] ${rec.src.file} › ${rec.src.section}${rec.src.date ? ` · ${rec.src.date}` : ''}${rec.interp ? ` (sorting rule: ${rec.interp})` : ''}` : '[OUTSIDE SOURCE]',
    };
  }
}
