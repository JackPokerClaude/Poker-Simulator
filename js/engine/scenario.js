// Classify hero's preflop spot and map it to the closest HHP chart.
import { POSTFLOP_ORDER } from './game.js';
import { OUTSIDE_SOURCE } from '../../config/outside-source.js';
import { getModel } from '../villains/model.js';

// The LJ open chart compiled from playbook-preflop.md section 3 [2025-02-18 HHP].
export const LJ_CHART = 'LJ OPEN - 200BB (2025-02-18 HHP)';
export const LJ_CHART_100 = 'LJ OPEN - 100BB (2025-02-18 HHP)';
// Effective stack for an open, in big blinds: your stack vs the biggest stack still to act.
export function openEffectiveBB(s, heroIdx) {
  const hero = s.players[heroIdx];
  const behind = s.players.filter((p) => p.i !== heroIdx && !p.folded && !s.log.some((e) => e.street === 'preflop' && e.i === p.i && e.type !== 'post'));
  const mine = hero.stack + hero.committed;
  const biggest = behind.length ? Math.max(...behind.map((p) => p.stack + p.committed)) : mine;
  return Math.min(mine, biggest) / s.stakes.bb;
}
const compiledChart = (name) => { try { return !!getModel().charts[name]; } catch { return false; } };

// Which villain types each opponent-specific chart was drawn for. Only these count as an
// exact [HHP] match; any other type gets the chart as the closest stand-in, [OUTSIDE SOURCE].
// (Label note in the brain: "TIGHT PLAYER" = the 7-8% passive opener, "LOOSE PLAYER" = the 30%
// opener, "ABC PLAYER" = the 15% tight opener.)
const FITS = {
  'BB vs PASSIVE OPEN': ['passive', 'rec'],
  'BB vs AGGRO OPEN': ['aggressive', 'thinking', 'whale'],
  'BTN vs EP OPEN (TIGHT PLAYER)': ['passive', 'rec'],
  'BTN vs EP OPEN (LOOSE PLAYER)': ['aggressive', 'thinking', 'whale'],
  'HJ vs EP OPEN (ABC PLAYER)': ['tight'],
  'COLD 4B vs TIGHT 3B': ['passive', 'rec', 'tight'],
  'COLD 4B vs WIDE 3B': ['aggressive', 'thinking', 'whale'],
  'OOP vs PASSIVE 3BET': ['passive', 'rec'],
  'IP vs PASSIVE 3BET': ['passive', 'rec'],
  'OOP vs AGGRO 3BET': ['aggressive', 'thinking'],
  'IP vs AGGRO 3BET (THINKING)': ['thinking', 'aggressive'],
  'IP vs AGGRO 3BET (WHALE)': ['whale'],
  'CONTINUING vs PASSIVE 4B': ['passive', 'rec'],
  'CONTINUING vs AGGRO 4B': ['aggressive', 'thinking', 'whale'],
  'EP VS PRO OPEN': ['pro'],
  'BTN VS CO PRO OPEN': ['pro'],
};
const fits = (chart, type) => !FITS[chart] || FITS[chart].includes(type);

// 8-handed seat -> chart position
export const CHART_POS = { 'UTG': 'EP', 'UTG+1': 'EP', 'LJ': 'MP', 'HJ': 'HJ', 'CO': 'CO', 'BTN': 'BTN', 'SB': 'SB', 'BB': 'BB' };

export const SPOT_LABELS = {
  RFI: 'Folded to you (RFI)',
  ISO: 'Limpers ahead (ISO)',
  BB_LIMP: 'BB vs limpers',
  VS_OPEN: 'Facing an open',
  SQZ: 'Squeeze spot',
  COLD4B: 'Facing open + 3-bet',
  VS_3BET: 'You opened, facing 3-bet',
  VS_4BET: 'You 3-bet, facing 4-bet',
  NONE: 'No chart',
};

