// Feedback engine: builds the after-hand review in Joan's format.
//
//   PREFLOP: 1 his range (grid by action + brain paragraph), 2 the questions to ask,
//            3 your read graded, then your action graded, 4 also from the brain.
//   FLOP/TURN/RIVER: 1 his range (grid narrowed, bucket %, paragraph), 2 what happens if
//            (bet small, bet big, check; or fold, call, raise), 3 read + action graded,
//            4 verdict, 5 also from the brain.
//   END: takeaway, leak tags (repeats flagged), whole-hand brain entries.
//
// The math is a one-street model against his real range (the tracker) and his real policy:
// his response to each option, then your equity vs the hands that continue. It says so on
// screen. Where a brain rule covers the line, the brain decides the verdict (her coaches win)
// and the math is shown as [OUTSIDE SOURCE] support.
import { legalActions, applyAction, potTotal, activePlayers } from '../engine/game.js';
import { villainPolicy } from '../engine/policy.js';
import { boardTable } from '../engine/strength.js';
import { handCode, cardsPretty } from '../engine/cards.js';
import { trackHand, COMBOS, CODE_OF, total, comboBuckets, bucketShares, BUCKETS, preflopActionMix, gridCells } from '../range/tracker.js';
import { heroOption, RESPONSE } from '../range/whatif.js';
import { equityVsRange, equityOver } from './equity.js';
import { spotFeatures, betSizeClass } from './spot.js';
import { matchBrain } from './match.js';
import { sourceTag, val } from '../brain/compiled.js';
import { villainLabel, typeLabel, styleLabel } from '../villains/model.js';
import { isInvolved } from '../engine/coach.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const usd = (x) => {
  const a = Math.abs(x);
  const body = Number.isInteger(x) || a >= 100 ? String(Math.round(a)) : a.toFixed(a < 10 ? 1 : 0);
  return `${x < 0 ? '−' : ''}$${body}`;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const BUCKET_NAME = { strong: 'Strong', medium: 'Medium', draws: 'Draws', air: 'Air' };

// ---------------------------------------------------------------- his response, per combo
function responseMatrix(st, heroIdx, action, vi, w) {
  const s2 = structuredClone(st);
  try { applyAction(s2, action); } catch { return null; }
  if (s2.done || s2.awaitingDeal || s2.players[vi].folded || s2.players[vi].allIn) return { ended: true, state: s2 };
  s2.toAct = vi; // multiway: he answers as if next to act (the screen says so)
  const la = legalActions(s2);
  if (!la) return { ended: true, state: s2 };
  const P = {};
  const to = {};
  const table = s2.street === 'preflop' ? null : boardTable(s2.board);
  const byCode = {};
  for (let k = 0; k < w.length; k++) {
    if (!(w[k] > 0)) continue;
    let opts;
    if (s2.street === 'preflop') opts = byCode[CODE_OF[k]] ||= villainPolicy(s2, vi, COMBOS[k]);
    else opts = villainPolicy(s2, vi, COMBOS[k], table);
    for (const o of opts) {
      const r = RESPONSE(o.label);
      (P[r] ||= new Float64Array(w.length))[k] += o.p;
      if (o.act.to && !to[r]) to[r] = o.act.to;
    }
  }
  return { P, to, state: s2, la };
}

const wsum = (w, p) => { let t = 0; for (let k = 0; k < w.length; k++) if (w[k] > 0) t += w[k] * (p ? p[k] : 1); return t; };
const mul = (w, p) => { const out = new Float64Array(w.length); for (let k = 0; k < w.length; k++) out[k] = w[k] * (p ? p[k] : 0); return out; };

