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
import { legalActions, applyAction, potTotal, activePlayers, dealNextStreet } from '../engine/game.js';
import { villainPolicy } from '../engine/policy.js';
import { boardTable } from '../engine/strength.js';
import { handCode, cardsPretty, cardPretty } from '../engine/cards.js';
import { evaluate } from '../engine/eval.js';
import { trackHand, COMBOS, CODE_OF, total, preflopActionMix } from '../range/tracker.js';
import { CLASSES, CLASS_KEYS, CLASS_LABEL, comboClasses, classShares, groupShare, GROUP_OF } from '../range/classes.js';
import { rangeCells, actionCells, comboList } from '../ui/grid.js';
import { TABLE_SETTINGS } from '../../config/table-settings.js';
import { OUTSIDE_SOURCE } from '../../config/outside-source.js';
import { POSTFLOP_ORDER } from '../engine/game.js';
import { heroOption, RESPONSE } from '../range/whatif.js';
import { equityVsRange, equityOver } from './equity.js';
import { spotFeatures, betSizeClass } from './spot.js';
import { matchBrain, whenMatches } from './match.js';
import { sourceTag, val } from '../brain/compiled.js';
import { villainLabel, typeLabel, styleLabel } from '../villains/model.js';
import { isInvolved } from '../engine/coach.js';
import { classifySpot } from '../engine/scenario.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const usd = (x) => {
  const a = Math.abs(x);
  const body = Number.isInteger(x) || a >= 100 ? String(Math.round(a)) : a.toFixed(a < 10 ? 1 : 0);
  return `${x < 0 ? '−' : ''}$${body}`;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- his response, per combo
