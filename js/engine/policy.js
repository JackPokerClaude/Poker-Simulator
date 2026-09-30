// Villain policy: for a villain, a hand and the current state, the probability of every action
// he can take. No randomness in here: the villain samples from it (ai.js), and the range
// tracker asks the same question for every hand he could hold, so what he does and what the
// feedback says his range is always come from the same numbers.
//
// Each option: { label, p, act: { type, to? }, pickTo? }
//   labels: fold, check, call, limp, raise, raise-big (the big-open tell), bet-small, bet-big
import { handCode, HAND_PCT, expandRange, pick } from './cards.js';
import { legalActions, potTotal, activePlayers } from './game.js';
import { boardTable, features, aiClass } from './strength.js';
import { getModel, getCharts } from '../villains/model.js';
import { TABLE_SETTINGS } from '../../config/table-settings.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

const rangeCache = new Map();
export const inList = (list, code) => {
  if (!list || !list.length) return false;
  const key = list.join(',');
  if (!rangeCache.has(key)) rangeCache.set(key, expandRange(list));
  return rangeCache.get(key).has(code);
};
const inTop = (pctVal, code) => pctVal > 0 && HAND_PCT[code] <= pctVal / 100;
const partial = (map, code) => (map && map[code]) || 0;
const SUITED_CONNECTORS = new Set(['T9s', '98s', '87s', '76s', '65s', '54s', '43s', '32s', 'J9s', 'T8s', '97s', '86s', '75s', '64s', '53s']);

// Live-looking bet sizes: $1 steps when small, $5 steps when bigger (always $5 at $2/5).
export function roundBet(x, stakes) {
  const step = stakes.bb >= 5 ? 5 : x >= 30 ? 5 : 1;
  return Math.max(step, Math.round(x / step) * step);
}

export function finalizeTo(s, la, to) {
  to = roundBet(to, s.stakes);
  to = clamp(to, la.minTo, la.maxTo);
  // If the raise leaves less than ~25% of the stack behind, just jam.
  if (la.maxTo - to < 0.25 * la.maxTo) to = la.maxTo;
  return to;
}
const raiseAct = (s, la, to) => ({ type: la.isBet ? 'bet' : 'raise', to: finalizeTo(s, la, to) });

function preflopHistory(s, i) {
  const mine = s.log.filter((e) => e.street === 'preflop' && e.i === i && e.type !== 'post');
  return {
    limped: mine.some((e) => e.type === 'call' && e.level === 1),
    raised: mine.some((e) => e.type === 'raise'),
    called: mine.some((e) => e.type === 'call' && e.level >= 2),
  };
}

// Merge options that ended up identical, drop zero ones, normalize to 1.
function finish(opts) {
  const out = [];
  for (const o of opts) {
    if (!(o.p > 1e-9)) continue;
    const same = out.find((x) => x.label === o.label);
    if (same) same.p += o.p; else out.push({ ...o });
  }
  const tot = out.reduce((a, o) => a + o.p, 0) || 1;
  for (const o of out) o.p /= tot;
  return out;
}

// The planted 3-bettor's range in the 3-bet drill (the tracker uses the same test).
export function threeBetRangeHas(type, code) {
  const cfg = getModel().types[type].pre;
  return (cfg.threeBet ? inList(cfg.threeBet, code) : HAND_PCT[code] <= (cfg.threeBetPct || 0) / 100) || inList(cfg.threeBetLight, code);
}