// ---------------------------------------------------------------- one option's EV, with the math
function evalOption(ctx, kind, action) {
  const { st, heroIdx, vi, w, eq, buckets } = ctx;
  const hero = st.players[heroIdx];
  const P = potTotal(st);
  const W = wsum(w);
  const lines = [];
  const opt = { kind, action, lines, ev: 0 };
  const eqAll = eq.total;
  if (kind === 'fold') {
    opt.ev = 0;
    lines.push(`Fold: $0. You give up your ${pct(eqAll)} of a ${usd(P)} pot.`);
    return opt;
  }
  if (kind === 'call') {
    const la = legalActions(st);
    const t = la.toCall;
    const need = t / (P + t);
    opt.ev = eqAll * (P + t) - t;
    opt.need = need;
    lines.push(`Pot odds: call ${usd(t)} to win ${usd(P)} → you need ${usd(t)} / ${usd(P + t)} = ${pct(need)} equity.`);
    lines.push(`Your equity vs his real range: ${pct(eqAll)} (${eq.combos} combos, ${eq.exact ? `every ${eq.runouts === 1 ? 'hand' : `one of ${eq.runouts} river cards`}` : `${eq.runouts} sampled runouts`}).`);
    lines.push(`${pct(eqAll)} ${eqAll >= need ? '≥' : '<'} ${pct(need)} → EV = ${pct(eqAll)} × ${usd(P + t)} − ${usd(t)} = ${usd(opt.ev)}.`);
    return opt;
  }
  const m = responseMatrix(st, heroIdx, action, vi, w);
  if (!m) return null;
  if (m.ended) {
    // The street closes (e.g. you check behind): you realize your equity.
    opt.ev = eqAll * P;
    lines.push(`It checks through: your ${pct(eqAll)} of the ${usd(P)} pot ≈ ${usd(opt.ev)}.`);
    opt.mix = { check: 1 };
    return opt;
  }
  const mix = {};
  for (const [r, p] of Object.entries(m.P)) mix[r] = wsum(w, p) / W;
  opt.mix = mix;
  opt.byBucket = {};
  for (const b of BUCKETS) {
    const wb = new Float64Array(w.length);
    for (let k = 0; k < w.length; k++) if (w[k] > 0 && buckets[k] === b) wb[k] = w[k];
    const tb = wsum(wb);
    if (tb <= 0) continue;
    opt.byBucket[b] = { share: tb / W };
    for (const [r, p] of Object.entries(m.P)) opt.byBucket[b][r] = wsum(wb, p) / tb;
  }
  const add = action.type === 'check' ? 0 : action.to - hero.committed;
  if (action.type === 'check') {
    // He checks behind, or bets and you pick your best answer (fold or call) vs his betting range.
    let ev = 0;
    const pc = mix.check || 0;
    if (pc) {
      const e = equityOver(eq.eq, mul(w, m.P.check));
      ev += pc * e * P;
      lines.push(`He checks ${pct(pc)} → you keep ${pct(e)} of the ${usd(P)} pot: ${pct(pc)} × ${pct(e)} × ${usd(P)} = ${usd(pc * e * P)}.`);
    }
    const pb = mix.bet || 0;
    if (pb) {
      const b = (m.to.bet || P * 0.5);
      const e = equityOver(eq.eq, mul(w, m.P.bet));
      const callEv = e * (P + 2 * b) - b;
      const best = Math.max(0, callEv);
      ev += pb * best;
      lines.push(`He bets ${pct(pb)} (about ${usd(b)}) → vs those hands you have ${pct(e)}: calling is worth ${pct(e)} × ${usd(P + 2 * b)} − ${usd(b)} = ${usd(callEv)}, so you ${callEv > 0 ? 'call' : 'fold ($0)'}: ${pct(pb)} × ${usd(best)} = ${usd(pb * best)}.`);
      opt.vsBet = { e, callEv, b };
    }
    opt.ev = ev;
    lines.push(`EV of checking ≈ ${usd(ev)}.`);
    return opt;
  }
  // Bet or raise.
  let ev = 0;
  const pf = mix.fold || 0;
  if (pf) { ev += pf * P; lines.push(`He folds ${pct(pf)} → you win the ${usd(P)} pot now: ${pct(pf)} × ${usd(P)} = ${usd(pf * P)}.`); }
  const pc = mix.call || 0;
  if (pc) {
    const vAdd = action.to - st.players[vi].committed;
    const T = P + add + vAdd;
    const e = equityOver(eq.eq, mul(w, m.P.call));
    const each = e * T - add;
    ev += pc * each;
    opt.eqCalls = e;
    opt.callShares = bucketSharesOf(mul(w, m.P.call), buckets);
    lines.push(`He calls ${pct(pc)} → pot ${usd(T)}; you have ${pct(e)} vs the hands that call: ${pct(e)} × ${usd(T)} − ${usd(add)} = ${usd(each)} → ${pct(pc)} × ${usd(each)} = ${usd(pc * each)}.`);
  }
  const pr = mix.raise || 0;
  if (pr) {
    const R = m.to.raise || action.to * 3;
    const e = equityOver(eq.eq, mul(w, m.P.raise));
    const T = P + (R - hero.committed) + (R - st.players[vi].committed);
    const callEv = e * T - (R - hero.committed);
    const best = Math.max(-add, callEv);
    ev += pr * best;
    lines.push(`He raises ${pct(pr)} (to about ${usd(R)}) → you have ${pct(e)} vs his raises: ${callEv > -add ? `call: ${pct(e)} × ${usd(T)} − ${usd(R - hero.committed)} = ${usd(callEv)}` : `fold and lose your ${usd(add)}`} → ${pct(pr)} × ${usd(best)} = ${usd(pr * best)}.`);
  }
  opt.ev = ev;
  lines.push(`EV ≈ ${usd(ev)} (one-street model: it stops at his answer and doesn't play out later streets).`);
  return opt;
}

function bucketSharesOf(w, buckets) {
  const s = { strong: 0, medium: 0, draws: 0, air: 0 };
  let t = 0;
  for (let k = 0; k < w.length; k++) {
    if (!(w[k] > 0)) continue;
    const b = buckets[k];
    if (!b) continue;
    s[b] += w[k]; t += w[k];
  }
  for (const b of BUCKETS) s[b] = t ? s[b] / t : 0;
  return s;
}

