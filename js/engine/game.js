// No-limit hold'em betting engine: legal actions, min-raise / short all-in rules,
// uncalled bets, side pots, and payouts. Pure state, no DOM.
import { resolveShowdown } from './showdown.js';

export const POSITIONS = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const PREFLOP_ORDER = [0, 1, 2, 3, 4, 5, 6, 7];
export const POSTFLOP_ORDER = [6, 7, 0, 1, 2, 3, 4, 5];
export const STREETS = ['preflop', 'flop', 'turn', 'river'];

export const potTotal = (s) => s.players.reduce((a, p) => a + p.total, 0);
export const activePlayers = (s) => s.players.filter((p) => !p.folded);
export const canStillAct = (p) => !p.folded && !p.allIn;
const orderFor = (street) => (street === 'preflop' ? PREFLOP_ORDER : POSTFLOP_ORDER);

export function createGame({ stakes, players, runout }) {
  const s = {
    stakes,
    players: players.map((p, i) => ({
      i, pos: POSITIONS[i], stack: p.stack, startStack: p.stack, committed: 0, total: 0,
      folded: false, allIn: false, acted: false, canRaise: true,
      cards: p.cards, isHero: !!p.isHero, type: p.type || null, reads: p.reads || [], meta: p.meta || {},
    })),
    street: 'preflop',
    board: [],
    runout,
    currentBet: 0,
    minRaise: stakes.bb,
    raiseLevel: 0, // preflop: 1 = blinds only, 2 = open, 3 = 3-bet ...; postflop: 0 = no bet, 1 = bet ...
    toAct: -1,
    log: [],
    streetPots: {},
    preflopAggressor: -1,
    lastAggressor: -1,
    awaitingDeal: false,
    done: false,
    result: null,
  };
  post(s, 6, stakes.sb);
  post(s, 7, stakes.bb);
  s.currentBet = stakes.bb;
  s.raiseLevel = 1;
  s.toAct = nextToAct(s, 7);
  return s;
}

function post(s, i, amt) {
  const p = s.players[i];
  const a = Math.min(amt, p.stack);
  p.stack -= a; p.committed += a; p.total += a;
  if (p.stack === 0) p.allIn = true;
  s.log.push({ street: 'preflop', i, pos: p.pos, type: 'post', to: p.committed, added: a, pot: potTotal(s) });
}

function nextToAct(s, fromIdx) {
  const order = orderFor(s.street);
  const start = order.indexOf(fromIdx);
  for (let k = 1; k <= order.length; k++) {
    const p = s.players[order[(start + k) % order.length]];
    if (canStillAct(p) && (!p.acted || p.committed < s.currentBet)) return p.i;
  }
  return -1;
}

export function legalActions(s) {
  const p = s.players[s.toAct];
  if (!p || s.done || s.awaitingDeal) return null;
  const toCall = Math.min(s.currentBet - p.committed, p.stack);
  const maxTo = p.committed + p.stack;
  const othersCanAct = s.players.some((q) => q !== p && canStillAct(q));
  const facingBet = s.currentBet > p.committed;
  let minTo = s.currentBet === 0 ? s.stakes.bb : s.currentBet + s.minRaise;
  const canRaise = p.canRaise && maxTo > s.currentBet && othersCanAct;
  if (minTo > maxTo) minTo = maxTo; // only an all-in is possible
  return {
    player: p,
    canFold: facingBet,
    canCheck: !facingBet,
    canCall: facingBet,
    toCall,
    callIsAllIn: toCall === p.stack && facingBet,
    canRaise,
    isBet: s.currentBet === 0,
    minTo,
    maxTo,
    potIfCall: potTotal(s) + (facingBet ? toCall : 0),
  };
}

// Validate a bet/raise "to" amount without applying it. Returns an error string or null.
export function validateRaise(s, to) {
  const la = legalActions(s);
  if (!la) return 'Not your turn.';
  if (!la.canRaise) return la.player.canRaise ? 'No one left to raise against.' : 'You can only call or fold (short all-in did not reopen the action).';
  if (!Number.isFinite(to) || Math.round(to) !== to) return 'Enter a whole-dollar amount.';
  if (to > la.maxTo) return `You only have $${la.maxTo} total ($${la.player.stack} behind).`;
  if (to < la.minTo && to !== la.maxTo) {
    return la.isBet ? `Minimum bet is $${la.minTo}.` : `Minimum raise is to $${la.minTo}.`;
  }
  return null;
}

