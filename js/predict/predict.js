// The prediction step: before your first decision on each street you tap in his range (10
// blocks over Strong / Medium / Draws / Air) and what you expect him to do. It's graded
// against his real range (the tracker) and his real policy, separately from your action.
import { legalActions, activePlayers, POSTFLOP_ORDER } from '../engine/game.js';
import { RANKS } from '../engine/cards.js';
import { trackHand, comboBuckets, bucketShares, COMBOS_BY_CODE, fullRange } from '../range/tracker.js';
import { heroOption, responseTo } from '../range/whatif.js';

export const BUCKETS = ['strong', 'medium', 'draws', 'air'];
export const BUCKET_LABEL = { strong: 'Strong', medium: 'Medium', draws: 'Draws', air: 'Air' };

// [OUTSIDE SOURCE] preflop buckets (the brain's buckets are postflop hand classes):
// Strong = premiums, Medium = broadways and good aces, Draws = speculative hands that want
// to flop big (pairs, suited connectors/gappers, suited aces), Air = the rest.
export function preflopBucket(code) {
  const hi = RANKS.indexOf(code[0]), lo = RANKS.indexOf(code[1]);
  const pair = hi === lo, suited = code[2] === 's';
  if ((pair && hi >= 8) || code === 'AKs' || code === 'AKo' || code === 'AQs') return 'strong';
  if (!pair && hi >= 8 && lo >= 8) return 'medium';
  if (!pair && hi === 12 && lo >= 8) return 'medium';
  if (pair) return 'draws';
  if (suited && (hi === 12 || hi - lo <= 2)) return 'draws';
  return 'air';
}
export const PREFLOP_BUCKETS = Object.fromEntries(Object.keys(COMBOS_BY_CODE).map((c) => [c, preflopBucket(c)]));

function preflopShares(w) {
  const s = { strong: 0, medium: 0, draws: 0, air: 0 };
  let t = 0;
  for (const [code, ks] of Object.entries(COMBOS_BY_CODE)) {
    const x = ks.reduce((a, k) => a + w[k], 0);
    s[PREFLOP_BUCKETS[code]] += x; t += x;
  }
  for (const b of BUCKETS) s[b] = t ? s[b] / t : 0;
  return s;
}

const acted = (h, i, street) => h.log.some((e) => e.street === street && e.i === i && !['post', 'deal', 'uncalled'].includes(e.type));
const actsAfter = (h, a, b) => POSTFLOP_ORDER.indexOf(a) > POSTFLOP_ORDER.indexOf(b);

// Who to read and which questions to ask, at your decision now.
export function predictionContext(h) {
  const la = legalActions(h);
  const heroIdx = h.heroIdx;
  const live = activePlayers(h).filter((p) => p.i !== heroIdx).map((p) => p.i);
  if (!la || !live.length) return null;
  const street = h.street;
  // Villains whose range means something: they've put money in voluntarily or acted.
  const readable = live.filter((i) => street !== 'preflop' || h.log.some((e) => e.street === 'preflop' && e.i === i && (e.type === 'call' || e.type === 'raise')));
  let target;
  const lastAgg = [...h.log].reverse().find((e) => e.street === street && (e.type === 'bet' || e.type === 'raise') && e.i !== heroIdx);
  if (lastAgg && readable.includes(lastAgg.i)) target = lastAgg.i;
  else if (street !== 'preflop' && readable.includes(h.preflopAggressor)) target = h.preflopAggressor;
  else target = readable[0] ?? null;

  const questions = [];
  if (street === 'preflop') {
    if (target == null) questions.push({ id: 'ifOpen', heroKind: 'raise', ask: 'If you open, the players behind…', options: [['fold', 'All fold'], ['call', 'Someone calls'], ['raise', 'Someone 3-bets']] });
    else if (la.toCall > 0 && h.raiseLevel >= 2) questions.push({ id: 'ifRaise', heroKind: 'raise', ask: `If you ${h.raiseLevel === 2 ? '3-bet' : 're-raise'}, he…`, options: [['fold', 'Folds'], ['call', 'Calls'], ['raise', h.raiseLevel === 2 ? '4-bets' : 'Re-raises']] });
    else questions.push({ id: 'ifRaise', heroKind: 'raise', ask: 'If you raise, he…', options: [['fold', 'Folds'], ['call', 'Calls'], ['raise', 'Re-raises']] });
  } else if (la.toCall > 0) {
    questions.push({ id: 'ifRaise', heroKind: 'raise', ask: 'If you raise, he…', options: [['fold', 'Folds'], ['call', 'Calls'], ['raise', 'Re-raises']] });
  } else {
    questions.push({ id: 'ifBet', heroKind: 'bet', ask: 'If you bet, he…', options: [['fold', 'Folds'], ['call', 'Calls'], ['raise', 'Raises']] });
    if (target != null && !acted(h, target, street) && actsAfter(h, target, heroIdx)) {
      questions.push({ id: 'ifCheck', heroKind: 'check', ask: 'If you check, he…', options: [['check', 'Checks'], ['bet', 'Bets']] });
    }
  }
  return { street, target, targets: readable, questions, askRange: target != null };
}