function responseMatrix(st, heroIdx, action, vi, w, asIs = false) {
  const s2 = structuredClone(st);
  if (!asIs) try { applyAction(s2, action); } catch { return null; }
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
  const { st, heroIdx, vi, w, eq, classes } = ctx;
  const hero = st.players[heroIdx];
  const P = potTotal(st);
  const W = wsum(w);
  const lines = [];
  // Out of position before the river you realize only part of your equity [OUTSIDE SOURCE].
  const R = ctx.real ?? 1;
  const realized = (e) => e * R;
  const opt = { kind, action, lines, ev: 0, eqAll: eq.total };
  const eqAll = realized(eq.total);
  if (R < 1) lines.push(`Out of position you realize about ${pct(R)} of your equity [OUTSIDE SOURCE]: ${pct(eq.total)} × ${R} = ${pct(eqAll)}, used below.`);
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
    lines.push(`Your equity vs his real range: ${pct(eq.total)} (${eq.combos} combos, ${eq.exact ? 'exact' : `${eq.runouts} sampled runouts`})${R < 1 ? `, ${pct(eqAll)} after realization` : ''}.`);
    lines.push(`${pct(eqAll)} ${eqAll >= need ? '≥' : '<'} ${pct(need)} → EV = ${pct(eqAll)} × ${usd(P + t)} − ${usd(t)} = ${usd(opt.ev)}.`);
    if (st.street !== 'river' && ctx.shares) opt.next = `you see the next card against this same range: ${topClasses(ctx.shares)}.`;
    opt.look = lookAhead(ctx, [{ type: 'call' }], w);
    return opt;
  }
  const m = responseMatrix(st, heroIdx, action, vi, w);
  if (!m) return null;
  if (m.ended) {
    // The street closes (e.g. you check behind): you realize your equity.
    opt.ev = eqAll * P;
    lines.push(`It checks through: your ${pct(eqAll)} of the ${usd(P)} pot ≈ ${usd(opt.ev)}.`);
    opt.mix = { check: 1 };
    opt.closes = true;
    if (st.street !== 'river' && ctx.shares) opt.next = `a free card, and his range stays ${topClasses(ctx.shares)}.`;
    opt.look = lookAhead(ctx, [action], w);
    return opt;
  }
  const mix = {};
  for (const [r, p] of Object.entries(m.P)) mix[r] = wsum(w, p) / W;
  opt.mix = mix;
  opt.byClass = {};
  for (const c of CLASS_KEYS) {
    const wb = new Float64Array(w.length);
    for (let k = 0; k < w.length; k++) if (w[k] > 0 && classes[k] === c) wb[k] = w[k];
    const tb = wsum(wb);
    if (tb <= 0) continue;
    opt.byClass[c] = { share: tb / W };
    for (const [r, p] of Object.entries(m.P)) opt.byClass[c][r] = wsum(wb, p) / tb;
  }
  const add = action.type === 'check' ? 0 : action.to - hero.committed;
  if (action.type === 'check') {
    // He checks behind, or bets and you pick your best answer (fold or call) vs his betting range.
    let ev = 0;
    const pc = mix.check || 0;
    if (pc) {
      const e = realized(equityOver(eq.eq, mul(w, m.P.check)));
      ev += pc * e * P;
      lines.push(`He checks ${pct(pc)} → you keep ${pct(e)} of the ${usd(P)} pot: ${pct(pc)} × ${pct(e)} × ${usd(P)} = ${usd(pc * e * P)}.`);
    }
    const pb = mix.bet || 0;
    if (pb) {
      const b = (m.to.bet || P * 0.5);
      const e = realized(equityOver(eq.eq, mul(w, m.P.bet)));
      const callEv = e * (P + 2 * b) - b;
      const best = Math.max(0, callEv);
      ev += pb * best;
      lines.push(`He bets ${pct(pb)} (about ${usd(b)}) → vs those hands you have ${pct(e)}: calling is worth ${pct(e)} × ${usd(P + 2 * b)} − ${usd(b)} = ${usd(callEv)}, so you ${callEv > 0 ? 'call' : 'fold ($0)'}: ${pct(pb)} × ${usd(best)} = ${usd(pb * best)}.`);
      opt.vsBet = { e, callEv, b };
    }
    opt.ev = ev;
    if (m.P.check && st.street !== 'river') {
      opt.next = `when he checks back, his range is ${topClasses(classShares(mul(w, m.P.check), classes))}.`;
      opt.look = lookAhead(ctx, [action, { type: 'check', by: vi }], mul(w, m.P.check));
    }
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
    const e = realized(equityOver(eq.eq, mul(w, m.P.call)));
    const each = e * T - add;
    ev += pc * each;
    opt.eqCalls = e;
    opt.callShares = classShares(mul(w, m.P.call), classes);
    opt.next = `when he calls, his range is ${topClasses(opt.callShares)}, and you have ${pct(e)} against it.`;
    opt.look = lookAhead(ctx, [action, { type: 'call', by: vi }], mul(w, m.P.call));
    lines.push(`He calls ${pct(pc)} → pot ${usd(T)}; you have ${pct(e)} vs the hands that call: ${pct(e)} × ${usd(T)} − ${usd(add)} = ${usd(each)} → ${pct(pc)} × ${usd(each)} = ${usd(pc * each)}.`);
  }
  const pr = mix.raise || 0;
  if (pr) {
    const R = m.to.raise || action.to * 3;
    const e = realized(equityOver(eq.eq, mul(w, m.P.raise)));
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

// ---------------------------------------------------------------- one street ahead
// After an option that goes to the next street (a call, a check-through, his call of your bet),
// deal the card that actually came and ask: what does his continuing range do there, and what
// would you do? His move is his real strategy on that card. Your plan uses the equity
// thresholds in config/outside-source.js [OUTSIDE SOURCE]. Heads-up only.
function lookAhead(ctx, actions, wNext) {
  const { st, heroIdx, vi } = ctx;
  if (st.street === 'river' || activePlayers(st).length > 2) return null;
  const s2 = structuredClone(st);
  try {
    for (const a of actions) {
      if (a.by != null) s2.toAct = a.by;
      applyAction(s2, { type: a.type, to: a.to });
    }
    if (!s2.awaitingDeal) return null;
    dealNextStreet(s2);
  } catch { return null; }
  if (s2.done || s2.players[vi].allIn || s2.players[heroIdx].allIn) return null;
  const card = s2.board[s2.board.length - 1];
  const w = new Float64Array(wNext.length);
  for (let k = 0; k < w.length; k++) if (wNext[k] > 0 && COMBOS[k][0] !== card && COMBOS[k][1] !== card) w[k] = wNext[k];
  const W = wsum(w);
  if (W <= 0) return null;
  const hero = s2.players[heroIdx].cards;
  const eqN = equityVsRange(hero, s2.board, w);
  const cls = comboClasses(s2.board, s2.street);
  const T = OUTSIDE_SOURCE.nextPlan || { value: 0.65 };
  const pot = potTotal(s2);
  const out = { card: cardPretty(card), street: s2.street, eq: eqN.total, lines: [] };
  // His betting when it's checked to him (or he's first to act).
  const hisBets = (state) => {
    const m = responseMatrix(state, -1, null, vi, w, true);
    if (!m) return null;
    const pb = (m.P.bet ? wsum(w, m.P.bet) : 0) / W;
    return { pb, betW: m.P.bet ? mul(w, m.P.bet) : null, checkW: m.P.check ? mul(w, m.P.check) : null, to: m.to.bet };
  };
  const answer = (b, betW) => {
    if (!betW || wsum(betW) <= 0) return '';
    const e = equityOver(eqN.eq, betW);
    const need = b / (pot + 2 * b);
    return `vs his bets you have ${pct(e)} and need ${pct(need)} to call about ${usd(b)}: ${e >= T.value ? 'raise for value' : e >= need ? 'call' : 'fold'}`;
  };
  if (s2.toAct === vi) {
    const hb = hisBets(s2);
    if (!hb) return null;
    out.lines.push(`He's first: he bets about ${pct(hb.pb)}${hb.betW ? ` (his bets: ${topClasses(classShares(hb.betW, cls))})` : ''} and checks ${pct(1 - hb.pb)}.`);
    const ec = hb.checkW && wsum(hb.checkW) > 0 ? equityOver(eqN.eq, hb.checkW) : null;
    const plan = [];
    if (hb.pb > 0.02) plan.push(`if he bets, ${answer(hb.to || pot * 0.5, hb.betW)}`);
    if (ec != null) plan.push(`if he checks, you have ${pct(ec)}: ${ec >= T.value ? 'bet for value' : 'check behind'}`);
    out.lines.push(`You next: ${plan.join('; ')}.`);
  } else {
    const plan = eqN.total >= T.value ? 'bet for value' : 'check';
    out.lines.push(`You're first, with ${pct(eqN.total)} vs his range (${topClasses(classShares(w, cls))}): ${plan}.`);
    if (plan === 'check') {
      const s3 = structuredClone(s2);
      try { applyAction(s3, { type: 'check' }); } catch { return out; }
      const hb = !s3.awaitingDeal && s3.toAct === vi ? hisBets(s3) : null;
      if (hb) out.lines.push(`After your check he bets about ${pct(hb.pb)}${hb.pb > 0.02 ? `; ${answer(hb.to || pot * 0.5, hb.betW)}` : ''}.`);
    }
  }
  out.tag = '[OUTSIDE SOURCE] plan thresholds, config/outside-source.js; his moves are his strategy on the card that came';
  return out;
}

// "38% thick value, 25% high-equity draws, 20% air" (classes above 5%, biggest first).
function topClasses(shares) {
  return Object.entries(shares).filter(([, x]) => x >= 0.05).sort((a, b) => b[1] - a[1]).map(([k, x]) => `${pct(x)} ${k === 'cpfs' ? 'CPFS' : CLASS_LABEL[k].toLowerCase()}`).join(', ') || 'empty';
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
    const dr = opt.callShares ? groupShare(opt.callShares, 'draws') : 0;
    if (dr >= 0.25) cons.push(`${pct(dr)} of his calls are draws: later streets get awkward when they hit.`);
  }
  if (opt.kind === 'check') {
    const air = ctx.shares ? groupShare(ctx.shares, 'air') : 0;
    if ((m.bet || 0) > 0.2 && air > 0.25) pros.push(`Keeps his bluffs in: he bets ${pct(m.bet)} when checked to.`);
    if ((m.check || 0) > 0.6) cons.push(`He checks back ${pct(m.check)}: you get no value from those hands.`);
    const dr = ctx.shares ? groupShare(ctx.shares, 'draws') : 0;
    if (dr >= 0.2 && ctx.street !== 'river') cons.push(`Gives a free card to his draws (${pct(dr)} of his range).`);
    if (opt.vsBet && opt.vsBet.callEv < 0) cons.push(`If he bets, you have to fold (${pct(opt.vsBet.e)} vs his bets).`);
  }
  if (opt.kind === 'call') {
    if (opt.ev > 0) pros.push(`Your ${pct(opt.eqAll * (ctx.real ?? 1))} beats the ${pct(opt.need)} the price asks for.`); else cons.push(`The price asks for ${pct(opt.need)} and you have ${pct(opt.eqAll * (ctx.real ?? 1))}.`);
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
export const LINE_LABEL = { fold: 'Fold', call: 'Call', check: 'Check', raise: 'Raise', 'bet-small': 'Bet small', 'bet-big': 'Bet big', 'bet-inbetween': 'Bet an in-between size', bet: 'Bet' };

function sizingByRule(model, shares, opts, heroBucket) {
  const strong = shares ? groupShare(shares, 'strongValue') : 1;
  const capped = strong < val(model.resolved, 'sizing.cappedStrongShare', 0.15);
  const fs = opts.find((o) => o.kind === 'betSmall')?.mix?.fold ?? 0;
  const fb = opts.find((o) => o.kind === 'betBig')?.mix?.fold ?? 0;
  const elastic = (fb - fs) * 100 >= val(model.resolved, 'sizing.elasticPoints', 15);
  const key = !capped ? 'sizing.uncapped' : elastic ? 'sizing.cappedElastic' : 'sizing.cappedInelastic';
  const rec = model.rec(key);
  if (!rec || rec.tag !== 'HHP') return null;
  let line = rec.v;
  if (key === 'sizing.cappedElastic' && heroBucket === 'air') line = 'bet-big'; // "a just-big-enough bluff size"
  const why = `${capped ? 'capped' : 'uncapped'} (${pct(strong)} of his range is strong value)${capped ? `, ${elastic ? 'elastic' : 'inelastic'} (a big bet folds ${Math.round((fb - fs) * 100)} points more than a small one)` : ''}`;
  return { line, why, quote: rec.src.quote, tag: sourceTag(rec) };
}

function gradeAction(actual, verdict, opts, pot, bb, conflicted) {
  if (conflicted) return { mark: '⚖', text: 'Not graded: this spot is an open ⚖ conflict / ♣ question in your playbook. Both views are below.' };
  const best = opts.find((o) => o.line === verdict.line) || opts.reduce((a, b) => (b.ev > a.ev ? b : a), opts[0]);
  const loss = best && actual ? best.ev - actual.ev : 0;
  const mathOnly = !verdict.rule && !verdict.size;
  const closePot = OUTSIDE_SOURCE.closeCallPot ?? 0.05;
  const tol = Math.max(bb, 0.05 * pot);
  const same0 = actual.line === verdict.line || (verdict.line === 'bet' && actual.line.startsWith('bet'));
  if (!same0 && mathOnly && loss < closePot * pot) return { mark: '⚠️', text: `Math only, close: ${LINE_LABEL[verdict.line].toLowerCase()} is about ${usd(Math.max(0, loss))} better, under ${pct(closePot)} of the pot.`, loss, close: true };
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
  const key = { passive: 'types.passive.pre.openPct', tight: 'types.tight.pre.openPct', aggressive: 'types.aggressive.pre.openPct', thinking: 'types.thinking.pre.openPct', whale: 'types.whale.pre.vpipPct', rec: 'types.rec.pre.openPct', pro: 'types.pro.styleMix' }[type];
  const rec = key && model.rec(key);
  return rec?.tag === 'HHP' ? { quote: rec.src.quote, tag: sourceTag(rec) } : null;
}

// ---------------------------------------------------------------- why his range changed
const ACT_WORD = { raise: 'raised', 'raise-big': 'opened big', call: 'called', limp: 'limped', check: 'checked', fold: 'folded', 'bet-small': 'bet small', 'bet-big': 'bet big' };

// Every strategy number behind something he does, each with its own source.
const NUM_LABEL = {
  'pre.openPct': 'opens (top % of hands)', 'pre.openCharts': 'opens from HHP chart', 'pre.coldCallVs3bet': 'cold-calls a 3-bet (share of normal)', 'pre.threeBetPct': '3-bets (top %)', 'pre.threeBet': '3-bet hands', 'pre.threeBetLight': 'light 3-bets',
  'pre.callOpenPct': 'flats an open (top %)', 'pre.bbDefendPct': 'defends the BB (%)', 'pre.limpList': 'limps', 'pre.limpPct': 'extra limps (top %)',
  'pre.limpCallPct': 'calls a raise after limping', 'pre.continueVs3betPct': 'calls a 3-bet (top %)', 'pre.coldCall3bet': 'cold-calls a 3-bet with',
  'pre.fourBet': '4-bet hands', 'pre.fourBetPct': '4-bets (top %)', 'pre.fourBetPartial': 'partial 4-bets', 'pre.fiveBet': '5-bet hands',
  'pre.callVs4bet': 'calls a 4-bet with', 'pre.callVs4betPct': 'calls a 4-bet (top %)', 'pre.callVs5bet': 'calls a 5-bet with',
  'pre.vpipPct': 'VPIP (%)', 'pre.isoRaiseFreq': 'isos over limpers', 'bigOpenPremiums': 'big-open premiums', 'bigOpenMult': 'big open = normal ×',
  'bigOpenPremiumFreq': 'premiums open big', 'bigOpenOtherFreq': 'other hands open big', limpReraise: 'limp-reraises',
  'bet.monster': 'bets monsters', 'bet.strong': 'bets strong hands', 'bet.medium': 'bets medium hands', 'bet.draw': 'bets draws', 'bet.air': 'bluffs air',
  'big.monster': 'big size with monsters', 'big.strong': 'big size with strong hands', 'big.medium': 'big size with medium', 'big.draw': 'big size with draws', 'big.air': 'big size with bluffs',
  'raise.monster': 'raises monsters', 'raise.strong': 'raises strong hands', 'raise.draw': 'raises draws', 'raise.air': 'raises air', riverSpaz: 'spazzes vs a small river bet',
  callAnyPair: 'calls any pair (flop, turn)', cbet: 'extra c-bet frequency',
  'need.flop': 'continues above strength (flop)', 'need.turn': 'continues above strength (turn)', 'need.river': 'continues above strength (river)',
  'sizeSens.flop': 'extra strength per pot-size bet (flop)', 'sizeSens.turn': 'extra strength per pot-size bet (turn)', 'sizeSens.river': 'extra strength per pot-size bet (river)',
  'streetAir.flop': 'bluff multiplier (flop)', 'streetAir.turn': 'bluff multiplier (turn)', 'streetAir.river': 'bluff multiplier (river)',
};
function fmtNum(v, key) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => (typeof x === 'number' ? `${k} ${x <= 1 ? Math.round(x * 100) : x}%` : `${k}: ${x}`)).join(', ');
  if (typeof v !== 'number') return String(v);
  if (/Pct$|openPct|vpipPct/.test(key)) return `${v}%`;
  if (/Mult$/.test(key)) return `${v}×`;
  return v <= 1 ? `${Math.round(v * 100)}%` : String(v);
}
export function numbersFor(model, keys) {
  return keys.map((key) => {
    const rec = model.rec(key);
    if (!rec) return null;
    const short = key.replace(/^types\.\w+\.|^styles\.\w+\.|^pool\./, '');
    return { key, what: NUM_LABEL[short] || short, val: fmtNum(rec.v, short), tag: sourceTag(rec), quote: rec.tag === 'HHP' ? rec.src.quote : null };
  }).filter(Boolean);
}