// Pros and cons from the numbers, not from memory.
function prosCons(opt, ctx) {
  const pros = [], cons = [];
  const m = opt.mix || {};
  if (opt.kind === 'betSmall' || opt.kind === 'betBig' || opt.kind === 'raise' || opt.kind === 'actual') {
    if ((m.fold || 0) >= 0.3) pros.push(`Folds out ${pct(m.fold)} of his range right now.`);
    if (opt.eqCalls != null) {
      if (opt.eqCalls >= 0.5) pros.push(`The hands that call are worse: you have ${pct(opt.eqCalls)} vs them.`);
      else cons.push(`The hands that call have you beat: ${pct(opt.eqCalls)} vs them.`);
    }
    if ((m.raise || 0) >= 0.08) cons.push(`He raises ${pct(m.raise)}: you face a tough spot that often.`);
    if (opt.callShares && opt.callShares.draws >= 0.25) cons.push(`${pct(opt.callShares.draws)} of his calls are draws: later streets get awkward when they hit.`);
  }
  if (opt.kind === 'check') {
    const air = ctx.shares?.air || 0;
    if ((m.bet || 0) > 0.2 && air > 0.25) pros.push(`Keeps his bluffs in: he bets ${pct(m.bet)} when checked to.`);
    if ((m.check || 0) > 0.6) cons.push(`He checks back ${pct(m.check)}: you get no value from those hands.`);
    if ((ctx.shares?.draws || 0) >= 0.2 && ctx.street !== 'river') cons.push(`Gives a free card to his draws (${pct(ctx.shares.draws)} of his range).`);
    if (opt.vsBet && opt.vsBet.callEv < 0) cons.push(`If he bets, you have to fold (${pct(opt.vsBet.e)} vs his bets).`);
  }
  if (opt.kind === 'call') {
    if (opt.ev > 0) pros.push(`Your ${pct(ctx.eq.total)} beats the ${pct(opt.need)} the price asks for.`); else cons.push(`The price asks for ${pct(opt.need)} and you have ${pct(ctx.eq.total)}.`);
  }
  return { pros, cons };
}

// ---------------------------------------------------------------- lines, verdict, grade
const lineOf = (kind, action, pot) => {
  if (kind === 'fold' || kind === 'call' || kind === 'check') return kind;
  if (kind === 'raise') return 'raise';
  if (kind === 'betSmall') return 'bet-small';
  if (kind === 'betBig') return 'bet-big';
  if (action?.type === 'bet') { const c = betSizeClass(action.to, pot); return c === 'small' ? 'bet-small' : c === 'big' ? 'bet-big' : 'bet-inbetween'; }
  return action?.type || kind;
};
const LINE_LABEL = { fold: 'Fold', call: 'Call', check: 'Check', raise: 'Raise', 'bet-small': 'Bet small', 'bet-big': 'Bet big', 'bet-inbetween': 'Bet an in-between size', bet: 'Bet' };

function sizingByRule(model, shares, opts, heroBucket) {
  const capped = (shares?.strong ?? 1) < val(model.resolved, 'sizing.cappedStrongShare', 0.15);
  const fs = opts.find((o) => o.kind === 'betSmall')?.mix?.fold ?? 0;
  const fb = opts.find((o) => o.kind === 'betBig')?.mix?.fold ?? 0;
  const elastic = (fb - fs) * 100 >= val(model.resolved, 'sizing.elasticPoints', 15);
  const key = !capped ? 'sizing.uncapped' : elastic ? 'sizing.cappedElastic' : 'sizing.cappedInelastic';
  const rec = model.rec(key);
  if (!rec || rec.tag !== 'HHP') return null;
  let line = rec.v;
  if (key === 'sizing.cappedElastic' && heroBucket === 'air') line = 'bet-big'; // "a just-big-enough bluff size"
  const why = `${capped ? 'capped' : 'uncapped'} (Strong ${pct(shares?.strong || 0)} of his range)${capped ? `, ${elastic ? 'elastic' : 'inelastic'} (a big bet folds ${Math.round((fb - fs) * 100)} points more than a small one)` : ''}`;
  return { line, why, quote: rec.src.quote, tag: sourceTag(rec) };
}

function gradeAction(actual, verdict, opts, pot, bb, conflicted) {
  if (conflicted) return { mark: '⚖', text: 'Not graded: this spot is an open ⚖ conflict / ♣ question in your playbook. Both views are below.' };
  const best = opts.find((o) => o.line === verdict.line) || opts.reduce((a, b) => (b.ev > a.ev ? b : a), opts[0]);
  const loss = best && actual ? best.ev - actual.ev : 0;
  const tol = Math.max(bb, 0.05 * pot);
  const same = actual.line === verdict.line || (verdict.line === 'bet' && actual.line.startsWith('bet'));
  if (same) return { mark: '✅', text: `${LINE_LABEL[actual.line]} is the line.`, loss: 0 };
  const bothBets = actual.line.startsWith('bet') && verdict.line.startsWith('bet');
  if (bothBets) return { mark: '⚠️', text: `Right idea (bet), wrong size: ${LINE_LABEL[verdict.line].toLowerCase()} here. ${actual.line === 'bet-inbetween' ? 'In-between sizes are the worst of both.' : ''}`.trim(), loss, sizing: true };
  if (loss <= tol) return { mark: '⚠️', text: `${LINE_LABEL[actual.line]} is close${loss > 0 ? ` (about ${usd(loss)} worse)` : ''}, but ${LINE_LABEL[verdict.line].toLowerCase()} is the line.`, loss };
  return { mark: '❌', text: `${LINE_LABEL[actual.line]} costs about ${usd(loss)} vs ${LINE_LABEL[verdict.line].toLowerCase()}.`, loss };
}