// ---------------------------------------------------------------- preflop
export function preflopPolicy(s, i, hole) {
  const M = getModel();
  const la = legalActions(s);
  const p = s.players[i];
  const cfg = M.types[p.type].pre;
  const pool = M.pool;
  const loose = s.drill?.looseness || 1;
  const code = handCode(...hole);
  const posF = TABLE_SETTINGS.positionFactor[p.pos] || 1;
  const bb = s.stakes.bb;
  const hist = preflopHistory(s, i);
  const level = s.raiseLevel;
  const pf = cfg.foldToPressure || 1;
  const pre = s.log.filter((e) => e.street === 'preflop' && e.type !== 'post');
  const limpers = pre.filter((e) => e.type === 'call' && e.level === 1).length;
  const callersAtLevel = pre.filter((e) => e.type === 'call' && e.level === level).length;
  const inPosVsRaiser = s.lastAggressor >= 0 && !['SB', 'BB'].includes(p.pos) && p.i > s.lastAggressor;
  const fold = la.canCheck ? { label: 'check', act: { type: 'check' } } : { label: 'fold', act: { type: 'fold' } };

  if (level === 1) {
    const opts = [];
    const whale = p.type === 'whale';
    const openEff = cfg.openPct * posF * (limpers ? (cfg.isoFactor ?? 1) : 1);
    const vpip = whale ? (cfg.vpipPct || 0) * Math.min(1.15, posF) : 0;
    let pRaise = inTop(openEff, code) ? 1 : 0;
    // A pro opens from HHP's own RFI chart for his seat, when there is one.
    const chartName = cfg.openCharts?.[p.pos];
    const chartRow = chartName && !limpers ? getCharts()?.charts?.[chartName]?.hands?.[code] : null;
    if (chartRow) pRaise = chartRow[0] / 100;
    // The whale isos about 80% of the time over limpers, with anything he plays.
    if (whale && limpers && inTop(vpip, code)) pRaise = cfg.isoRaiseFreq ?? pRaise;
    if (!la.canRaise) pRaise = 0;
    if (pRaise > 0) {
      const sizes = TABLE_SETTINGS.openSizes[s.stakes.label] || [bb * 5];
      const extra = limpers * bb * (p.type === 'aggressive' ? 1.5 : 1);
      const med = [...sizes].sort((a, b) => a - b)[sizes.length >> 1];
      const tellType = (pool.bigOpenTypes || []).includes(p.type);
      const premium = inList(pool.bigOpenPremiums, code);
      const pBig = tellType ? (premium ? pool.bigOpenPremiumFreq : pool.bigOpenOtherFreq) : 0;
      const bigTo = finalizeTo(s, la, med * (pool.bigOpenMult || 1.4) + extra);
      opts.push({ label: 'raise', p: pRaise * (1 - pBig), act: raiseAct(s, la, med + extra), pickTo: () => finalizeTo(s, la, pick(sizes) + extra) });
      opts.push({ label: 'raise-big', p: pRaise * pBig, act: { type: 'raise', to: bigTo } });
    }
    const rest = 1 - pRaise;
    if (la.canCheck) { opts.push({ label: 'check', p: rest, act: { type: 'check' } }); return finish(opts); }
    const limpBoost = 1 + 0.3 * limpers + (p.pos === 'SB' && limpers ? 0.6 : 0);
    let limp;
    if (whale) limp = inTop(vpip * loose, code);
    else {
      const limpRange = openEff + (cfg.limpPct || 0) * posF * limpBoost * loose;
      limp = inTop(limpRange, code) || inList(cfg.limpList, code);
    }
    opts.push({ label: 'limp', p: rest * (limp ? 1 : 0), act: { type: 'call' } });
    opts.push({ label: 'fold', p: rest * (limp ? 0 : 1), act: { type: 'fold' } });
    return finish(opts);
  }

  const toCallBB = la.toCall / bb;
  const price = clamp(9 / Math.max(toCallBB, 1), 0.45, 1.4);

  if (level === 2) {
    const opts = [];
    const blind = p.pos === 'SB' || p.pos === 'BB';
    let p3 = 0;
    if (hist.limped) {
      p3 = inList(pool.limpReraise, code) ? 1 : partial(pool.limpReraisePartial, code);
    } else {
      p3 = cfg.threeBet ? (inList(cfg.threeBet, code) ? 1 : 0) : (inTop((cfg.threeBetPct || 0) * (callersAtLevel ? 0.85 : 1), code) ? 1 : 0);
      if (!p3 && inList(cfg.threeBetLight, code) && !(blind && pool.blindsNo3betSuitedConnectors && SUITED_CONNECTORS.has(code))) p3 = 1;
      const bluffable = HAND_PCT[code] > 0.12 && HAND_PCT[code] < 0.4 && code.endsWith('s')
        && !(blind && pool.blindsNo3betSuitedConnectors && SUITED_CONNECTORS.has(code));
      if (!p3 && bluffable) p3 = clamp(((cfg.bluff3betPct || 0) / 100) * 2, 0, 1);
    }
    if (!la.canRaise) p3 = 0;
    if (p3 > 0) opts.push({ label: 'raise', p: p3, act: raiseAct(s, la, s.currentBet * (inPosVsRaiser ? 3 : 4) + callersAtLevel * s.currentBet) });
    let pc;
    if (hist.limped) pc = clamp(((cfg.limpCallPct || 0) / 100) * clamp(price * 1.1, 0.4, 1) * loose, 0, 1);
    else {
      const blindF = p.pos === 'BB' ? 1.5 : p.pos === 'SB' ? 0.8 : 1;
      const multiwayF = 1 + 0.2 * callersAtLevel;
      let top = (cfg.threeBet ? 3 : (cfg.threeBetPct || 0)) + (cfg.callOpenPct || 0) * price * blindF * multiwayF * loose;
      if (p.pos === 'BB' && cfg.bbDefendPct) top = Math.max(top, cfg.bbDefendPct * clamp(price, 0.6, 1.2) * loose);
      if (p.type === 'whale') top = Math.max(top, (cfg.vpipPct || 0) * 0.85 * price * loose);
      pc = inTop(top, code) ? 1 : 0;
    }
    opts.push({ label: 'call', p: (1 - p3) * pc, act: { type: 'call' } });
    opts.push({ ...fold, p: (1 - p3) * (1 - pc) });
    return finish(opts);
  }

  if (level === 3) {
    const opts = [];
    const involved = hist.raised || hist.called || hist.limped;
    let p4 = (cfg.fourBet ? (inList(cfg.fourBet, code) ? 1 : 0) : (inTop(cfg.fourBetPct || 0, code) ? 1 : 0)) || partial(cfg.fourBetPartial, code);
    if (!p4 && involved && inList(cfg.fourBetBluffs, code)) p4 = 0.35;
    if (!la.canRaise) p4 = 0;
    if (p4 > 0) opts.push({ label: 'raise', p: p4, act: raiseAct(s, la, s.currentBet * (inPosVsRaiser ? 2.3 : 2.8)) });
    const contPct = ((cfg.continueVs3betPct || 0) / pf) * (involved ? 1 : (cfg.coldCallVs3bet ?? 0.4)) * loose;
    let pc = inTop(contPct, code) && la.toCall < 0.45 * p.stack ? 1 : 0;
    if (!involved && inList(cfg.coldCall3bet, code)) pc = 1;
    opts.push({ label: 'call', p: (1 - p4) * pc, act: { type: 'call' } });
    opts.push({ ...fold, p: (1 - p4) * (1 - pc) });
    return finish(opts);
  }

  if (level === 4) {
    const five = inList(cfg.fiveBet, code) && la.canRaise;
    if (five) return finish([{ label: 'raise', p: 1, act: { type: 'raise', to: la.maxTo } }]);
    const call = cfg.callVs4bet ? inList(cfg.callVs4bet, code) : inTop(((cfg.callVs4betPct || 0) / pf) * loose, code);
    if (call || inList(cfg.fiveBet, code)) {
      if (la.canRaise && p.stack - la.toCall < potTotal(s) * 0.8) return finish([{ label: 'raise', p: 1, act: { type: 'raise', to: la.maxTo } }]);
      return finish([{ label: 'call', p: 1, act: { type: 'call' } }]);
    }
    return finish([{ ...fold, p: 1 }]);
  }

  // 5-bet and up: continue only with the very top.
  const top = inList(cfg.callVs5bet || ['KK+'], code);
  return finish([top ? { label: 'call', p: 1, act: { type: 'call' } } : { ...fold, p: 1 }]);
}

