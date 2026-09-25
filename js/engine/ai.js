// Villain decision-making: type tendencies (config/villains.js) + real hand strength and draws.
import { VILLAIN_CONFIG } from '../../config/villains.js';
import { handCode, HAND_PCT, expandRange, rand, pick } from './cards.js';
import { legalActions, applyAction, potTotal, activePlayers } from './game.js';
import { assess } from './strength.js';

const rangeCache = new Map();
const inList = (list, code) => {
  if (!list) return false;
  const key = list.join(',');
  if (!rangeCache.has(key)) rangeCache.set(key, expandRange(list));
  return rangeCache.get(key).has(code);
};
const inTop = (pctVal, code) => pctVal > 0 && HAND_PCT[code] <= pctVal / 100;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Live-looking bet sizes: $1 steps when small, $5 steps when bigger (always $5 at $2/5).
export function roundBet(x, stakes) {
  const step = stakes.bb >= 5 ? 5 : x >= 30 ? 5 : 1;
  return Math.max(step, Math.round(x / step) * step);
}

function finalizeRaise(s, la, to) {
  to = roundBet(to, s.stakes);
  to = clamp(to, la.minTo, la.maxTo);
  // If the raise leaves less than ~25% of the stack behind, just jam.
  if (la.maxTo - to < 0.25 * la.maxTo) to = la.maxTo;
  return { type: la.isBet ? 'bet' : 'raise', to };
}

const passiveResponse = (la) => (la.canCheck ? { type: 'check' } : { type: 'fold' });

function preflopHistory(s, i) {
  const mine = s.log.filter((e) => e.street === 'preflop' && e.i === i && e.type !== 'post');
  return {
    limped: mine.some((e) => e.type === 'call' && e.level === 1),
    raised: mine.some((e) => e.type === 'raise'),
    called: mine.some((e) => e.type === 'call' && e.level >= 2),
    acted: mine.length > 0,
  };
}

export function villainPreflop(s, i) {
  const la = legalActions(s);
  const p = la.player;
  const t = VILLAIN_CONFIG.types[p.type];
  const cfg = t.preflop;
  const loose = s.drill?.looseness || 1;
  const code = handCode(...p.cards);
  const posF = VILLAIN_CONFIG.positionFactor[p.pos] || 1;
  const bb = s.stakes.bb;
  const hist = preflopHistory(s, i);
  const level = s.raiseLevel;
  const pf = cfg.foldToPressure || 1;
  const pre = s.log.filter((e) => e.street === 'preflop' && e.type !== 'post');
  const limpers = pre.filter((e) => e.type === 'call' && e.level === 1).length;
  const callersAtLevel = pre.filter((e) => e.type === 'call' && e.level === level).length;

  if (level === 1) {
    const openRange = cfg.openPct * posF * (limpers ? cfg.isoFactor : 1);
    if (inTop(openRange, code) && la.canRaise) {
      const base = pick(VILLAIN_CONFIG.openSizes[s.stakes.label]);
      return finalizeRaise(s, la, base + limpers * bb * (p.type === 'aggressive' ? 1.5 : 1));
    }
    const limpBoost = 1 + 0.3 * limpers + (p.pos === 'SB' && limpers ? 0.6 : 0);
    const limpRange = openRange + cfg.limpPct * posF * limpBoost * loose;
    if (la.canCheck) return { type: 'check' };
    if (inTop(limpRange, code)) return { type: 'call' };
    return { type: 'fold' };
  }

  const toCallBB = la.toCall / bb;
  const inPosVsRaiser = s.lastAggressor >= 0 && !['SB', 'BB'].includes(p.pos) && p.i > s.lastAggressor;

  if (level === 2) {
    const forced = p.meta.force3bet;
    const threeBet = forced || (cfg.threeBet ? inList(cfg.threeBet, code) : inTop(cfg.threeBetPct * (callersAtLevel ? 0.85 : 1), code));
    const limpReraise = hist.limped && (inList(['QQ+', 'AK'], code));
    if (la.canRaise && ((threeBet && !hist.limped) || limpReraise)) {
      const mult = inPosVsRaiser ? 3 : 4;
      return finalizeRaise(s, la, s.currentBet * mult + callersAtLevel * s.currentBet);
    }
    const bluffable = HAND_PCT[code] > 0.12 && HAND_PCT[code] < 0.4 && code.endsWith('s');
    if (la.canRaise && !hist.limped && bluffable && rand() < (cfg.bluff3betPct || 0) / 100 * 2) {
      return finalizeRaise(s, la, s.currentBet * (inPosVsRaiser ? 3 : 4));
    }
    const price = clamp(9 / Math.max(toCallBB, 1), 0.45, 1.4);
    if (hist.limped) {
      return rand() < (cfg.limpCallPct / 100) * clamp(price * 1.1, 0.4, 1) * loose ? { type: 'call' } : { type: 'fold' };
    }
    const blindF = p.pos === 'BB' ? 1.5 : p.pos === 'SB' ? 0.8 : 1;
    const multiwayF = 1 + 0.2 * callersAtLevel;
    const top = (cfg.threeBet ? 3 : cfg.threeBetPct) + cfg.callOpenPct * price * blindF * multiwayF * loose;
    return inTop(top, code) ? { type: 'call' } : { type: 'fold' };
  }

  if (level === 3) {
    const involved = hist.raised || hist.called || hist.limped;
    const fourBet = cfg.fourBet ? inList(cfg.fourBet, code) : inTop(cfg.fourBetPct, code);
    const bluff = cfg.fourBetBluffs && inList(cfg.fourBetBluffs, code) && rand() < 0.35;
    if (la.canRaise && (fourBet || (bluff && involved))) {
      const mult = inPosVsRaiser ? 2.3 : 2.8;
      return finalizeRaise(s, la, s.currentBet * mult);
    }
    const contPct = (cfg.continueVs3betPct / pf) * (involved ? 1 : 0.4) * loose;
    if (inTop(contPct, code) && la.toCall < 0.45 * p.stack) return { type: 'call' };
    return { type: 'fold' };
  }

  if (level === 4) {
    if (inList(cfg.fiveBet, code) && la.canRaise) return { type: 'raise', to: la.maxTo };
    const call = cfg.callVs4bet ? inList(cfg.callVs4bet, code) : inTop(cfg.callVs4betPct / pf * loose, code);
    if (call || inList(cfg.fiveBet, code)) {
      if (la.canRaise && p.stack - la.toCall < potTotal(s) * 0.8) return { type: 'raise', to: la.maxTo };
      return { type: 'call' };
    }
    return { type: 'fold' };
  }

  // 5-bet+ : continue only with the very top.
  const top = inList(p.type === 'whale' ? ['QQ+', 'AK'] : ['KK+'], code);
  return top ? { type: 'call' } : { type: 'fold' };
}

