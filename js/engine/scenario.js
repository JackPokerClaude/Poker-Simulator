// Classify hero's preflop spot and map it to the closest HHP chart.
import { POSTFLOP_ORDER } from './game.js';

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

const fam = (type) => (type === 'passive' || type === 'rec' ? 'passive' : type);
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

  if (mine.length === 0) {
    if (level === 1) {
      const limpers = pre.filter((e) => e.type === 'call').map((e) => e.i);
      if (!limpers.length) {
        if (hp === 'EP') return spot('RFI', 'RFI - EP - 200BB', true);
        if (hp === 'MP') return spot('RFI', 'RFI - EP - 200BB', false);
        if (hp === 'HJ') return spot('RFI', 'RFI - HJ - 200BB', true);
        if (hp === 'CO') return spot('RFI', 'RFI - HJ - 200BB', false);
        if (hp === 'BTN') {
          const fish = isFish(P(6).type) && isFish(P(7).type);
          return spot('RFI', fish ? 'RFI - BTN - 200BB (vs two fish in blinds)' : 'RFI - BTN - 200BB', true);
        }
        if (hp === 'SB') return spot('RFI', 'RFI - BTN - 200BB', false);
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
      if (hp === 'BB' || hp === 'SB') {
        return spot('VS_OPEN', f === 'passive' ? 'BB vs PASSIVE OPEN' : 'BB vs AGGRO OPEN', hp === 'BB', extra);
      }
      if (hp === 'CO' || hp === 'BTN') {
        return spot('VS_OPEN', f === 'passive' ? 'BTN vs EP OPEN (TIGHT PLAYER)' : 'BTN vs EP OPEN (LOOSE PLAYER)',
          hp === 'BTN' && op === 'EP', extra);
      }
      return spot('VS_OPEN', 'HJ vs EP OPEN (ABC PLAYER)', hp === 'HJ' && op === 'EP', extra);
    }
    if (level === 3) {
      const tb = raises[raises.length - 1].i;
      const f = fam(P(tb).type);
      return spot('COLD4B', f === 'passive' ? 'COLD 4B vs TIGHT 3B' : 'COLD 4B vs WIDE 3B', true,
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
      if (ip) {
        if (f === 'passive') return spot('VS_3BET', 'IP vs PASSIVE 3BET', true, extra);
        if (f === 'whale') return spot('VS_3BET', 'IP vs AGGRO 3BET (WHALE)', true, extra);
        return spot('VS_3BET', 'IP vs AGGRO 3BET (THINKING)', f === 'thinking', extra);
      }
      if (f === 'passive') return spot('VS_3BET', 'OOP vs PASSIVE 3BET', true, extra);
      return spot('VS_3BET', 'OOP vs AGGRO 3BET', f !== 'whale', extra);
    }
    if (heroLevelAfter === 3 && level === 4) {
      return spot('VS_4BET', f === 'passive' ? 'CONTINUING vs PASSIVE 4B' : 'CONTINUING vs AGGRO 4B', true, { fourBettor: v });
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
