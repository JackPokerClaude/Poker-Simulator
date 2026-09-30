// Spot features for matching brain rules: board texture, pot type, who's in position, what the
// villain just did, your hand's bucket. Thresholds here are [OUTSIDE SOURCE] defaults.
import { rankOf, suitOf } from '../engine/cards.js';
import { POSTFLOP_ORDER, potTotal, activePlayers, legalActions } from '../engine/game.js';
import { features, boardTable } from '../engine/strength.js';
import { classify, GROUP_OF } from '../range/classes.js';

export function boardTexture(board) {
  if (!board.length) return {};
  const ranks = board.map(rankOf).sort((a, b) => b - a);
  const suits = board.map(suitOf);
  const maxSuit = Math.max(...[0, 1, 2, 3].map((s) => suits.filter((x) => x === s).length));
  const paired = new Set(ranks).size < ranks.length;
  const uniq = [...new Set(ranks)].sort((a, b) => a - b);
  let connected = 0; // how many cards sit within a straight window of 5
  for (let lo = -1; lo <= 8; lo++) connected = Math.max(connected, uniq.filter((r) => (r >= lo && r <= lo + 4) || (lo === -1 && r === 12)).length);
  const monotone = maxSuit >= 3;
  const twoTone = maxSuit === 2;
  // Wet = draws are easy: a flush draw with connected cards, three to a straight, or three to a flush.
  const wet = (maxSuit >= 2 && connected >= 2) || connected >= 3 || maxSuit >= 3;
  return { aceHigh: ranks[0] === 12, paired, monotone, fourFlush: maxSuit >= 4, twoTone, wet, dry: !wet, connected, high: ranks[0] };
}

// The preflop pot type: srp (one raise), 3bet, 4bet.
export function potType(h) {
  const raises = h.log.filter((e) => e.street === 'preflop' && e.type === 'raise').length;
  return raises >= 3 ? '4bet' : raises === 2 ? '3bet' : 'srp';
}

const EARLY = new Set(['UTG', 'UTG+1', 'LJ', 'HJ']);

// What villain vi did most recently on this street (for "he checked", "he donked"...).
function villainAction(h, vi) {
  const es = h.log.filter((e) => e.street === h.street && e.i === vi && !['post', 'deal', 'uncalled'].includes(e.type));
  const e = es[es.length - 1];
  if (!e) return null;
  if (h.street === 'preflop') {
    if (e.meta?.label === 'raise-big') return 'raise-big';
    const limped = h.log.some((x) => x.street === 'preflop' && x.i === vi && x.type === 'call' && x.level === 1);
    if (e.type === 'raise' && limped) return 'limp-reraise';
    return e.type === 'call' && e.level === 1 ? 'limp' : e.type;
  }
  if (e.type === 'bet') {
    const donk = h.preflopAggressor !== vi && h.preflopAggressor >= 0 && POSTFLOP_ORDER.indexOf(vi) < POSTFLOP_ORDER.indexOf(h.preflopAggressor)
      && !h.log.some((x) => x.street === h.street && x.i === h.preflopAggressor && x.type === 'check' && h.log.indexOf(x) < h.log.indexOf(e));
    if (donk) return 'donk';
    return e.meta?.label === 'bet-big' || e.to >= 0.5 * (e.potBefore || 1) ? 'bet-big' : 'bet-small';
  }
  return e.type;
}

export function betSizeClass(amount, potBefore) {
  const r = amount / Math.max(1, potBefore);
  return r <= 0.45 ? 'small' : r < 0.66 ? 'inbetween' : 'big';
}

// Everything the matcher can ask about, at your decision in state s vs villain vi.
export function spotFeatures(s, heroIdx, vi, extra = {}) {
  const hero = s.players[heroIdx];
  const v = vi != null ? s.players[vi] : null;
  const la = legalActions(s);
  const street = s.street;
  const pot = potTotal(s);
  const tex = boardTexture(s.board);
  const f = street !== 'preflop' ? features(hero.cards, s.board, boardTable(s.board)) : null;
  const eff = Math.min(hero.stack + hero.committed, ...(v ? [v.stack + v.committed] : []));
  const facingBet = la ? la.toCall > 0 : false;
  const lastBet = facingBet ? [...s.log].reverse().find((e) => e.street === street && (e.type === 'bet' || e.type === 'raise')) : null;
  const riverPairs = street === 'river' && s.board.slice(0, 4).map(rankOf).includes(rankOf(s.board[4]));
  const turnCheckedThrough = street === 'river' && !s.log.some((e) => e.street === 'turn' && (e.type === 'bet' || e.type === 'raise'));
  const flopCheckedThrough = (street === 'turn' || street === 'river') && !s.log.some((e) => e.street === 'flop' && (e.type === 'bet' || e.type === 'raise'));
  const aggressed = (st) => vi != null && s.log.some((e) => e.street === st && e.i === vi && (e.type === 'bet' || e.type === 'raise'));
  const villainDoubleBarreled = street === 'river' && aggressed('flop') && aggressed('turn');
  const opener = s.log.find((e) => e.street === 'preflop' && e.type === 'raise');
  const threeBettor = s.log.filter((e) => e.street === 'preflop' && e.type === 'raise')[1];
  return {
    street,
    facing: facingBet,
    facingLevel: street === 'preflop' ? s.raiseLevel : null,
    heroClass: f ? classify(hero.cards, s.board, street) : null,
    heroBucket: f ? GROUP_OF[classify(hero.cards, s.board, street)] : null,
    heroFeatures: f,
    heroPos: hero.pos,
    villainPos: v?.pos || null,
    villainType: v?.type || null,
    villainStyle: v?.style || null,
    villainPFR: v ? s.preflopAggressor === vi : false,
    heroPFR: s.preflopAggressor === heroIdx,
    heroIP: v ? POSTFLOP_ORDER.indexOf(heroIdx) > POSTFLOP_ORDER.indexOf(vi) : null,
    multiway: activePlayers(s).length > 2,
    board: tex,
    potType: potType(s),
    tightConfig: !!(opener && threeBettor && EARLY.has(s.players[opener.i].pos) && EARLY.has(s.players[threeBettor.i].pos)),
    villainAction: v ? villainAction(s, vi) : null,
    betSize: lastBet ? betSizeClass(lastBet.to, lastBet.potBefore) : null,
    deep: eff / s.stakes.bb >= 300,
    spr: pot ? (eff - hero.committed) / pot : null,
    riverPairs,
    turnCheckedThrough,
    flopCheckedThrough,
    villainDoubleBarreled,
    pot,
    ...extra,
  };
}