// The strategy numbers behind one of his actions, and the brain quote behind them if any.
function reasonFor(model, h, p, a) {
  const st = a.state.street;
  const tagOf = (key) => model.rec(key);
  const fmtP = (x) => `${Math.round((x || 0) * 100)}%`;
  let keys = [], text = '', widen = null;
  if (st === 'preflop') {
    const pre = model.types[p.type]?.pre || {};
    const lvl = a.entry.level;
    const posF = TABLE_SETTINGS.positionFactor[p.pos] || 1;
    if (a.label === 'raise' || a.label === 'raise-big') {
      if (lvl === 1) {
        keys = p.type === 'whale' ? ['types.whale.pre.vpipPct', 'types.whale.pre.isoRaiseFreq'] : [`types.${p.type}.pre.openPct`];
        text = `HHP base: he opens about ${pre.openPct}% of hands`;
        widen = posF !== 1 ? { text: `Seat widening: × ${posF} in the ${p.pos} → about ${Math.round(pre.openPct * posF * 10) / 10}% here`, tag: '[OUTSIDE SOURCE] config/table-settings.js' } : null;
        const chart = pre.openCharts?.[p.pos];
        if (chart) {
          keys = [`types.${p.type}.pre.openCharts`];
          text = `He opens HHP's own ${chart} chart for his seat (HHP has no chart of a pro's range)`;
          widen = null;
        } else if (pre.openCharts) keys = [`types.${p.type}.pre.openPct`, `types.${p.type}.pre.openCharts`];
        if (a.label === 'raise-big') { keys = ['pool.bigOpenPremiums', 'pool.bigOpenMult']; text = `Premiums (${(model.pool.bigOpenPremiums || []).join(', ')}) get the big open ${fmtP(model.pool.bigOpenPremiumFreq)} of the time, other hands ${fmtP(model.pool.bigOpenOtherFreq)}`; }
      } else if (lvl === 2) {
        // The limp-reraise quote only fits when he limped first.
        const limped = h.log.slice(0, a.n).some((e) => e.i === a.entry.i && e.meta?.label === 'limp');
        keys = [`types.${p.type}.pre.threeBet`, `types.${p.type}.pre.threeBetPct`, `types.${p.type}.pre.threeBetLight`, limped ? 'pool.limpReraise' : null].filter(Boolean);
        text = pre.threeBet ? `He 3-bets ${pre.threeBet.join(', ')}` : `He 3-bets about his top ${pre.threeBetPct}%${pre.threeBetLight ? ` plus ${pre.threeBetLight.join(', ')}` : ''}`;
      } else if (lvl === 3) { keys = [`types.${p.type}.pre.fourBet`, `types.${p.type}.pre.fourBetPct`, `types.${p.type}.pre.fourBetPartial`]; text = `He 4-bets ${pre.fourBet ? pre.fourBet.join(', ') : `his top ${pre.fourBetPct}%`}`; }
      else { keys = [`types.${p.type}.pre.fiveBet`]; text = `He 5-bets ${(pre.fiveBet || []).join(', ')}`; }
    } else if (a.label === 'limp') { keys = [`types.${p.type}.pre.limpList`, `types.${p.type}.pre.limpPct`, 'types.whale.pre.vpipPct']; text = pre.limpList ? `He limps ${pre.limpList.join(', ')} plus about ${pre.limpPct}% more` : `He limps about ${pre.limpPct || 0}% more hands than he raises`; }
    else if (a.label === 'call') {
      if (lvl === 2) {
        keys = [p.pos === 'BB' ? `types.${p.type}.pre.bbDefendPct` : null, `types.${p.type}.pre.callOpenPct`, `types.${p.type}.pre.limpCallPct`].filter(Boolean);
        text = `He flats an open with about his top ${pre.callOpenPct}%${p.pos === 'BB' && pre.bbDefendPct ? ` (defends ${pre.bbDefendPct}% from the BB)` : ''}`;
        if (posF !== 1) widen = { text: `Seat widening: × ${posF} in the ${p.pos}, and he widens further for a good price or other callers`, tag: '[OUTSIDE SOURCE] config/table-settings.js' };
      }
      else if (lvl === 3) { keys = [`types.${p.type}.pre.continueVs3betPct`, `types.${p.type}.pre.coldCall3bet`]; text = `He calls a 3-bet with about his top ${pre.continueVs3betPct}%`; }
      else { keys = [`types.${p.type}.pre.callVs4bet`, `types.${p.type}.pre.callVs4betPct`, `types.${p.type}.pre.callVs5bet`]; text = 'He calls a 4-bet only with the top of his range'; }
    } else if (a.label === 'check') text = 'He checks his option with the hands he doesn\'t raise';
  } else {
    const s = model.styles[p.style] || {};
    const sk = (x) => `styles.${p.style}.${x}`;
    if (a.label === 'check') { keys = [sk('bet.medium'), sk('bet.air'), sk('bet.strong'), sk(`streetAir.${st}`)]; text = `When checked to he bets strong hands ${fmtP(s.bet?.strong)}, medium ${fmtP(s.bet?.medium)}, air ${fmtP((s.bet?.air || 0) * (s.streetAir?.[st] ?? 1))}, so a check keeps mostly his weaker hands`; }
    else if (a.label === 'bet-big') { keys = [sk('big.monster'), sk('big.strong'), sk('big.air'), sk('bet.air')]; text = `He puts ${fmtP(s.big?.strong)} of his strong bets and ${fmtP(s.big?.air)} of his bluffs in the big size`; }
    else if (a.label === 'bet-small') { keys = [sk('big.strong'), sk('bet.air'), sk(`streetAir.${st}`), sk('bet.medium')]; text = `Only ${fmtP(1 - (s.big?.strong || 0))} of his strong bets go small, and he bluffs air ${fmtP((s.bet?.air || 0) * (s.streetAir?.[st] ?? 1))} of the time`; }
    else if (a.label === 'call') { keys = [sk(`need.${st}`), sk(`sizeSens.${st}`), sk('callAnyPair')]; text = `He continues with hands above about ${fmtP(s.need?.[st])} strength (plus ${fmtP(s.sizeSens?.[st])} per pot-sized bet)${s.callAnyPair && st !== 'river' ? ', and any pair on the flop and turn' : ''}`; }
    else if (a.label === 'raise') { keys = [sk('raise.strong'), sk('raise.draw'), sk('raise.monster'), sk('raise.air'), sk('riverSpaz')]; text = `He raises monsters ${fmtP(s.raise?.monster)}, strong hands ${fmtP(s.raise?.strong)}, draws ${fmtP(s.raise?.draw)}, air ${fmtP(s.raise?.air)}`; }
  }
  const recs = keys.map(tagOf).filter(Boolean);
  const hhp = recs.find((r) => r.tag === 'HHP');
  const numbersSourced = recs.length && recs.every((r) => r.tag === 'HHP');
  return {
    text: text ? `${text} (from his strategy${numbersSourced ? '' : '; some numbers are [OUTSIDE SOURCE] defaults, listed below'}).` : 'From his strategy.',
    quote: hhp ? hhp.src.quote : null,
    tag: hhp ? sourceTag(hhp) : '[OUTSIDE SOURCE]',
    widen,
    numbers: numbersFor(model, keys),
  };
}