export function villainPostflop(s, i) {
  const la = legalActions(s);
  const p = la.player;
  const t = VILLAIN_CONFIG.types[p.type];
  const cfg = t.postflop;
  const loose = s.drill?.looseness || 1;
  const opponents = activePlayers(s).length - 1;
  const a = assess(p.cards, s.board, opponents);
  const river = s.street === 'river';
  const pot = potTotal(s);

  let key = a.cls;
  if (!river && (key === 'air' || key === 'medium') && a.isDraw) {
    key = cfg.bet.draw > (cfg.bet[key] || 0) ? 'draw' : key;
  }

  if (la.canCheck) {
    let pb = cfg.bet[key] ?? 0;
    if (s.preflopAggressor === i && s.street === 'flop') pb += cfg.cbetBonus;
    if (key === 'air') pb = pb / Math.max(1, opponents * 0.8) + (!river && a.draws.gutshot ? 8 : 0);
    if (key === 'medium' && opponents >= 3) pb *= 0.6;
    if (la.canRaise && rand() * 100 < pb) {
      return finalizeRaise(s, la, pick(cfg.sizing) * pot);
    }
    return { type: 'check' };
  }

  // Facing a bet.
  const potOdds = la.toCall / (pot + la.toCall);
  const betFrac = la.toCall / Math.max(1, pot - la.toCall);
  const streetMult = s.street === 'flop' ? 0.8 : s.street === 'turn' ? 1 : 1.2;
  // Bigger bets, later streets, more opponents and more "respect" all demand a stronger hand.
  const k = 1.5 + cfg.respect * (1 + Math.min(betFrac, 2)) * streetMult * 1.5 * (t.preflop.foldToPressure || 1)
    + (Math.min(opponents, 4) - 1) * 0.4;
  const eqVsBet = a.hs ** (k / Math.sqrt(loose)) + cfg.stickiness * loose;
  const cont = Math.max(eqVsBet, river ? 0 : a.drawEq + cfg.stickiness * 0.5);

  const rk = key === 'medium' ? null : key;
  const reRaise = s.raiseLevel >= 2;
  if (la.canRaise && rk && !(reRaise && rk !== 'monster')) {
    let pr = cfg.raise[rk] ?? 0;
    if (rk === 'air') pr = river ? pr * 0.5 : pr / Math.max(1, opponents);
    if (rand() * 100 < pr) {
      const to = s.currentBet * (2.6 + rand() * 0.8) + (pot - la.toCall - s.currentBet) * 0.25;
      return finalizeRaise(s, la, to);
    }
  }
  if (cont >= potOdds) return { type: 'call' };
  if (cfg.callAnyPair && a.hasPair && betFrac <= (p.type === 'whale' ? 2.5 : 1.1)) return { type: 'call' };
  if (cfg.callAnyDraw && !river && a.draws.outs >= 4) return { type: 'call' };
  if (river && a.hs > 0.3 && rand() < cfg.riverBluffCatch * loose) return { type: 'call' };
  if (loose > 1.3 && (a.hasPair || a.draws.outs >= 4) && rand() < 0.5) return { type: 'call' };
  return passiveResponse(la);
}

// Pick and apply one villain action. Falls back safely if a choice is illegal.
export function villainAct(s) {
  const i = s.toAct;
  let act = s.street === 'preflop' ? villainPreflop(s, i) : villainPostflop(s, i);
  try {
    return applyAction(s, act);
  } catch {
    const la = legalActions(s);
    act = la.canCheck ? { type: 'check' } : la.canCall ? { type: 'call' } : { type: 'fold' };
    return applyAction(s, act);
  }
}
