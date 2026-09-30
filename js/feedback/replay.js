// Saved hands keep what's needed to rebuild them for the full feedback screen later: the deal,
// the action log, your graded preflop decisions and your reads (the last 50 hands only).
import { createGame, applyAction, dealNextStreet } from '../engine/game.js';

export function packReplay(s) {
  const strip = (d) => { const { entry, ...rest } = d; return rest; };
  return {
    initial: s.initial,
    log: s.log.map((e) => ({ type: e.type, i: e.i, to: e.to, meta: e.meta })),
    heroIdx: s.heroIdx, drill: s.drill, spot: s.spot, heroCode: s.heroCode,
    heroDecisions: (s.heroDecisions || []).map(strip),
  };
}

// predictions: the saved summaries (grade, blocks, answers, questions, shares).
export function rebuildHand(rep, predictions = {}) {
  const init = rep.initial;
  const s = createGame({ stakes: init.stakes, players: init.players.map((p) => ({ ...p, cards: [...p.cards], meta: { ...p.meta } })), runout: [...init.runout] });
  Object.assign(s, { heroIdx: rep.heroIdx, drill: rep.drill, spot: rep.spot, heroCode: rep.heroCode, initial: init, heroDecisions: rep.heroDecisions || [] });
  for (const e of rep.log) {
    if (e.type === 'post' || e.type === 'uncalled') continue;
    if (e.type === 'deal') { dealNextStreet(s); continue; }
    applyAction(s, { type: e.type, to: e.to, meta: e.meta });
  }
  s.predictions = Object.fromEntries(Object.entries(predictions).map(([k, p]) => [k, { ...p, street: k, truth: p.shares ? { shares: p.shares } : null }]));
  return s;
}