// The strategy numbers behind his answer to one of your options ("he folds 81%").
function responseNumbers(model, p, kind, street) {
  const sk = (x) => `styles.${p.style}.${x}`;
  if (kind === 'betSmall' || kind === 'betBig' || kind === 'raise' || kind === 'actual') return numbersFor(model, [sk(`need.${street}`), sk(`sizeSens.${street}`), sk('callAnyPair'), sk('raise.monster'), sk('raise.strong'), sk('raise.draw'), sk('raise.air')]);
  if (kind === 'check') return numbersFor(model, [sk('bet.strong'), sk('bet.medium'), sk('bet.draw'), sk('bet.air'), sk(`streetAir.${street}`), sk('big.strong'), sk('big.air')]);
  return [];
}

// Brain claims about what an action means ("flop check-raises are mostly sets and two pair").
// Checked against what his strategy actually did; a mismatch shows both views.
function claimChecks(model, feat, before, after) {
  const out = [];
  for (const [key, rec] of Object.entries(model.resolved.values)) {
    if (!key.startsWith('claims.') || rec.tag !== 'HHP' || !rec.v) continue;
    const c = rec.v;
    if (!whenMatches(c.when, feat)) continue;
    const g1 = groupShare(after, c.group), g0 = groupShare(before, c.group);
    let ok = true;
    if (c.min != null && g1 < c.min) ok = false;
    if (c.max != null && g1 > c.max) ok = false;
    if (c.direction === 'up' && g1 < g0 - 0.005) ok = false;
    if (c.direction === 'down' && g1 > g0 + 0.005) ok = false;
    out.push({ key, ok, title: c.title, quote: rec.src.quote, tag: sourceTag(rec), got: `${c.groupLabel || c.group} ${pct(g0)} → ${pct(g1)}` });
  }
  return out;
}
// One line per action he took: classes before → after, combos, share of his starting range, why.
function rangeChanges(h, model, vi, r, fromN, toN, classes) {
  const p = h.players[vi];
  const start = total(r.start.preflop);
  return r.actions.filter((a) => a.n > fromN && a.n < toN).map((a) => {
    const e = a.entry;
    const size = e.type === 'bet' || e.type === 'raise'
      ? ` ${e.type === 'raise' ? 'to ' : ''}${usd(e.to)}${a.street === 'preflop' ? ` (${Math.round((e.to / h.stakes.bb) * 10) / 10}bb)` : e.potBefore ? ` (${pct(e.to / e.potBefore)} pot)` : ''}` : '';
    const c0 = total(a.before), c1 = total(a.after);
    const ch = { label: a.label, street: a.street, what: `${p.pos} ${ACT_WORD[a.label] || a.label}${size}`, combos: [c0, c1], pctStart: c1 / start, reason: reasonFor(model, h, p, a) };
    if (a.street !== 'preflop' && classes) {
      ch.before = classShares(a.before, classes);
      ch.after = classShares(a.after, classes);
      const feat = spotFeatures(a.state, h.heroIdx, vi, {});
      feat.villainAction = a.label;
      // A donk: he bets into the preflop raiser before the raiser acts on this street.
      const pfr = a.state.preflopAggressor;
      feat.donk = a.label.startsWith('bet') && pfr >= 0 && pfr !== vi && !a.state.log.some((x) => x.street === a.street && x.i === pfr);
      ch.claims = claimChecks(model, feat, ch.before, ch.after);
    }
    if (!a.ok) ch.note = 'His strategy doesn\'t produce this action (an engine fallback), so his range was left unchanged.';
    return ch;
  });
}