// Leak tags, only from your own list in project-instructions.md.
function leakFor(street, actual, verdict, grade, feat, tags) {
  if (!grade || grade.mark === '✅' || grade.mark === '⚖') return [];
  const out = [];
  const a = actual.line, v = verdict.line;
  if (grade.sizing || a === 'bet-inbetween') out.push('bad-sizing');
  else if (a === 'check' && v.startsWith('bet')) out.push(street === 'flop' ? 'passive-flop' : 'missed-value');
  else if (a.startsWith('bet') && v === 'check') {
    if (street === 'flop' && feat.multiway && feat.heroPFR) out.push('auto-cbet-multiway');
    else if (feat.heroBucket === 'medium') out.push('thin-value-too-thin');
    else if (feat.heroBucket === 'air' || feat.heroBucket === 'draws') out.push('spew-bluff');
  } else if (a === 'raise' && v !== 'raise' && (feat.heroBucket === 'air' || feat.heroBucket === 'draws')) out.push('spew-bluff');
  else if (a === 'call' && v === 'fold' && street === 'river') out.push('hero-call');
  else if (a === 'fold' && v === 'call' && street === 'river') out.push('overfold-river');
  else if (a === 'fold' && v !== 'fold') out.push('other');
  if (feat.deep && out.length) out.push('ignore-stack-depth');
  return out.filter((t) => tags.includes(t));
}

function preflopLeaks(d, tags) {
  if (!d || d.verdict !== 'wrong') {
    return (d?.sizing || []).some((z) => !z.ok) ? [d.sizing.some((z) => /Iso/.test(z.rule) && !z.ok) ? 'bad-open-size' : 'bad-sizing'].filter((t) => tags.includes(t)) : [];
  }
  const out = [];
  const act = d.action;
  if (d.kind === 'RFI' && act === 'call') out.push('limp-pre');
  else if ((d.kind === 'ISO' || d.kind === 'BB_LIMP') && (act === 'call' || act === 'check')) out.push('no-iso');
  else if ((d.kind === 'VS_OPEN' || d.kind === 'SQZ') && act === 'call' && /3-bet|Squeeze|3bet|squeeze/i.test(d.freq || '')) out.push('flat-should-3bet');
  else if (d.kind === 'SQZ' && act === 'call') out.push('overcall-pre');
  else out.push('other');
  return out.filter((t) => tags.includes(t));
}

// ---------------------------------------------------------------- paragraphs
function typeQuote(model, type) {
  const key = { passive: 'types.passive.pre.openPct', tight: 'types.tight.pre.openPct', aggressive: 'types.aggressive.pre.openPct', thinking: 'types.thinking.pre.openPct', whale: 'types.whale.pre.vpipPct', rec: 'types.rec.pre.openPct' }[type];
  const rec = key && model.rec(key);
  return rec?.tag === 'HHP' ? { quote: rec.src.quote, tag: sourceTag(rec) } : null;
}

function preflopParagraph(h, model, vi, r) {
  const p = h.players[vi];
  const acts = r.actions.filter((a) => a.street === 'preflop');
  const last = [...acts].reverse().find((a) => a.label !== 'fold') || acts[acts.length - 1];
  const full = 1326 - 101; // two of your cards removed: 1225 combos
  const share = last ? total(last.after) / full : 0;
  const words = { raise: 'raised', 'raise-big': 'opened big', call: 'called', limp: 'limped', check: 'checked', fold: 'folded' };
  const tq = typeQuote(model, p.type);
  const parts = [`${p.pos} is a ${villainLabel(p)}.`];
  if (tq) parts.push(`HHP on this type: “${tq.quote}” ${tq.tag}.`);
  if (last) parts.push(`He ${acts.map((a) => words[a.label] || a.label).join(', then ')}: that keeps about ${pct(share)} of all hands (${Math.round(total(last.after))} of ${full} combos), the colored part of the grid.`);
  if (acts.some((a) => a.label === 'raise-big')) {
    const rr = model.rec('rules.bigOpen');
    if (rr?.tag === 'HHP') parts.push(`His open was unusually big: “${rr.src.quote}” ${sourceTag(rr)}.`);
  }
  parts.push('Computed by replaying his own strategy, the one he plays from, not a guess.');
  return parts.join(' ');
}