// Every chart name this file asks for, so Brain status can flag one the CSV renamed or dropped.
export const CHARTS_USED = [
  'EP VS PRO OPEN',
  'BTN VS CO PRO OPEN',
  'BB vs AGGRO OPEN',
  'BB vs PASSIVE OPEN',
  'BTN ISO vs CO LIMP',
  'BTN SQZ vs MP OPEN & COLD CALL',
  'BTN vs EP OPEN (LOOSE PLAYER)',
  'BTN vs EP OPEN (TIGHT PLAYER)',
  'COLD 4B vs TIGHT 3B',
  'COLD 4B vs WIDE 3B',
  'CONTINUING vs AGGRO 4B',
  'CONTINUING vs PASSIVE 4B',
  'HJ vs EP OPEN (ABC PLAYER)',
  'IP vs AGGRO 3BET (THINKING)',
  'IP vs AGGRO 3BET (WHALE)',
  'IP vs PASSIVE 3BET',
  'MP ISO vs EP LIMP',
  'OOP vs AGGRO 3BET',
  'OOP vs PASSIVE 3BET',
  'RFI - BTN - 200BB',
  'RFI - BTN - 200BB (vs two fish in blinds)',
  'RFI - EP - 200BB',
  'RFI - HJ - 200BB',
  'SB SQZ vs MP OPEN & COLD CALL',
  ...Object.values(OUTSIDE_SOURCE.openBrackets).flatMap((b) => [b.floor, b.ceiling]),
];

const fam = (type) => (type === 'passive' || type === 'rec' || type === 'tight' ? 'passive' : type);
const isFish = (type) => type === 'whale' || type === 'rec';
const acts = (s) => s.log.filter((e) => e.street === 'preflop' && e.type !== 'post' && e.type !== 'uncalled');
const isIP = (a, b) => POSTFLOP_ORDER.indexOf(a) > POSTFLOP_ORDER.indexOf(b); // a acts after b postflop