// ---------------------------------------------------------------- postflop
export function postflopPolicy(s, i, hole, table = boardTable(s.board)) {
  const M = getModel();
  const la = legalActions(s);
  const p = s.players[i];
  const st = M.styles[p.style] || M.styles.aggroFolder;
  const loose = s.drill?.looseness || 1;
  const opponents = activePlayers(s).length - 1;
  const street = s.street;
  const river = street === 'river';
  const pot = potTotal(s);
  const f = features(hole, s.board, table);
  const cls = aiClass(f, opponents);
  let key = cls;
  if (!river && (key === 'air' || key === 'medium') && f.draws.outs >= 8 && st.bet.draw > (st.bet[key] || 0)) key = 'draw';

  if (la.canCheck) {
    let pb = st.bet[key] ?? 0;
    if (key === 'air' || key === 'draw') pb *= st.streetAir?.[street] ?? 1;
    if (s.preflopAggressor === i && street === 'flop') pb += st.cbet || 0;
    if (key === 'air') pb = pb / Math.max(1, opponents * 0.8) + (!river && f.draws.gutshot ? 0.08 : 0);
    if (key === 'medium' && opponents >= 3) pb *= 0.6;
    pb = la.canRaise ? clamp(pb, 0, 0.95) : 0;
    const pBig = st.big?.[key] ?? 0.5;
    const small = raiseAct(s, la, (st.sizes?.small ?? 0.33) * pot);
    const big = raiseAct(s, la, (st.sizes?.big ?? 0.75) * pot);
    const lab = (a) => (a.to >= 0.5 * pot ? 'bet-big' : 'bet-small');
    return finish([
      { label: 'check', p: 1 - pb, act: { type: 'check' } },
      { label: lab(small), p: pb * (1 - pBig), act: small },
      { label: lab(big), p: pb * pBig, act: big },
    ]);
  }

  // Facing a bet or raise.
  const toCall = la.toCall;
  const betFrac = toCall / Math.max(1, pot - toCall);
  const potOdds = toCall / (pot + toCall);
  const eq = f.hs ** (1 + 0.5 * (opponents - 1));
  const drawEq = river ? 0 : (s.board.length === 3 ? f.draws.outs * 0.035 : f.draws.outs * 0.02);
  const score = Math.max(eq, drawEq);
  const need = (st.need?.[street] ?? 0.45) + (st.sizeSens?.[street] ?? 0.1) * Math.min(betFrac, 2)
    + 0.03 * (opponents - 1) + (s.raiseLevel >= 2 ? 0.1 : 0) - (loose - 1) * 0.1;
  let pCont = sigmoid((score - need) / 0.045);
  if (st.callAnyPair && !river && f.hasPair && betFrac <= (p.type === 'whale' ? 2.5 : 1.2)) pCont = Math.max(pCont, 0.9);
  if (drawEq >= potOdds) pCont = Math.max(pCont, 0.8);
  if (cls === 'monster') pCont = 1;

  const rk = key === 'medium' ? null : key;
  let pr = rk ? (st.raise?.[rk] ?? 0) : 0;
  if (rk === 'air') {
    pr = river ? pr * 0.5 : pr / Math.max(1, opponents);
    if (river && betFrac < 0.5) pr += (st.riverSpaz || 0) * 0.4;
  }
  if (s.raiseLevel >= 2) pr = rk === 'monster' ? pr * 0.7 : 0;
  if (!la.canRaise) pr = 0;
  pr = clamp(pr, 0, 0.9);
  const raiseTo = s.currentBet * 3 + Math.max(0, pot - toCall - s.currentBet) * 0.25;
  return finish([
    { label: 'raise', p: pr, act: raiseAct(s, la, raiseTo) },
    { label: 'call', p: (1 - pr) * pCont, act: { type: 'call' } },
    { label: 'fold', p: (1 - pr) * (1 - pCont), act: { type: 'fold' } },
  ]);
}

export function villainPolicy(s, i, hole, table) {
  return s.street === 'preflop' ? preflopPolicy(s, i, hole) : postflopPolicy(s, i, hole, table);
}

// Probability of an observed label under a policy.
export const probOf = (opts, label) => opts.reduce((a, o) => a + (o.label === label ? o.p : 0), 0);