export function applyAction(s, action) {
  const la = legalActions(s);
  if (!la) throw new Error('No action expected.');
  const p = la.player;
  const pre = potTotal(s);
  const entry = { street: s.street, i: p.i, pos: p.pos, type: action.type, potBefore: pre, level: s.raiseLevel };
  switch (action.type) {
    case 'fold':
      if (!la.canFold) throw new Error('Nothing to fold to. Check instead.');
      p.folded = true;
      break;
    case 'check':
      if (!la.canCheck) throw new Error(`You must call $${la.toCall}, raise, or fold.`);
      break;
    case 'call': {
      if (!la.canCall) throw new Error('Nothing to call. Check instead.');
      const add = la.toCall;
      p.stack -= add; p.committed += add; p.total += add;
      if (p.stack === 0) p.allIn = true;
      entry.added = add;
      break;
    }
    case 'bet':
    case 'raise': {
      const to = action.to;
      const err = validateRaise(s, to);
      if (err) throw new Error(err);
      const add = to - p.committed;
      const inc = to - s.currentBet;
      const full = inc >= s.minRaise;
      p.stack -= add; p.committed = to; p.total += add;
      if (p.stack === 0) p.allIn = true;
      entry.type = s.currentBet === 0 ? 'bet' : 'raise';
      entry.added = add;
      for (const q of s.players) {
        if (q === p || !canStillAct(q)) continue;
        if (full) { q.acted = false; q.canRaise = true; }
        else if (q.acted) { q.acted = false; q.canRaise = false; }
      }
      if (full) s.minRaise = Math.max(inc, s.stakes.bb);
      s.currentBet = to;
      s.raiseLevel++;
      s.lastAggressor = p.i;
      if (s.street === 'preflop') s.preflopAggressor = p.i;
      break;
    }
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
  p.acted = true;
  entry.to = p.committed;
  entry.allIn = p.allIn;
  entry.pot = potTotal(s);
  if (action.meta) entry.meta = action.meta;
  s.log.push(entry);
  afterAction(s, p.i);
  return entry;
}

function afterAction(s, lastIdx) {
  const live = activePlayers(s);
  if (live.length === 1) {
    returnUncalled(s);
    finish(s);
    return;
  }
  const nxt = nextToAct(s, lastIdx);
  if (nxt >= 0) { s.toAct = nxt; return; }
  // Betting round complete.
  returnUncalled(s);
  s.toAct = -1;
  if (s.street === 'river') { finish(s); return; }
  s.awaitingDeal = true;
}

function returnUncalled(s) {
  const sorted = [...s.players].sort((a, b) => b.committed - a.committed);
  const [top, second] = sorted;
  const excess = top.committed - (second ? second.committed : 0);
  if (excess > 0) {
    top.committed -= excess; top.total -= excess; top.stack += excess;
    if (top.stack > 0) top.allIn = false;
    s.log.push({ street: s.street, i: top.i, pos: top.pos, type: 'uncalled', added: -excess, pot: potTotal(s) });
  }
}

// True when no more betting can happen (everyone left is all-in, or only one player can act).
export const isRunout = (s) => activePlayers(s).filter((p) => !p.allIn).length <= 1;

export function dealNextStreet(s) {
  if (!s.awaitingDeal) throw new Error('Not time to deal.');
  const idx = STREETS.indexOf(s.street) + 1;
  s.street = STREETS[idx];
  s.board = s.runout.slice(0, idx === 1 ? 3 : idx === 2 ? 4 : 5);
  s.streetPots[s.street] = potTotal(s);
  for (const p of s.players) { p.committed = 0; p.acted = false; p.canRaise = true; }
  s.currentBet = 0;
  s.minRaise = s.stakes.bb;
  s.raiseLevel = 0;
  s.awaitingDeal = false;
  s.log.push({ street: s.street, type: 'deal', board: [...s.board], pot: potTotal(s) });
  if (isRunout(s)) {
    if (s.street === 'river') finish(s);
    else s.awaitingDeal = true;
    return;
  }
  s.toAct = nextToAct(s, 5); // first live player left of the button
  if (s.toAct < 0) { if (s.street === 'river') finish(s); else s.awaitingDeal = true; }
}

// Split contributions into main + side pots.
export function buildPots(players) {
  const live = players.filter((p) => !p.folded && p.total > 0);
  const levels = [...new Set(live.map((p) => p.total))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const lvl of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.total, lvl) - prev);
    const eligible = live.filter((p) => p.total >= lvl).map((p) => p.i);
    if (amount > 0) pots.push({ amount, eligible });
    prev = lvl;
  }
  // Dead money above the top live level (can't happen after uncalled returns, but be safe).
  const extra = players.reduce((a, p) => a + Math.max(0, p.total - prev), 0);
  if (extra > 0 && pots.length) pots[pots.length - 1].amount += extra;
  return pots;
}

function finish(s) {
  s.toAct = -1;
  s.awaitingDeal = false;
  s.done = true;
  const live = activePlayers(s);
  const pots = buildPots(s.players);
  const won = Object.fromEntries(s.players.map((p) => [p.i, 0]));
  let showdown = null;
  if (live.length === 1) {
    won[live[0].i] = pots.reduce((a, p) => a + p.amount, 0);
  } else {
    const board = s.runout.slice(0, 5);
    s.board = board;
    const all = resolveShowdown(live.map((p) => ({ id: p.i, cards: p.cards })), board);
    showdown = { hands: all.byId, pots: [] };
    for (const pot of pots) {
      const res = pot.eligible.length === 1
        ? { winners: pot.eligible }
        : resolveShowdown(pot.eligible.map((i) => ({ id: i, cards: s.players[i].cards })), board);
      const winners = POSTFLOP_ORDER.filter((i) => res.winners.includes(i));
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      for (const w of winners) { won[w] += share + (odd > 0 ? 1 : 0); if (odd > 0) odd--; }
      showdown.pots.push({ amount: pot.amount, eligible: pot.eligible, winners });
    }
  }
  for (const p of s.players) p.stack += won[p.i];
  s.result = {
    won,
    pots,
    showdown,
    net: Object.fromEntries(s.players.map((p) => [p.i, p.stack - p.startStack])),
    finalPot: pots.reduce((a, p) => a + p.amount, 0),
  };
}