export function classifySpot(s, heroIdx) {
  const hero = s.players[heroIdx];
  const hp = CHART_POS[hero.pos];
  const pre = acts(s);
  const mine = pre.filter((e) => e.i === heroIdx);
  const raises = pre.filter((e) => e.type === 'raise');
  const level = s.raiseLevel;
  const P = (i) => s.players[i];
  const spot = (kind, chart, exact, extra = {}) => ({ kind, chart, exact, label: SPOT_LABELS[kind], ...extra });
  // Same, but the chart is only exact when it was drawn for this villain's type.
  const vspot = (kind, chart, exact, vType, extra = {}) => spot(kind, chart, exact && fits(chart, vType), extra);

  if (mine.length === 0) {
    if (level === 1) {
      const limpers = pre.filter((e) => e.type === 'call').map((e) => e.i);
      if (!limpers.length) {
        if (hp === 'EP') return spot('RFI', 'RFI - EP - 200BB', true);
        if (hp === 'HJ') return spot('RFI', 'RFI - HJ - 200BB', true);
        if (hero.pos === 'LJ') {
          // Closer to 100bb than to 200bb: the 100bb LJ chart (under 150bb effective).
          const eff = openEffectiveBB(s, heroIdx);
          if (eff < 150 && compiledChart(LJ_CHART_100)) return spot('RFI', LJ_CHART_100, true, { effBB: Math.round(eff) });
          if (compiledChart(LJ_CHART)) return spot('RFI', LJ_CHART, true, { effBB: Math.round(eff) });
        }
        if (hp === 'BTN') {
          const fish = isFish(P(6).type) && isFish(P(7).type);
          return spot('RFI', fish ? 'RFI - BTN - 200BB (vs two fish in blinds)' : 'RFI - BTN - 200BB', true);
        }
        // No HHP open chart for MP, CO or SB: graded [OUTSIDE SOURCE] against a bracket of two
        // HHP charts. Hands are dealt from the looser (ceiling) chart.
        const bracket = OUTSIDE_SOURCE.openBrackets[hp];
        if (bracket) return spot('RFI', bracket.ceiling, false, { bracket, seat: hero.pos });
        return spot('NONE', null, false);
      }
      const lp = limpers.map((i) => CHART_POS[P(i).pos]);
      const extra = { limpers: limpers.length, limperIdx: limpers };
      if (hp === 'BB') return spot('BB_LIMP', 'MP ISO vs EP LIMP', false, extra);
      if (hp === 'CO' || hp === 'BTN') {
        const exact = hp === 'BTN' && limpers.length === 1 && lp[0] === 'CO';
        return spot('ISO', 'BTN ISO vs CO LIMP', exact, extra);
      }
      const exact = hp === 'MP' && lp.every((x) => x === 'EP');
      return spot('ISO', 'MP ISO vs EP LIMP', exact, extra);
    }
    if (level === 2) {
      const opener = raises[0].i;
      const callers = pre.filter((e) => e.type === 'call' && e.level === 2).map((e) => e.i);
      const op = CHART_POS[P(opener).pos];
      const extra = { opener, openerType: P(opener).type, callers: callers.length };
      if (callers.length) {
        if (hp === 'SB' || hp === 'BB') return spot('SQZ', 'SB SQZ vs MP OPEN & COLD CALL', hp === 'SB' && op === 'MP', extra);
        return spot('SQZ', 'BTN SQZ vs MP OPEN & COLD CALL', hp === 'BTN' && op === 'MP', extra);
      }
      const f = fam(P(opener).type);
      const vt = P(opener).type;
      // A pro opens: the 2024 PRO charts (ACTIVE, no 2026 equivalent). Exact only for the seats
      // they were drawn for (EP vs an EP pro, BTN vs a CO pro).
      if (vt === 'pro' && hp !== 'BB' && hp !== 'SB') {
        if (hp === 'CO' || hp === 'BTN') return vspot('VS_OPEN', 'BTN VS CO PRO OPEN', hp === 'BTN' && P(opener).pos === 'CO', vt, extra);
        return vspot('VS_OPEN', 'EP VS PRO OPEN', hp === 'EP' && op === 'EP', vt, extra);
      }
      if (hp === 'BB' || hp === 'SB') {
        return vspot('VS_OPEN', f === 'passive' ? 'BB vs PASSIVE OPEN' : 'BB vs AGGRO OPEN', hp === 'BB', vt, extra);
      }
      if (hp === 'CO' || hp === 'BTN') {
        return vspot('VS_OPEN', f === 'passive' ? 'BTN vs EP OPEN (TIGHT PLAYER)' : 'BTN vs EP OPEN (LOOSE PLAYER)',
          hp === 'BTN' && op === 'EP', vt, extra);
      }
      return vspot('VS_OPEN', 'HJ vs EP OPEN (ABC PLAYER)', hp === 'HJ' && op === 'EP', vt, extra);
    }
    if (level === 3) {
      const tb = raises[raises.length - 1].i;
      const f = fam(P(tb).type);
      return vspot('COLD4B', f === 'passive' ? 'COLD 4B vs TIGHT 3B' : 'COLD 4B vs WIDE 3B', true, P(tb).type,
        { threeBettor: tb, opener: raises[0].i });
    }
    return spot('NONE', null, false, { reason: 'Facing a 4-bet cold: no HHP chart.' });
  }

  // Hero has already acted this hand.
  const heroRaises = mine.filter((e) => e.type === 'raise');
  const lastHeroRaise = heroRaises[heroRaises.length - 1];
  const lastRaise = raises[raises.length - 1];
  if (lastHeroRaise && lastRaise && lastRaise.i !== heroIdx) {
    const heroLevelAfter = lastHeroRaise.level + 1; // level after hero's raise
    const v = lastRaise.i;
    const f = fam(P(v).type);
    if (heroLevelAfter === 2 && level === 3) {
      const ip = isIP(heroIdx, v);
      const extra = { threeBettor: v, heroIP: ip };
      const vt = P(v).type;
      if (ip) {
        if (f === 'passive') return vspot('VS_3BET', 'IP vs PASSIVE 3BET', true, vt, extra);
        if (f === 'whale') return vspot('VS_3BET', 'IP vs AGGRO 3BET (WHALE)', true, vt, extra);
        return vspot('VS_3BET', 'IP vs AGGRO 3BET (THINKING)', true, vt, extra);
      }
      if (f === 'passive') return vspot('VS_3BET', 'OOP vs PASSIVE 3BET', true, vt, extra);
      return vspot('VS_3BET', 'OOP vs AGGRO 3BET', true, vt, extra);
    }
    if (heroLevelAfter === 3 && level === 4) {
      return vspot('VS_4BET', f === 'passive' ? 'CONTINUING vs PASSIVE 4B' : 'CONTINUING vs AGGRO 4B', true, P(v).type, { fourBettor: v });
    }
    return spot('NONE', null, false, { reason: 'No HHP chart past the 4-bet.' });
  }
  // Hero checked the BB behind limpers and now faces a raise: closest is the BB vs open chart.
  if (hero.pos === 'BB' && mine.every((e) => e.type === 'check') && level === 2) {
    const opener = raises[0].i;
    const f = fam(P(opener).type);
    return spot('VS_OPEN', f === 'passive' ? 'BB vs PASSIVE OPEN' : 'BB vs AGGRO OPEN', false,
      { opener, openerType: P(opener).type, callers: 0 });
  }
  return spot('NONE', null, false, { reason: 'You limped or flatted and now face a raise: no HHP chart for this line.' });
}
