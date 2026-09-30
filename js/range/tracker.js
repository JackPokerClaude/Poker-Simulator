// Range tracker: replays a hand from the deal and narrows each villain's range with his own
// policy (Bayes: weight of each hand x the chance his policy takes the action he took).
// Because the villain acts from that same policy, this is his real range, not a guess.
//
// A range is a Float64Array of 1326 weights (one per two-card combo). Hero's cards and the
// board are removed as they become known to you.
import { handCode, ALL_CODES, combosOf, rankOf, suitOf } from '../engine/cards.js';
import { createGame, applyAction, dealNextStreet } from '../engine/game.js';
import { villainPolicy, probOf, threeBetRangeHas } from '../engine/policy.js';
import { boardTable } from '../engine/strength.js';

// ---------- combos ----------
export const COMBOS = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) COMBOS.push([b, a]);
export const CODE_OF = COMBOS.map(([a, b]) => handCode(a, b));
export const COMBOS_BY_CODE = {};
COMBOS.forEach((c, k) => { (COMBOS_BY_CODE[CODE_OF[k]] ||= []).push(k); });
export const comboIndex = (a, b) => COMBOS.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));

const clash = (k, dead) => dead.has(COMBOS[k][0]) || dead.has(COMBOS[k][1]);

export function fullRange(dead = new Set()) {
  const w = new Float64Array(COMBOS.length);
  for (let k = 0; k < w.length; k++) w[k] = clash(k, dead) ? 0 : 1;
  return w;
}
export const total = (w) => w.reduce((a, x) => a + x, 0);

// ---------- one update ----------
// w *= P(label | hand) for every hand the villain could hold at this decision.
function update(w, s, i, entry, dead) {
  const label = entry.meta?.label;
  if (!label) return { ok: false };
  const next = new Float64Array(w.length);
  if (s.street === 'preflop') {
    const byCode = {};
    for (const code of ALL_CODES) {
      const k0 = COMBOS_BY_CODE[code].find((k) => w[k] > 0);
      if (k0 == null) continue;
      if (entry.meta.forced) byCode[code] = threeBetRangeHas(s.players[i].type, code) ? 1 : 0;
      else byCode[code] = probOf(villainPolicy(s, i, COMBOS[k0]), label);
    }
    for (let k = 0; k < w.length; k++) if (w[k] > 0) next[k] = w[k] * (byCode[CODE_OF[k]] ?? 0);
  } else {
    const table = boardTable(s.board);
    for (let k = 0; k < w.length; k++) {
      if (w[k] <= 0 || clash(k, dead)) continue;
      next[k] = w[k] * probOf(villainPolicy(s, i, COMBOS[k], table), label);
    }
  }
  // An action his policy can't produce (a safety fallback in the engine): keep the old range.
  if (total(next) <= 1e-12) return { ok: false };
  w.set(next);
  return { ok: true };
}

// Replay the hand. heroIdx's cards are dead from the start (you know them). Returns per
// villain: the range after each street's betting, and every action with the range before it.
// stopAt (optional): log index to stop before (to get ranges at a decision in progress).
export function trackHand(hand, { stopAt = hand.log.length, onDecision } = {}) {
  const init = hand.initial;
  if (!init) throw new Error('Hand has no replay data.');
  const s = createGame({ stakes: init.stakes, players: init.players.map((p) => ({ ...p, cards: [...p.cards], meta: { ...p.meta } })), runout: init.runout });
  s.heroIdx = hand.heroIdx;
  s.drill = hand.drill;
  const hero = init.players[hand.heroIdx];
  const dead = new Set(hero.cards);
  const villains = init.players.map((p, i) => i).filter((i) => i !== hand.heroIdx);
  const R = {};
  for (const i of villains) R[i] = { w: fullRange(dead), streets: {}, actions: [], start: {} };
  const snapStreet = (street) => { for (const i of villains) R[i].streets[street] = Float64Array.from(R[i].w); };
  const snapStart = (street) => { for (const i of villains) R[i].start[street] = Float64Array.from(R[i].w); };
  snapStart('preflop');

  for (let n = 0; n < Math.min(stopAt, hand.log.length); n++) {
    const e = hand.log[n];
    if (e.type === 'post' || e.type === 'uncalled') continue;
    if (e.type === 'deal') {
      snapStreet(s.street);
      dealNextStreet(s);
      for (const c of s.board) dead.add(c);
      for (const i of villains) for (let k = 0; k < R[i].w.length; k++) if (R[i].w[k] > 0 && clash(k, dead)) R[i].w[k] = 0;
      snapStart(s.street);
      continue;
    }
    if (s.toAct !== e.i) break; // replay out of sync; stop rather than guess
    if (e.i !== hand.heroIdx) {
      const before = Float64Array.from(R[e.i].w);
      onDecision?.(s, e, R);
      const res = update(R[e.i].w, s, e.i, e, dead);
      R[e.i].actions.push({ n, street: s.street, label: e.meta?.label, entry: e, before, after: Float64Array.from(R[e.i].w), ok: res.ok, state: structuredClone(s) });
    } else onDecision?.(s, e, R);
    applyAction(s, { type: e.type === 'bet' ? 'bet' : e.type, to: e.to, meta: e.meta });
  }
  snapStreet(s.street);
  return { ranges: R, state: s, dead };
}

// ---------- summaries ----------
// (Postflop hand classes live in classes.js; grid cells in ui/grid.js.)

// His preflop action mix per code at one decision: { code: { w: prior weight, p: {raise, call, fold} } }.
export function preflopActionMix(act) {
  const out = {};
  for (const code of ALL_CODES) {
    const ks = COMBOS_BY_CODE[code];
    const wsum = ks.reduce((a, k) => a + act.before[k], 0);
    if (wsum <= 0) continue;
    const k0 = ks.find((k) => act.before[k] > 0);
    const opts = villainPolicy(act.state, act.entry.i, COMBOS[k0]);
    const p = { raise: 0, call: 0, fold: 0 };
    for (const o of opts) {
      const a = o.label.startsWith('raise') ? 'raise' : o.label === 'call' || o.label === 'limp' || o.label === 'check' ? 'call' : 'fold';
      p[a] += o.p;
    }
    out[code] = { w: wsum, p };
  }
  return out;
}

export const suitedness = (k) => (suitOf(COMBOS[k][0]) === suitOf(COMBOS[k][1]) ? 's' : rankOf(COMBOS[k][0]) === rankOf(COMBOS[k][1]) ? 'p' : 'o');