// "Your hand vs his range" right now: share of his weighted range you beat, lose to, chop.
function versusRange(hero, board, w) {
  if (board.length < 3) return null;
  const mine = evaluate([...hero, ...board]);
  let win = 0, lose = 0, tie = 0;
  for (let k = 0; k < w.length; k++) {
    if (!(w[k] > 0)) continue;
    const v = evaluate([...COMBOS[k], ...board]);
    if (mine > v) win += w[k]; else if (mine < v) lose += w[k]; else tie += w[k];
  }
  const t = win + lose + tie || 1;
  return { beat: win / t, lose: lose / t, chop: tie / t };
}

// The paragraph string (plain view) and its parts (the voice layer speaks them).
function preflopParts(h, model, vi, acts, full) {
  const p = h.players[vi];
  const last = [...acts].reverse().find((a) => a.label !== 'fold') || acts[acts.length - 1];
  const tq = typeQuote(model, p.type);
  const info = { pos: p.pos, label: villainLabel(p), type: p.type, typeQuote: tq, words: acts.map((a) => ACT_WORD[a.label] || a.label), keep: null, bigOpen: null };
  const parts = [`${p.pos} is a ${villainLabel(p)}.`];
  if (tq) parts.push(`HHP on this type: “${tq.quote}” ${tq.tag}.`);
  if (last) {
    info.keep = { pct: pct(total(last.after) / full), combos: Math.round(total(last.after)), full: Math.round(full) };
    parts.push(`He ${acts.map((a) => ACT_WORD[a.label] || a.label).join(', then ')}: that keeps about ${info.keep.pct} of all hands (${info.keep.combos} of ${info.keep.full} combos).`);
  }
  if (acts.some((a) => a.label === 'raise-big')) {
    const rr = model.rec('rules.bigOpen');
    if (rr?.tag === 'HHP') { info.bigOpen = { quote: rr.src.quote, tag: sourceTag(rr) }; parts.push(`His open was unusually big: “${rr.src.quote}” ${sourceTag(rr)}.`); }
  }
  parts.push('The grid replays his own strategy, the one he actually plays from.');
  return { text: parts.join(' '), info };
}