function streetParagraph(h, model, vi, r, street, shares, prevShares) {
  const p = h.players[vi];
  const acts = r.actions.filter((a) => a.street === street);
  const st = model.styles[p.style];
  const parts = [];
  const moves = { check: 'checked', 'bet-small': 'bet small', 'bet-big': 'bet big', call: 'called', raise: 'raised', fold: 'folded' };
  if (!acts.length) parts.push(`He hasn't acted yet on the ${street} when you decide.`);
  for (const a of acts) {
    const b = comboBuckets(h.log.find((e) => e.type === 'deal' && e.street === street).board, street);
    const s0 = bucketShares(a.before, b), s1 = bucketShares(a.after, b);
    const biggest = BUCKETS.reduce((m, x) => (Math.abs(s1[x] - s0[x]) > Math.abs(s1[m] - s0[m]) ? x : m), 'strong');
    parts.push(`He ${moves[a.label] || a.label}: ${BUCKET_NAME[biggest]} went ${pct(s0[biggest])} → ${pct(s1[biggest])}.`);
    if (a.label === 'check' && st?.bet) {
      const rec = model.rec(`styles.${p.style}.bet.strong`);
      parts.push(`As a ${styleLabel(p.style).toLowerCase()} he bets his strong hands about ${pct(st.bet.strong)} of the time when checked to ${sourceTag(rec)}, so a check thins them out.`);
    }
    if (a.label === 'bet-big') {
      const rec = model.rec(`styles.${p.style}.big.strong`);
      if (rec?.tag === 'HHP') parts.push(`Big bets from him lean strong: “${rec.src.quote}” ${sourceTag(rec)}.`);
    }
    if (a.label === 'call') parts.push('Most of his air folds to a bet; what calls is made hands and draws.');
  }
  const tot = total(r.streets[street] || r.w);
  parts.push(`Now: ${BUCKETS.map((x) => `${BUCKET_NAME[x]} ${pct(shares[x])}`).join(', ')} (${Math.round(tot)} combos, weighted).`);
  if (prevShares) parts.push(`Start of the ${street}: ${BUCKETS.map((x) => `${BUCKET_NAME[x]} ${pct(prevShares[x])}`).join(', ')}.`);
  return parts.join(' ');
}

// Marc's six questions, answered for this hand.
function preflopQuestions(h, model, spot, vi) {
  const rec = model.rec('questions.six');
  const hero = h.players[h.heroIdx];
  const v = vi != null ? h.players[vi] : null;
  const eff = Math.min(hero.startStack, ...(v ? [v.startStack] : []));
  const firstHero = h.log.findIndex((e) => e.i === h.heroIdx && e.street === 'preflop' && e.type !== 'post');
  const before = h.log.slice(0, firstHero);
  const lastRaise = [...before].reverse().find((e) => e.type === 'raise');
  const leftToAct = h.players.filter((p) => p.i !== h.heroIdx && !before.some((e) => e.i === p.i && e.type !== 'post')).length;
  const answers = [
    v ? `${v.pos} (${villainLabel(v)}): see the grid.` : 'Nobody has put money in yet: everyone behind you has a full range.',
    v ? edgeText(v) : 'Look at who is in the blinds and behind you.',
    `${usd(eff)} (${Math.round(eff / h.stakes.bb)}bb).`,
    lastRaise ? `${usd(lastRaise.to)} (${Math.round(lastRaise.to / h.stakes.bb)}bb)${lastRaise.meta?.label === 'raise-big' ? ': unusually big' : ''}.` : 'No raise yet.',
    'The simulator has no rake. Live, a high rake means tighter.',
    `${leftToAct} still to act behind you.`,
  ];
  const qs = (rec?.tag === 'HHP' ? rec.v : []).map((q, k) => ({ q, a: answers[k] }));
  const extra = [];
  if (spot?.kind === 'RFI') {
    const r = model.rec('questions.rfi');
    if (r?.tag === 'HHP') extra.push({ q: 'Open wider or tighter here?', a: r.v, tag: sourceTag(r) });
  }
  if (!qs.length) extra.push({ q: 'What is his range, and what happens if I raise, call or fold?', a: '', tag: '[OUTSIDE SOURCE]' });
  return { tag: rec?.tag === 'HHP' ? sourceTag(rec) : '[OUTSIDE SOURCE]', list: qs, extra };
}

function edgeText(v) {
  const e = { whale: 'Big: he massively underfolds.', rec: 'Big: he calls too much and rarely raises without it.', passive: 'Good: he under-3-bets and folds too much.', tight: 'Some: he plays too tight.', aggressive: 'Smaller: he fights back, but over-bluffs.', thinking: 'Smallest: the tough one at the table.' }[v.type];
  return `${e || 'Unclear.'} [OUTSIDE SOURCE summary of the type]`;
}

// ---------------------------------------------------------------- the whole review
function mainVillain(h, street, snapState) {
  const live = activePlayers(snapState).filter((p) => p.i !== h.heroIdx).map((p) => p.i);
  const agg = [...snapState.log].reverse().find((e) => e.street === street && (e.type === 'bet' || e.type === 'raise') && e.i !== h.heroIdx);
  if (agg && live.includes(agg.i)) return agg.i;
  if (live.includes(snapState.preflopAggressor)) return snapState.preflopAggressor;
  return live[0] ?? null;
}