// The truth at this decision: his range by bucket, and his real response mix per question.
export function computeTruth(h, ctx, target = ctx.target) {
  const { ranges } = trackHand(h);
  const truth = { street: ctx.street, target, shares: null, answers: {} };
  const w = target != null ? ranges[target].w : null;
  let buckets = null;
  if (w) {
    if (ctx.street === 'preflop') { truth.shares = preflopShares(w); buckets = PREFLOP_BUCKETS; }
    else { buckets = comboBuckets(h.board, ctx.street); truth.shares = bucketShares(w, buckets); }
  }
  truth.w = w;
  truth.buckets = buckets;
  for (const q of ctx.questions) {
    const action = heroOption(h, q.heroKind);
    if (!action) continue;
    if (q.id === 'ifOpen') {
      // Everyone behind with an unknown (full) range: P(all fold), P(someone raises), else a call.
      const behind = activePlayers(h).filter((p) => p.i !== h.heroIdx && !acted(h, p.i, 'preflop')).map((p) => p.i);
      let allFold = 1, noRaise = 1;
      for (const i of behind) {
        const r = responseTo(h, h.heroIdx, action, i, ranges[i]?.w || fullRange(new Set(h.players[h.heroIdx].cards)));
        if (!r) continue;
        allFold *= r.mix.fold || 0;
        noRaise *= 1 - (r.mix.raise || 0);
      }
      truth.answers[q.id] = { mix: { fold: allFold, raise: 1 - noRaise, call: Math.max(0, noRaise - allFold) }, action };
      continue;
    }
    const r = responseTo(h, h.heroIdx, action, target, w, buckets);
    if (r) truth.answers[q.id] = { mix: r.mix, byBucket: r.byBucket, action };
  }
  return truth;
}

// [OUTSIDE SOURCE] thresholds, default, Joan to review.
export const GRADE_RULES = { rangeGood: 20, rangeOk: 40, answerClose: 0.1, answerOk: 0.25 };

export function gradePrediction(pred, truth) {
  const out = { range: null, answers: {} };
  if (pred.blocks && truth.shares) {
    // Total variation distance in percentage points: half the sum of the gaps.
    const gaps = BUCKETS.map((b) => Math.abs(pred.blocks[b] * 10 - truth.shares[b] * 100));
    const off = gaps.reduce((a, x) => a + x, 0) / 2;
    const mark = off <= GRADE_RULES.rangeGood ? '✅' : off <= GRADE_RULES.rangeOk ? '⚠️' : '❌';
    const worst = BUCKETS.reduce((m, b) => (Math.abs(pred.blocks[b] * 10 - truth.shares[b] * 100) > Math.abs(pred.blocks[m] * 10 - truth.shares[m] * 100) ? b : m), 'strong');
    const dir = pred.blocks[worst] * 10 > truth.shares[worst] * 100 ? 'too much' : 'too little';
    out.range = { mark, off: Math.round(off), worst, dir };
  }
  for (const [id, pick] of Object.entries(pred.answers || {})) {
    const t = truth.answers[id];
    if (!t) continue;
    const entries = Object.entries(t.mix).sort((a, b) => b[1] - a[1]);
    const [top, pTop] = entries[0];
    const p = t.mix[pick] || 0;
    const mark = pick === top || pTop - p <= GRADE_RULES.answerClose ? '✅' : p >= GRADE_RULES.answerOk ? '⚠️' : '❌';
    out.answers[id] = { mark, pick, p, top, pTop };
  }
  return out;
}

const pct = (x) => `${Math.round(x * 100)}%`;
export function blocksText(blocks) {
  return BUCKETS.map((b) => `${blocks[b]} ${BUCKET_LABEL[b]}`).join(' / ');
}

// One line per street for Copy for coach.
export function predictionLine(h, pred) {
  const street = pred.street[0].toUpperCase() + pred.street.slice(1);
  const who = pred.target != null ? h.players[pred.target].pos : 'the table';
  const parts = [];
  if (pred.blocks) parts.push(`his range ${blocksText(pred.blocks)}`);
  for (const q of pred.questions || []) {
    const pick = pred.answers?.[q.id];
    if (pick) parts.push(`${q.ask.replace(/…$/, '').toLowerCase()} ${(q.options.find((o) => o[0] === pick) || [pick, pick])[1].toLowerCase()}`);
  }
  return `${street} read (vs ${who}): ${parts.join('; ')}`;
}

export { pct };

// What goes in the saved hand record (no big arrays).
export function summarizePredictions(h) {
  const out = {};
  for (const [street, p] of Object.entries(h.predictions || {})) {
    out[street] = {
      target: p.target, targetPos: p.target != null ? h.players[p.target].pos : null, blocks: p.blocks, answers: p.answers,
      questions: p.questions, shares: p.truth?.shares || null,
      mixes: Object.fromEntries(Object.entries(p.truth?.answers || {}).map(([k, v]) => [k, v.mix])),
      grade: p.grade, line: p.line,
    };
  }
  return out;
}
