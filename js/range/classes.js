// Hand classes for postflop ranges. Every range view, grid, legend and "what happens if"
// breakdown reads the class list from here.
import { boardTable, features, bucketOf } from '../engine/strength.js';
import { COMBOS } from './tracker.js';

// Order = strongest first.
export const CLASSES = [
  { key: 'strong', label: 'Strong', color: 'var(--g-strong)' },
  { key: 'medium', label: 'Medium', color: 'var(--g-medium)' },
  { key: 'draws', label: 'Draws', color: 'var(--g-draws)' },
  { key: 'air', label: 'Air', color: 'var(--g-air)' },
];
export const CLASS_KEYS = CLASSES.map((c) => c.key);
export const CLASS_LABEL = Object.fromEntries(CLASSES.map((c) => [c.key, c.label]));

// Coarse groups, used by brain-rule conditions (heroBucket) and range claims.
export const GROUP_OF = { strong: 'strong', medium: 'medium', draws: 'draws', air: 'air' };
export const GROUPS = {
  strongValue: ['strong'],
  value: ['strong', 'medium'],
  draws: ['draws'],
  air: ['air'],
};

export function classify(hole, board, street, table = boardTable(board)) {
  return bucketOf(features(hole, board, table), street);
}

// Class of every combo on this board (null where the combo uses a board card).
export function comboClasses(board, street) {
  const table = boardTable(board);
  const dead = new Set(board);
  return COMBOS.map((c) => (dead.has(c[0]) || dead.has(c[1]) ? null : classify(c, board, street, table)));
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

// Definitions shown when you tap a class (item 3 adds the brain quotes).
export const CLASS_INFO = {};