function streetParts(h, vi, changes, shares, street, combosLeft) {
  const p = h.players[vi];
  const parts = [];
  const mine = changes.filter((c) => c.street === street);
  const info = { pos: p.pos, street, acted: mine.length > 0, moves: [], top: [], combosLeft };
  if (!mine.length) parts.push(`${p.pos} hasn't acted on the ${street} yet when you decide, so this is his range from the ${street === 'flop' ? 'preflop action' : 'last street'}.`);
  for (const c of mine) {
    const big = CLASS_KEYS.reduce((m, x) => (Math.abs(c.after[x] - c.before[x]) > Math.abs(c.after[m] - c.before[m]) ? x : m), CLASS_KEYS[0]);
    info.moves.push({ what: c.what, cls: big, label: CLASS_LABEL[big], from: pct(c.before[big]), to: pct(c.after[big]) });
    parts.push(`${c.what}: ${CLASS_LABEL[big]} ${pct(c.before[big])} → ${pct(c.after[big])}.`);
  }
  const top = [...CLASS_KEYS].sort((a, b) => shares[b] - shares[a]).slice(0, 2);
  info.top = top.map((k) => ({ cls: k, label: CLASS_LABEL[k], share: pct(shares[k]) }));
  parts.push(`Mostly ${CLASS_LABEL[top[0]].toLowerCase()} (${pct(shares[top[0]])}) and ${CLASS_LABEL[top[1]].toLowerCase()} (${pct(shares[top[1]])}); ${combosLeft} weighted combos left.`);
  return { text: parts.join(' '), info };
}

