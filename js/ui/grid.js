// 13x13 hand grid. Each cell is split left to right by share: preflop by action
// (raise / call / fold), postflop by bucket (strong / medium / draws / air) plus "gone" for
// hands that dropped out this street. Blank = not in his range.
import { RANKS } from '../engine/cards.js';

export const SEG_ORDER = {
  action: ['raise', 'call', 'fold'],
  bucket: ['strong', 'medium', 'draws', 'air', 'gone'],
};
export const SEG_LABEL = {
  raise: 'Raise', call: 'Call', fold: 'Fold', strong: 'Strong value', medium: 'Medium', draws: 'Draws', air: 'Air', gone: 'Dropped this street',
};

const cellBg = (segs, order) => {
  let x = 0;
  const stops = [];
  for (const k of order) {
    const f = Math.min(1 - x, segs[k] || 0);
    if (f <= 0.001) continue;
    stops.push(`var(--g-${k}) ${(x * 100).toFixed(1)}% ${((x + f) * 100).toFixed(1)}%`);
    x += f;
  }
  if (x < 0.999) stops.push(`transparent ${(x * 100).toFixed(1)}% 100%`);
  return stops.length ? `linear-gradient(90deg, ${stops.join(', ')})` : 'none';
};

// cells: from tracker.gridCells, in ALL_CODES order (AA, AKs, ... row by row).
export function gridHTML(cells, { mode = 'bucket', highlight = null, shares = null } = {}) {
  const order = SEG_ORDER[mode];
  const body = cells.map((c) => {
    const inRange = order.some((k) => k !== 'gone' && k !== 'fold' && (c.segs[k] || 0) > 0.001);
    return `<div class="gc${inRange ? ' in' : ''}${highlight === c.code ? ' hl' : ''}" style="background-image:${cellBg(c.segs, order)}" title="${c.code}">${c.code}</div>`;
  }).join('');
  const legend = order.map((k) => `<span class="gl"><i style="background:var(--g-${k})"></i>${SEG_LABEL[k]}${shares && k in shares ? ` ${Math.round(shares[k] * 100)}%` : ''}</span>`).join('');
  return `<div class="hgrid" role="img" aria-label="13 by 13 hand grid">${body}</div><div class="glegend">${legend}</div>`;
}
void RANKS;