function decisionAnalysis(h, d, model, brain, vi, tags) {
  const st = d.state;
  const w = d.ranges[vi];
  const street = st.street;
  const board = st.board;
  const buckets = street === 'preflop' ? new Array(COMBOS.length).fill(null) : comboBuckets(board, street);
  const hero = st.players[h.heroIdx];
  const eq = equityVsRange(hero.cards, board, w, { samples: 160 });
  const shares = street === 'preflop' ? null : bucketShares(w, buckets);
  const la = legalActions(st);
  const ctx = { st, heroIdx: h.heroIdx, vi, w, eq, buckets, shares, street };
  const kinds = la.toCall > 0 ? ['fold', 'call', 'raise'] : ['betSmall', 'betBig', 'check'];
  const pot = potTotal(st);
  const TITLE = { fold: 'Fold', call: 'Call', raise: 'Raise', betSmall: 'Bet small', betBig: 'Bet big', check: 'Check' };
  const opts = [];
  for (const k of kinds) {
    const action = heroOption(st, k);
    if (!action) continue;
    const o = evalOption(ctx, k, action);
    if (!o) continue;
    o.title = k === 'raise' ? `Raise to ${usd(action.to)}` : TITLE[k] + (action.to ? ` (${usd(action.to)}, ${pct((action.to - hero.committed) / pot)} pot)` : '');
    o.line = lineOf(k, action, pot);
    Object.assign(o, prosCons(o, ctx));
    if (k === 'betBig' && o.eqCalls != null) o.wantCalls = o.eqCalls >= 0.5 ? `Yes: you have ${pct(o.eqCalls)} vs the hands that call.` : `No: you have ${pct(o.eqCalls)} vs the hands that call. A big bet only works as a bluff here: it needs folds.`;
    opts.push(o);
  }
  // Your actual action, evaluated the same way.
  const e = d.entry;
  const actualAction = e.type === 'bet' || e.type === 'raise' ? { type: e.type, to: e.to } : { type: e.type };
  const actualKind = e.type === 'bet' ? 'actual' : e.type;
  let actual = opts.find((o) => (o.kind === e.type && e.type !== 'raise') || (o.action && o.action.type === actualAction.type && o.action.to === actualAction.to));
  if (!actual) {
    actual = evalOption(ctx, e.type === 'bet' ? 'actual' : actualKind, actualAction) || { ev: 0, lines: [] };
    actual.kind = actual.kind || actualKind;
  }
  actual.line = lineOf(actualKind, actualAction, pot);
  actual.title = `${LINE_LABEL[actual.line] || cap(e.type)}${actualAction.to ? ` (${usd(actualAction.to)})` : ''}`;

  const feat = spotFeatures(st, h.heroIdx, vi, { heroAction: actual.line.startsWith('bet') ? 'bet' : actual.line, heroCode: handCode(...hero.cards), capped: shares ? shares.strong < val(model.resolved, 'sizing.cappedStrongShare', 0.15) : null });
  if (actual.line.startsWith('bet')) feat.betSize = betSizeClass(actualAction.to, pot);
  const matched = matchBrain(model, feat, brain);
  const conflicted = matched.conflicts.length > 0;

  // Verdict: a brain rule's line wins; otherwise the math. Bet sizes follow the [08-04] rule.
  const mathBest = opts.reduce((a, b) => (b.ev > a.ev ? b : a), opts[0]);
  const ruleRec = matched.rules.find((r) => r.recommend && opts.some((o) => o.line === r.recommend || (r.recommend === 'bet' && o.line.startsWith('bet'))));
  let verdict;
  if (ruleRec) verdict = { line: ruleRec.recommend, source: ruleRec.tag, why: `“${ruleRec.quote}”`, rule: ruleRec.key };
  else verdict = { line: mathBest.line, source: '[OUTSIDE SOURCE] math vs his real range (one-street EV)', why: `${mathBest.title} has the best EV: ${usd(mathBest.ev)}.` };
  if (verdict.line === 'bet' || verdict.line.startsWith('bet')) {
    const sz = street === 'preflop' ? null : sizingByRule(model, shares, opts, feat.heroBucket);
    if (sz && (verdict.line === 'bet' || !ruleRec || ruleRec.recommend === 'bet')) {
      if (!ruleRec) {
        // The math picks betting; HHP's sizing rule picks the size.
        const chk = opts.find((o) => o.kind === 'check');
        const bestBet = opts.filter((o) => o.line.startsWith('bet')).reduce((a, b) => (b.ev > a.ev ? b : a));
        verdict.why = `Betting beats checking: best bet ${usd(bestBet.ev)} vs check ${chk ? usd(chk.ev) : 'n/a'}.`;
      }
      verdict.line = sz.line;
      verdict.size = sz;
    }
    if (verdict.line === 'bet') verdict.line = mathBest.line.startsWith('bet') ? mathBest.line : 'bet-small';
  }
  const vOpt = opts.find((o) => o.line === verdict.line);
  verdict.title = vOpt ? vOpt.title : LINE_LABEL[verdict.line];
  verdict.math = vOpt && mathBest && vOpt !== mathBest ? `The math alone would pick ${mathBest.title.toLowerCase()} (${usd(mathBest.ev)} vs ${usd(vOpt.ev)}) [OUTSIDE SOURCE]; the brain decides.` : '';
  const grade = gradeAction(actual, verdict, opts, pot, h.stakes.bb, conflicted);
  const leaks = leakFor(street, actual, verdict, grade, feat, tags);
  const used = new Set([verdict.rule].filter(Boolean));
  return {
    street, n: d.n, vi, pot, eq, shares, opts, actual, verdict, grade, leaks, feat,
    also: { rules: matched.rules.filter((r) => !used.has(r.key)), conflicts: matched.conflicts },
    multiway: activePlayers(st).length > 2,
  };
}