// HHP's six questions, answered for this hand.
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
// w and classes are the SAME arrays the grid draws, so the chart and the EV never disagree.
function decisionAnalysis(h, d, model, brain, vi, tags, w, classes, shares) {
  const st = d.state;
  const street = st.street;
  const board = st.board;
  const hero = st.players[h.heroIdx];
  const eq = equityVsRange(hero.cards, board, w, { samples: 160 });
  const la = legalActions(st);
  const heroOOP = POSTFLOP_ORDER.indexOf(h.heroIdx) < POSTFLOP_ORDER.indexOf(vi);
  const real = heroOOP && street !== 'river' ? (OUTSIDE_SOURCE.oopRealization ?? 1) : 1;
  const ctx = { st, heroIdx: h.heroIdx, vi, w, eq, classes, shares, street, real };
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
    o.numbers = responseNumbers(model, st.players[vi], k, street);
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

  const feat = spotFeatures(st, h.heroIdx, vi, { heroAction: actual.line.startsWith('bet') ? 'bet' : actual.line, heroLine: actual.line, heroCode: handCode(...hero.cards), capped: shares ? groupShare(shares, 'strongValue') < val(model.resolved, 'sizing.cappedStrongShare', 0.15) : null });
  if (actual.line.startsWith('bet')) feat.betSize = betSizeClass(actualAction.to, pot);
  const matched = matchBrain(model, feat, brain);
  const conflicted = matched.conflicts.length > 0;

  // Verdict: a brain rule's line wins; otherwise the math. Bet sizes follow the [08-04] rule.
  const mathBest = opts.reduce((a, b) => (b.ev > a.ev ? b : a), opts[0]);
  // Every matching rule that points at a line you could take. If they disagree (the playbook
  // says both without a ⚖), none of them decides: the math does, and both stay on screen.
  const recs = matched.rules.filter((r) => r.recommend && opts.some((o) => o.line === r.recommend || (r.recommend === 'bet' && o.line.startsWith('bet'))));
  const specific = [...new Set(recs.map((r) => r.recommend).filter((x) => x !== 'bet'))];
  const family = new Set(recs.map((r) => (r.recommend.startsWith('bet') ? 'bet' : r.recommend)));
  const agree = family.size <= 1 && specific.length <= 1;
  const ruleRec = agree ? (recs.find((r) => r.recommend === specific[0]) || recs[0]) : null;
  let verdict;
  if (ruleRec) verdict = { line: ruleRec.recommend, source: ruleRec.tag, why: `“${ruleRec.quote}”`, rule: ruleRec.key };
  else verdict = { line: mathBest.line, source: '[OUTSIDE SOURCE] math vs his real range (one-street EV)', why: `${mathBest.title} has the best EV: ${usd(mathBest.ev)}.` };
  if (!agree) verdict.split = recs.map((r) => ({ title: r.title, line: LINE_LABEL[r.recommend] || r.recommend, tag: r.tag }));
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
    street, n: d.n, vi, pot, eq, shares, opts, actual, verdict, grade, leaks, feat, rangeRef: w, real,
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

// Which villain a decision is about: the last one who bet or raised into you this street, else
// the preflop raiser, else the first one still in.
function villainAt(h, st) {
  const live = activePlayers(st).filter((p) => p.i !== h.heroIdx).map((p) => p.i);
  const agg = [...st.log].reverse().find((e) => e.street === st.street && (e.type === 'bet' || e.type === 'raise') && e.i !== h.heroIdx);
  if (agg && live.includes(agg.i)) return agg.i;
  if (live.includes(st.preflopAggressor)) return st.preflopAggressor;
  if (st.street === 'preflop') {
    const vol = st.log.find((e) => e.street === 'preflop' && e.i !== h.heroIdx && (e.type === 'call' || e.type === 'raise') && live.includes(e.i));
    return vol ? vol.i : null;
  }
  return live[0] ?? null;
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
  const heroCards = h.players[h.heroIdx].cards;
  const out = { preflop: null, streets: [], end: null };
  const involved = Object.keys(R).map(Number).filter((i) => isInvolved(h, i));
  const classCache = {};
  const classesFor = (street, board) => (classCache[street] ||= comboClasses(board, street));

  // ---- PREFLOP
  const preDec = decisions.filter((d) => d.state.street === 'preflop');
  const pv = involved.includes(h.preflopAggressor) ? h.preflopAggressor
    : involved[0] ?? (preDec.length ? villainAt(h, preDec[0].state) : null);
  const pre = { villain: pv, points: [], questions: null, also: { rules: [], conflicts: [] } };
  let lastN = -1;
  preDec.forEach((d, k) => {
    const vi = villainAt(h, d.state);
    const pt = { street: 'preflop', vi, grade: h.heroDecisions?.[k] || null, n: d.n };
    if (vi != null) {
      const r = R[vi];
      const acts = r.actions.filter((a) => a.street === 'preflop' && a.n < d.n);
      const last = [...acts].reverse().find((a) => a.label !== 'fold');
      const dead = new Set(heroCards);
      const full = total(r.start.preflop);
      if (last) {
        const mix = preflopActionMix(last);
        pt.grid = { mode: 'action', cells: actionCells({ mix, before: last.before, dead }), combos: `${Math.round(total(last.after))} combos (${pct(total(last.after) / full)} of his hands)`, detail: { actionMix: mix, before: last.before, dead } };
        const pp = preflopParts(h, model, vi, acts, full);
        pt.paragraph = pp.text;
        pt.para = pp.info;
      } else pt.paragraph = `${h.players[vi].pos} hasn't acted yet: his range is every hand.`;
      pt.changes = rangeChanges(h, model, vi, r, lastN, d.n, null);
    } else pt.paragraph = 'Nobody has put money in yet: everyone behind you has a full range.';
    lastN = d.n;
    pre.points.push(pt);
  });
  // The six questions are about the moment of your first decision: whoever had acted by then.
  pre.questions = preflopQuestions(h, model, h.spot, pre.points[0]?.vi ?? null);
  if (preDec.length) {
    const st = preDec[0].state;
    const firstLimper = st.log.find((e) => e.street === 'preflop' && e.type === 'call' && e.level === 1);
    const lp = firstLimper ? (['UTG', 'UTG+1', 'LJ'].includes(st.players[firstLimper.i].pos) ? 'EP' : ['HJ', 'CO', 'BTN'].includes(st.players[firstLimper.i].pos) ? 'late' : null) : null;
    const d0 = h.heroDecisions?.[0];
    const heroAction = d0 ? (d0.action === 'call' && (h.spot.kind === 'RFI' || h.spot.kind === 'ISO') ? 'limp' : d0.action) : null;
    // Match every preflop decision you made (a later one can be facing a 3-bet or 4-bet), and
    // show the union.
    const m = { rules: [], conflicts: [] };
    const seen = new Set();
    preDec.forEach((pd, k) => {
      const sk = pd.state;
      const kind = k === 0 ? h.spot.kind : (classifySpot(sk, h.heroIdx)?.kind || h.spot.kind);
      const e = h.log[pd.n];
      const act = k === 0 ? heroAction : e?.type || null;
      const vi = villainAt(h, sk) ?? pv;
      const f = spotFeatures(sk, h.heroIdx, vi, { spot: kind, heroAction: act, heroCodes: h.heroCode, limperPos: lp });
      const mk = matchBrain(model, { ...f, facingLevel: sk.raiseLevel }, brain);
      for (const x of mk.rules) if (!seen.has(x.key)) { seen.add(x.key); m.rules.push(x); }
      for (const x of mk.conflicts) if (!seen.has(x.key)) { seen.add(x.key); m.conflicts.push(x); }
    });
    pre.also = m;
    pre.conflicted = m.conflicts.length > 0;
  }
  pre.leaks = pre.conflicted ? [] : (h.heroDecisions || []).flatMap((d) => preflopLeaks(d, tags));
  out.preflop = pre;

  // ---- FLOP / TURN / RIVER: one point per decision, each with his range at that moment
  for (const street of ['flop', 'turn', 'river']) {
    const deal = h.log.find((e) => e.type === 'deal' && e.street === street);
    if (!deal) break;
    const heroFolded = h.log.some((e) => e.i === h.heroIdx && e.type === 'fold' && h.log.indexOf(e) < h.log.indexOf(deal));
    if (heroFolded) break;
    const classes = classesFor(street, deal.board);
    const dealN = h.log.indexOf(deal);
    const sd = decisions.filter((d) => d.state.street === street);
    const dead = new Set([...heroCards, ...deal.board]);
    const sec = { street, board: deal.board, points: [] };
    let fromN = dealN;
    const mk = (vi, w, toN, d) => {
      const r = R[vi];
      const prev = r.start[street];
      const shares = classShares(w, classes);
      const left = Math.round(total(w) * 10) / 10;
      const changes = rangeChanges(h, model, vi, r, fromN, toN, classes);
      const pt = {
        street, vi, n: toN, shares, changes,
        grid: { mode: 'class', cells: rangeCells({ w, prev, classes, dead }), shares, combos: `${left} weighted combos left (${pct(total(w) / total(r.start.preflop))} of his starting range)`, detail: { w, prev, classes, dead } },
        ...(() => { const sp = streetParts(h, vi, changes, shares, street, left); return { paragraph: sp.text, para: sp.info }; })(),
        versus: versusRange(heroCards, deal.board, w),
      };
      if (d) pt.analysis = decisionAnalysis(h, d, model, brain, vi, tags, w, classes, shares);
      return pt;
    };
    for (const d of sd) {
      const vi = villainAt(h, d.state);
      if (vi == null) continue;
      sec.points.push(mk(vi, d.ranges[vi], d.n, d));
      fromN = d.n;
    }
    if (!sec.points.length) {
      const vi = involved.find((i) => !h.players[i].folded) ?? involved[0];
      if (vi == null) break;
      sec.points.push(mk(vi, R[vi].streets[street], Infinity, null));
    }
    const entry = catalogEntry(brain, h.players[sec.points[0].vi]);
    for (const pt of sec.points) {
      const f = pt.analysis && catalogFieldFor(entry, pt.analysis);
      if (f) pt.analysis.also.catalog = { name: entry.name, field: f.name, text: f.text, tag: entryTag(entry) };
    }
    out.streets.push(sec);
  }

  // ---- END OF HAND
  const all = out.streets.flatMap((s) => s.points.map((p) => p.analysis).filter(Boolean));
  const leaks = [...new Set([...pre.leaks, ...all.flatMap((a) => a.leaks)])];
  const recent = history.slice(0, 50);
  const repeats = Object.fromEntries(leaks.map((t) => [t, recent.filter((x) => (x.leaks || []).includes(t)).length]));
  const worst = all.filter((a) => a.grade.mark === '❌').sort((a, b) => (b.grade.loss || 0) - (a.grade.loss || 0))[0]
    || all.find((a) => a.grade.mark === '⚠️');
  const preWrong = pre.conflicted ? null : (h.heroDecisions || []).find((d) => d.verdict === 'wrong');
  const takeaway = takeawayText({ worst, preWrong, h });
  const known = [];
  if (h.stakes.label !== '1/2' && (leaks.length || preWrong)) {
    const kl = (brain?.knownLeaks || []).find((k) => /loses above it/i.test(k.title));
    if (kl) known.push(knownLeakForYou(kl, brain.knownLeaksFrom));
  }
  const whole = [];
  const lastSec = out.streets[out.streets.length - 1];
  const mv = lastSec ? lastSec.points[lastSec.points.length - 1].vi : pv;
  if (mv != null) {
    const entry = catalogEntry(brain, h.players[mv]);
    if (entry) whole.push({ title: `${entry.name}: ${h.players[mv].pos} played this style`, fields: entry.fields, tag: entryTag(entry) });
  }
  out.end = { takeaway, leaks: leaks.map((t) => ({ tag: t, repeats: repeats[t] })), known, whole };
  out.leaks = leaks;
  out.involved = involved;
  out.comboList = comboList;
  return out;
}

// Your known leak, written to you: second person, without the coach-facing notes, tagged as
// coming from your own session log (not from HHP).
export function knownLeakForYou(kl, from = '') {
  const you = (t) => t.replace(/\b(Wins|wins)\b/g, 'win').replace(/\b(Loses|loses)\b/g, 'lose').replace(/\b(Tops|tops)\b/g, 'top').replace(/\bHer\b/g, 'Your').replace(/\bher\b/g, 'your');
  const title = you(kl.title);
  const text = kl.text.split(/(?<=\.)\s+/)
    .map((x) => x.trim())
    .filter((x) => !/\b(she|Bring this up|Treat|keep tracking)\b/i.test(x))
    .map(you).join(' ');
  return { title: /^(win|top|lose)\b/.test(title) ? `you ${title}` : title.toLowerCase(), text, tag: `[YOUR LOG] project-instructions.md › Known leaks${from ? ` (${from})` : ''}` };
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
