// Preflop grading vs HHP charts + HHP sizing rules. Postflop is left to the coach.
import { POSTFLOP_ORDER } from '../engine/game.js';

const ACTION_NAMES = { raise: 'Raise', 'iso-raise': 'Iso-raise', '3bet': '3-bet', '4bet': '4-bet', '5bet': '5-bet',
  squeeze: 'Squeeze', call: 'Call', overlimp: 'Overlimp', 'soft-table limp': 'Soft-table limp' };
const nice = (a) => ACTION_NAMES[a] || a;

export function chartRow(ranges, chartName, code) {
  const c = ranges.charts[chartName];
  if (!c) return null;
  const h = c.hands[code];
  if (!h) return null;
  const [a, cp, o, f, sit, noteIdx] = h;
  return { chart: c, a, c: cp, o, f, situational: !!sit, note: noteIdx >= 0 ? ranges.notes[noteIdx] : '' };
}

export const isPlayable = (row) => !!row && (row.a > 0 || row.c > 0);

export function freqText(row) {
  const { actions } = row.chart;
  const parts = [];
  if (row.a) parts.push(`${nice(actions.aggressive)} ${row.a}%`);
  if (row.c) parts.push(`${nice(actions.call)} ${row.c}%`);
  if (row.o) parts.push(`${nice(actions.other)} ${row.o}%`);
  if (row.f) parts.push(`Fold ${row.f}%`);
  return parts.join(' · ') || 'Fold 100%';
}

// Map hero's action to the chart column and return the chart frequency for it.
function pctForAction(row, spot, action) {
  const limpish = /limp/.test(row.chart.actions.other || '');
  if (action === 'raise' || action === 'bet') return row.a;
  if (action === 'call' || action === 'check') return row.c + (limpish ? row.o : 0);
  if (action === 'fold') return spot.kind === 'BB_LIMP' ? 0 : row.f;
  return 0;
}

const heroActionName = (spot, action, row) => {
  if (action === 'fold') return 'Fold';
  if (action === 'check') return 'Check';
  if (action === 'call') return spot.kind === 'ISO' || spot.kind === 'RFI' ? 'Limp' : 'Call';
  return nice(row?.chart.actions.aggressive || 'raise');
};

export function gradeDecision({ ranges, spot, code, action }) {
  const out = { kind: spot.kind, label: spot.label, chart: spot.chart, exact: spot.exact, code, action };
  if (spot.kind === 'NONE' || !spot.chart) {
    out.heroAction = { fold: 'Fold', check: 'Check', call: 'Call', raise: 'Raise' }[action] || action;
    return { ...out, verdict: 'nochart', message: spot.reason || 'No HHP chart for this spot.' };
  }
  const row = chartRow(ranges, spot.chart, code);
  if (!row) return { ...out, verdict: 'nochart', message: 'Hand missing from chart.' };
  out.heroAction = heroActionName(spot, action, row);
  out.freq = freqText(row);
  out.situational = row.situational;
  out.note = row.note;

  // Joan's rule: only 5-bet AA.
  const isFiveBetSpot = spot.kind === 'VS_4BET';
  if (isFiveBetSpot && (action === 'raise') && code !== 'AA') {
    return { ...out, verdict: 'wrong', rule: true, message: 'Your rule: only 5-bet AA.' };
  }
  if (isFiveBetSpot && code === 'AA' && action !== 'raise') {
    return { ...out, verdict: 'wrong', rule: true, message: 'Your rule: 5-bet AA. Get it in.' };
  }

  const pct = pctForAction(row, spot, action);
  const best = Math.max(row.a, row.c + (/limp/.test(row.chart.actions.other || '') ? row.o : 0), spot.kind === 'BB_LIMP' ? 0 : row.f);
  if (pct > 0 && pct >= best) return { ...out, verdict: 'correct', message: row.situational ? `Chart play. Situational hand: ${row.note}` : 'Matches the chart.' };
  if (pct > 0) return { ...out, verdict: 'mixed', message: `Mixed spot. Your play is part of the chart mix (${pct}%).` };
  if (row.situational) return { ...out, verdict: 'situational', message: row.note || 'Situational hand (Mark).' };
  return { ...out, verdict: 'wrong', message: `Chart says: ${freqText(row)}.` };
}

// ---- Sizing checks (HHP) ----
const within = (x, lo, hi) => x >= lo && x <= hi;

// ISO: 6x + 1bb per limper in position, ~7x + 1bb per limper out of position.
export function checkIsoSize({ s, heroIdx, limperIdx, to }) {
  const bb = s.stakes.bb;
  const hero = s.players[heroIdx];
  const ip = !['SB', 'BB'].includes(hero.pos) && limperIdx.every((i) => POSTFLOP_ORDER.indexOf(heroIdx) > POSTFLOP_ORDER.indexOf(i));
  const n = limperIdx.length;
  const target = (ip ? 6 : 7) * bb + n * bb;
  const ok = Math.abs(to - target) <= 1.5 * bb;
  return {
    rule: 'Iso size',
    ok,
    message: `${ip ? 'In position' : 'Out of position'}: ${ip ? 6 : 7}x + 1bb x ${n} limper${n > 1 ? 's' : ''} = $${target}. You made it $${to}${ok ? '. Good size.' : ` (${to > target ? 'too big' : 'too small'}).`}`,
  };
}

// 4-bet: ~2.5x in position, 3-3.5x out of position, and under 27.5% of the effective stack.
export function checkFourBetSize({ s, heroIdx, villainIdx, threeBetTo, to }) {
  const hero = s.players[heroIdx], v = s.players[villainIdx];
  const ip = POSTFLOP_ORDER.indexOf(heroIdx) > POSTFLOP_ORDER.indexOf(villainIdx);
  const ratio = to / threeBetTo;
  const eff = Math.min(hero.startStack, v.startStack);
  const cap = Math.floor(eff * 0.275);
  const [lo, hi] = ip ? [2.2, 2.8] : [2.8, 3.7];
  const ratioOk = within(ratio, lo, hi);
  const capOk = to <= cap;
  const out = [{
    rule: '4-bet size',
    ok: ratioOk,
    message: `${ip ? 'In position ~2.5x' : 'Out of position ~3-3.5x'} the 3-bet ($${threeBetTo}) = $${ip ? Math.round(threeBetTo * 2.5) : `${Math.round(threeBetTo * 3)}-${Math.round(threeBetTo * 3.5)}`}. You made it $${to} (${ratio.toFixed(2)}x).`,
  }, {
    rule: '27.5% cap',
    ok: capOk,
    message: `Keep the 4-bet under 27.5% of effective ($${eff}) = $${cap}. ${capOk ? 'You did.' : `$${to} is over: ${to >= hero.startStack ? 'that is a jam.' : 'too committed.'}`}`,
  }];
  return out;
}