// The villain catalog entry for his style/type (for "also from the brain" and the end of hand).
function catalogEntry(brain, p) {
  const names = { passiveCaller: 'Passive caller', passiveFolder: 'Passive folder', aggroCaller: 'Aggro caller', aggroFolder: 'Aggro folder', whale: 'Whale' };
  const n = names[p.style];
  if (!n || !brain?.villains) return null;
  return brain.villains.find((v) => v.name === n || v.name.startsWith(`${n} (`)) || null;
}
const entryTag = (e) => `[HHP] ${e.file} › ${e.section}${e.dates?.length ? ` · ${e.dates.join(', ')}` : ''}`;

// Which catalog field fits this decision ("vs a small bet", "vs a big bet", "Size"...).
function catalogFieldFor(entry, a) {
  if (!entry?.fields) return null;
  const want = a.actual.line === 'bet-small' ? /small/i : a.actual.line === 'bet-big' || a.actual.line === 'raise' ? /big/i : a.actual.line === 'check' ? /check/i : null;
  return entry.fields.find((f) => want && want.test(f.name)) || null;
}

export function buildFeedback(h, { model, brain, history = [] }) {
  const tags = brain?.leakTags || [];
  const decisions = [];
  const tracked = trackHand(h, {
    onDecision: (s, e, R) => {
      if (e.i !== h.heroIdx) return;
      const ranges = {};
      for (const [i, r] of Object.entries(R)) ranges[i] = Float64Array.from(r.w);
      decisions.push({ n: h.log.indexOf(e), entry: e, state: structuredClone(s), ranges });
    },
  });
  const R = tracked.ranges;
  const out = { villains: [], preflop: null, streets: [], end: null };
  const involved = Object.keys(R).map(Number).filter((i) => isInvolved(h, i));

  // ---- PREFLOP
  const preDec = decisions.filter((d) => d.state.street === 'preflop');
  // The opponent for the preflop section: the villain who stayed in with you (the raiser if
  // he did), else whoever acted before your decision.
  const pv = involved.includes(h.preflopAggressor) ? h.preflopAggressor
    : involved[0] ?? (preDec.length ? mainVillain(h, 'preflop', preDec[0].state) : null);
  const pre = { villain: pv, grids: {}, paragraph: '', questions: null, actions: h.heroDecisions || [], also: { rules: [], conflicts: [] } };
  const withGrid = [...new Set([...involved, ...(pv != null ? [pv] : [])])];
  for (const i of withGrid) {
    const acts = R[i].actions.filter((a) => a.street === 'preflop');
    const last = [...acts].reverse().find((a) => a.label !== 'fold') || acts[acts.length - 1];
    if (last) pre.grids[i] = { cells: gridCells({ actionMix: preflopActionMix(last) }), paragraph: preflopParagraph(h, model, i, R[i]) };
  }
  pre.paragraph = pv != null ? pre.grids[pv]?.paragraph || '' : '';
  pre.questions = preflopQuestions(h, model, h.spot, pv);
  if (preDec.length) {
    const st = preDec[0].state;
    const firstLimper = st.log.find((e) => e.street === 'preflop' && e.type === 'call' && e.level === 1);
    const lp = firstLimper ? (['UTG', 'UTG+1', 'LJ'].includes(st.players[firstLimper.i].pos) ? 'EP' : ['HJ', 'CO', 'BTN'].includes(st.players[firstLimper.i].pos) ? 'late' : null) : null;
    const d0 = h.heroDecisions?.[0];
    const heroAction = d0 ? (d0.action === 'call' && (h.spot.kind === 'RFI' || h.spot.kind === 'ISO') ? 'limp' : d0.action) : null;
    const feat = spotFeatures(st, h.heroIdx, pv, { spot: h.spot.kind, heroAction, heroCodes: h.heroCode, limperPos: lp });
    feat.heroCodes = h.heroCode;
    // Facing level for the latest preflop decision (5-bet red flag).
    const lastPre = preDec[preDec.length - 1].state;
    const m = matchBrain(model, { ...feat, facingLevel: lastPre.raiseLevel }, brain);
    pre.also = m;
    pre.conflicted = m.conflicts.length > 0;
  }
  // An open conflict on this spot: the chart grade is reference only (no leak, no takeaway).
  pre.leaks = pre.conflicted ? [] : (h.heroDecisions || []).flatMap((d) => preflopLeaks(d, tags));
  out.preflop = pre;

  // ---- FLOP / TURN / RIVER
  for (const street of ['flop', 'turn', 'river']) {
    const deal = h.log.find((e) => e.type === 'deal' && e.street === street);
    if (!deal) break;
    const heroFolded = h.log.some((e) => e.i === h.heroIdx && e.type === 'fold' && h.log.indexOf(e) < h.log.indexOf(deal));
    if (heroFolded) break;
    const sd = decisions.filter((d) => d.state.street === street);
    const buckets = comboBuckets(deal.board, street);
    const vi = sd.length ? mainVillain(h, street, sd[0].state) : involved.find((i) => !h.players[i].folded) ?? involved[0];
    if (vi == null) break;
    const r = R[vi];
    const wAt = sd.length ? sd[0].ranges[vi] : r.streets[street];
    const prev = r.start[street];
    const shares = bucketShares(wAt, buckets);
    const s = {
      street, board: deal.board, villain: vi,
      grid: { cells: gridCells({ w: wAt, prev, buckets }), shares },
      paragraph: streetParagraph(h, model, vi, { ...r, actions: r.actions.filter((a) => !sd.length || a.n < sd[0].n) }, street, shares, prev ? bucketShares(prev, buckets) : null),
      decisions: sd.map((d) => decisionAnalysis(h, d, model, brain, vi, tags)),
      catalog: null,
    };
    const entry = catalogEntry(brain, h.players[vi]);
    for (const a of s.decisions) {
      const f = catalogFieldFor(entry, a);
      if (f) a.also.catalog = { name: entry.name, field: f.name, text: f.text, tag: entryTag(entry) };
    }
    out.streets.push(s);
  }

  // ---- END OF HAND
  const all = [...out.streets.flatMap((s) => s.decisions)];
  const leaks = [...new Set([...pre.leaks, ...all.flatMap((a) => a.leaks)])];
  const recent = history.slice(-50);
  const repeats = Object.fromEntries(leaks.map((t) => [t, recent.filter((x) => (x.leaks || []).includes(t)).length]));
  const worst = all.filter((a) => a.grade.mark === '❌').sort((a, b) => (b.grade.loss || 0) - (a.grade.loss || 0))[0]
    || all.find((a) => a.grade.mark === '⚠️');
  const preWrong = pre.conflicted ? null : (h.heroDecisions || []).find((d) => d.verdict === 'wrong');
  const takeaway = takeawayText({ worst, preWrong, h });
  const known = [];
  if (h.stakes.label !== '1/2' && (leaks.length || preWrong)) {
    const kl = (brain?.knownLeaks || []).find((k) => /loses above it/i.test(k.title));
    if (kl) known.push({ title: kl.title, text: kl.text, tag: '[HHP] project-instructions.md › Known leaks' });
  }
  const whole = [];
  const mv = out.streets[out.streets.length - 1]?.villain ?? pv;
  if (mv != null) {
    const entry = catalogEntry(brain, h.players[mv]);
    if (entry) whole.push({ title: `${entry.name}: ${h.players[mv].pos} played this style`, fields: entry.fields, tag: entryTag(entry) });
  }
  out.end = { takeaway, leaks: leaks.map((t) => ({ tag: t, repeats: repeats[t] })), known, whole };
  out.leaks = leaks;
  out.involved = withGrid;
  return out;
}

