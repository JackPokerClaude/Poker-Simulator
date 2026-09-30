// "What happens if...?": apply a hypothetical action for you, then ask the villain's policy
// how every hand in his range answers it. Heads-up this is exact; multiway it treats him as
// next to act (players in between are skipped), which the feedback labels.
import { applyAction, legalActions, potTotal } from '../engine/game.js';
import { villainPolicy } from '../engine/policy.js';
import { boardTable } from '../engine/strength.js';
import { COMBOS, CODE_OF, COMBOS_BY_CODE } from './tracker.js';
import { roundBet } from '../engine/policy.js';

// Collapse policy labels to what the question asks about.
export const RESPONSE = (label) => (label.startsWith('raise') ? 'raise' : label.startsWith('bet') ? 'bet' : label === 'limp' ? 'call' : label);

// Hypothetical hero actions, sized like the quick buttons.
export function heroOption(s, kind) {
  const la = legalActions(s);
  if (!la) return null;
  const pot = potTotal(s);
  const clampTo = (to) => Math.max(la.minTo, Math.min(la.maxTo, roundBet(to, s.stakes)));
  switch (kind) {
    case 'check': return la.canCheck ? { type: 'check' } : null;
    case 'call': return la.canCall ? { type: 'call' } : null;
    case 'fold': return la.canFold ? { type: 'fold' } : null;
    case 'betSmall': return la.canRaise && la.isBet ? { type: 'bet', to: clampTo(pot * 0.33) } : null;
    case 'betBig': return la.canRaise && la.isBet ? { type: 'bet', to: clampTo(pot * 0.75) } : null;
    case 'bet': return la.canRaise && la.isBet ? { type: 'bet', to: clampTo(pot * 0.5) } : null;
    case 'raise': {
      if (!la.canRaise) return null;
      if (s.street === 'preflop' && s.raiseLevel === 1) {
        const limpers = s.log.filter((e) => e.street === 'preflop' && e.type === 'call' && e.level === 1).length;
        return { type: 'raise', to: clampTo(s.stakes.bb * 5 + limpers * s.stakes.bb) };
      }
      return { type: 'raise', to: clampTo(s.currentBet * 3 + (s.street === 'preflop' ? 0 : (pot - s.currentBet) * 0.25)) };
    }
    default: return null;
  }
}

// After you take `action` in state s, how does villain `vi` with range w respond?
// Returns { mix: {fold, call, raise, check, bet}, byBucket: {bucket: mix}, action }.
export function responseTo(s, heroIdx, action, vi, w, buckets = null) {
  if (!action) return null;
  const st = structuredClone(s);
  try { applyAction(st, action); } catch { return null; }
  if (st.done || st.awaitingDeal || st.players[vi].folded || st.players[vi].allIn) return null;
  st.toAct = vi; // multiway: treat him as next to act
  const la = legalActions(st);
  if (!la) return null;
  const mix = {};
  const byBucket = {};
  let tot = 0;
  const add = (m, k, x) => { m[k] = (m[k] || 0) + x; };
  if (st.street === 'preflop') {
    for (const [code, ks] of Object.entries(COMBOS_BY_CODE)) {
      const wc = ks.reduce((a, k) => a + w[k], 0);
      if (wc <= 0) continue;
      const opts = villainPolicy(st, vi, COMBOS[ks.find((k) => w[k] > 0)]);
      for (const o of opts) {
        add(mix, RESPONSE(o.label), wc * o.p);
        if (buckets) add(byBucket[buckets[code]] ||= {}, RESPONSE(o.label), wc * o.p);
      }
      tot += wc;
    }
  } else {
    const table = boardTable(st.board);
    for (let k = 0; k < w.length; k++) {
      if (w[k] <= 0) continue;
      const opts = villainPolicy(st, vi, COMBOS[k], table);
      for (const o of opts) {
        add(mix, RESPONSE(o.label), w[k] * o.p);
        if (buckets?.[k]) add(byBucket[buckets[k]] ||= {}, RESPONSE(o.label), w[k] * o.p);
      }
      tot += w[k];
    }
  }
  const norm = (m) => { const t = Object.values(m).reduce((a, x) => a + x, 0) || 1; for (const k of Object.keys(m)) m[k] /= t; return m; };
  norm(mix);
  for (const b of Object.keys(byBucket)) norm(byBucket[b]);
  void tot; void CODE_OF;
  return { mix, byBucket, action, state: st };
}
