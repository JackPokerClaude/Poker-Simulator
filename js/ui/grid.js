// 13x13 hand grid, two separate visuals:
//   Frequency: the colored bar's width = how often he holds this hand here, as a share of its
//              combos your cards and the board don't block (100% = every live combo). The bar
//              is split by hand class postflop, or by his action (raise / call / fold) preflop.
//   Gray:      the part of that hand he dropped this street (postflop only).
//   Card removal: a small "live/total" count in the corner when some combos are blocked, and a
//              hatched cell when all of them are.
// Tap a cell for its combos and weights; tap a class in the legend for its definition.
import { ALL_CODES, combosOf, cardPretty } from '../engine/cards.js';
import { COMBOS_BY_CODE, COMBOS } from '../range/tracker.js';
import { CLASSES, CLASS_LABEL } from '../range/classes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
export const ACTION_SEGS = [
  { key: 'raise', label: 'Raise', color: 'var(--g-raise)' },
  { key: 'call', label: 'Call / limp / check', color: 'var(--g-call)' },
  { key: 'fold', label: 'Fold', color: 'var(--g-fold)' },
];

// ---------- cells ----------
const blockedBy = (k, dead) => COMBOS[k].filter((c) => dead.has(c));

// Postflop: w = his range now, prev = his range at the start of the street, classes per combo.
export function rangeCells({ w, prev, classes, dead }) {
  return ALL_CODES.map((code) => {
    const ks = COMBOS_BY_CODE[code];
    const live = ks.filter((k) => !blockedBy(k, dead).length);
    const segs = {};
    let now = 0, before = 0;
    for (const k of live) {
      now += w[k];
      before += prev ? prev[k] : w[k];
      if (w[k] > 0 && classes[k]) segs[classes[k]] = (segs[classes[k]] || 0) + w[k];
    }
    const n = live.length || 1;
    for (const c of Object.keys(segs)) segs[c] /= n;
    return { code, live: live.length, total: combosOf(code), freq: now / n, gone: Math.max(0, before - now) / n, segs };
  });
}

// Preflop: his action mix at one decision (tracker.preflopActionMix + his range before it).
export function actionCells({ mix, before, dead }) {
  return ALL_CODES.map((code) => {
    const ks = COMBOS_BY_CODE[code];
    const live = ks.filter((k) => !blockedBy(k, dead).length);
    const n = live.length || 1;
    const prior = live.reduce((a, k) => a + before[k], 0) / n;
    const m = mix[code];
    const segs = {};
    if (m) for (const [a, p] of Object.entries(m.p)) if (p > 0) segs[a] = prior * p;
    return { code, live: live.length, total: combosOf(code), freq: prior * (1 - (m?.p.fold || 0)), prior, gone: 0, segs };
  });
}

// ---------- drawing ----------
function cellBg(c, order, withGone) {
  let x = 0;
  const stops = [];
  for (const k of order) {
    const f = Math.min(1 - x, c.segs[k.key] || 0);
    if (f <= 0.002) continue;
    stops.push(`${k.color} ${(x * 100).toFixed(1)}% ${((x + f) * 100).toFixed(1)}%`);
    x += f;
  }
  if (withGone && c.gone > 0.002) {
    const f = Math.min(1 - x, c.gone);
    stops.push(`var(--g-gone) ${(x * 100).toFixed(1)}% ${((x + f) * 100).toFixed(1)}%`);
    x += f;
  }
  if (!stops.length) return 'none';
  if (x < 0.999) stops.push(`transparent ${(x * 100).toFixed(1)}% 100%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

let seq = 0;
const REG = new Map();
export const clearGrids = () => { REG.clear(); };
export const gridDetail = (id, code) => REG.get(id)?.detail(code) || '';
export const gridClassInfo = (id, key) => REG.get(id)?.classInfo?.(key) || '';

// mode 'class' (postflop) or 'action' (preflop). shares: class shares for the legend.
// detail(code) -> HTML for a tapped cell. classInfo(key) -> HTML for a tapped legend class.
export function gridHTML(cells, { mode = 'class', shares = null, detail = null, classInfo = null, combosLeft = null } = {}) {
  const id = `g${++seq}`;
  REG.set(id, { detail: detail || (() => ''), classInfo });
  const order = mode === 'action' ? ACTION_SEGS : CLASSES;
  const body = cells.map((c) => {
    const blocked = c.live === 0;
    const filled = mode === 'action' ? (c.segs.raise || 0) + (c.segs.call || 0) : c.freq;
    const cls = `gc${blocked ? ' blk' : ''}${filled > 0.45 ? ' in' : ''}`;
    return `<button type="button" class="${cls}" data-code="${c.code}" style="background-image:${blocked ? 'none' : cellBg(c, order, mode === 'class')}"><span class="lab">${c.code}</span>${!blocked && c.live < c.total && (filled > 0.002 || c.gone > 0.002) ? `<span class="cr">${c.live}/${c.total}</span>` : ''}</button>`;
  }).join('');
  const legend = order.map((k) => `<button type="button" class="gl" data-cls="${k.key}"${mode === 'class' && classInfo ? '' : ' disabled'}><i style="background:${k.color}"></i>${esc(k.label)}${shares && k.key in shares ? ` <b>${pct(shares[k.key])}</b>` : ''}</button>`).join('');
  const key = mode === 'class'
    ? '<div class="gkey">Bar width = how often he has the hand (share of its unblocked combos). Gray = dropped this street. 2/4 in a colored cell = only 2 of its 4 combos are possible (your cards and the board block the rest). Hatched = all combos blocked. Blank = not in his range. Tap a cell for its combos, a class for its definition.</div>'
    : '<div class="gkey">Bar width = how often the hand was still in his range before this action (share of unblocked combos), split by what he does with it. 2/4 in a colored cell = only 2 of its 4 combos are possible (your cards block the rest). Hatched = all blocked. Blank = not in his range. Tap a cell for its combos.</div>';
  return `<div class="gwrap" data-grid="${id}"><div class="hgrid" role="group" aria-label="13 by 13 hand grid">${body}</div>
    <div class="glegend">${legend}</div>${combosLeft != null ? `<div class="gcount">${esc(combosLeft)}</div>` : ''}${key}<div class="gdetail" hidden></div></div>`;
}

// Combos of one cell, for the tap-through.
export function comboList(code, { w, prev, classes, dead, actionMix, before }) {
  const rows = COMBOS_BY_CODE[code].map((k) => {
    const cards = COMBOS[k].map(cardPretty).join(' ');
    const b = blockedBy(k, dead);
    if (b.length) return `<tr><td>${cards}</td><td colspan="2" class="muted">blocked by ${b.map(cardPretty).join(' ')}</td></tr>`;
    if (actionMix) {
      const m = actionMix[code];
      const p = m ? Object.entries(m.p).filter(([, x]) => x > 0.005).map(([a, x]) => `${a} ${pct(x)}`).join(', ') : '';
      return `<tr><td>${cards}</td><td>${pct(before[k])} in range</td><td>${esc(p)}</td></tr>`;
    }
    const was = prev ? prev[k] : w[k];
    return `<tr><td>${cards}</td><td>${pct(w[k])}${prev && was > w[k] + 0.005 ? ` <span class="muted">(was ${pct(was)})</span>` : ''}</td><td>${w[k] > 0 && classes?.[k] ? esc(CLASS_LABEL[classes[k]]) : '<span class="muted">not in range</span>'}</td></tr>`;
  }).join('');
  return `<div class="gd-h"><b>${code}</b> <span class="muted">weight = how often he holds this exact combo here</span></div><table class="gd-t">${rows}</table>`;
}