function takeawayText({ worst, preWrong, h }) {
  if (worst) {
    const tag = worst.leaks[0];
    const v = worst.verdict.title.toLowerCase();
    const map = {
      'missed-value': `You checked a hand that wanted money in: ${v} was worth about ${usd(worst.grade.loss || 0)} more. Make him pay.`,
      'passive-flop': `You checked the flop with a hand that wanted to bet: ${v}. Free cards are for charity.`,
      'thin-value-too-thin': `That bet was too thin: the hands that call beat you. Check and take your showdown value home.`,
      'spew-bluff': `That bluff lit money on fire: his range doesn't fold enough there. ${cap(v)} instead.`,
      'hero-call': `Hero call, zero hero: the price asked for ${pct(worst.opts.find((o) => o.kind === 'call')?.need || 0)} and you had ${pct(worst.eq.total)} vs his real range.`,
      'overfold-river': `You folded a winner too often: you needed ${pct(worst.opts.find((o) => o.kind === 'call')?.need || 0)} and had ${pct(worst.eq.total)}.`,
      'bad-sizing': `Right idea, wrong size: ${v}. Small or big, never in between.`,
      'auto-cbet-multiway': `Auto c-betting into a crowd: multiway, check the hands that can't take the heat.`,
    };
    return map[tag] || `${cap(worst.actual.title)} on the ${worst.street} was the leak: ${v} is the line.`;
  }
  if (preWrong) return `Preflop is where this went wrong: the chart says ${preWrong.freq || 'something else'} with ${preWrong.code}, you chose ${String(preWrong.heroAction).toLowerCase()}.`;
  void h;
  return 'Clean hand: right read, right line. Now do it 10,000 more times.';
}

export { cardsPretty, typeLabel };
