// Villain decision-making: sample one action from the villain's policy (policy.js), which is
// built from the brain (brain-compiled/behavior.json). The chosen option's label is kept on
// the log entry so the range tracker can replay the hand.
import { rand } from './cards.js';
import { legalActions, applyAction } from './game.js';
import { villainPolicy, roundBet, finalizeTo } from './policy.js';

export { roundBet };

function sample(opts) {
  let r = rand();
  for (const o of opts) { if ((r -= o.p) < 0) return o; }
  return opts[opts.length - 1];
}

export function chooseAction(s, i) {
  const p = s.players[i];
  const la = legalActions(s);
  // 3-bet drill: a planted 3-bettor 3-bets with the hand he was dealt from his 3-bet range.
  if (s.street === 'preflop' && s.raiseLevel === 2 && p.meta.force3bet && la.canRaise) {
    const ip = s.lastAggressor >= 0 && !['SB', 'BB'].includes(p.pos) && p.i > s.lastAggressor;
    return { type: 'raise', to: finalizeTo(s, la, s.currentBet * (ip ? 3 : 4)), meta: { label: 'raise' } };
  }
  const o = sample(villainPolicy(s, i, p.cards));
  const act = { ...o.act, meta: { label: o.label } };
  if (o.pickTo) act.to = o.pickTo();
  return act;
}

// Pick and apply one villain action. Falls back safely if a choice is illegal.
export function villainAct(s) {
  const i = s.toAct;
  let act = chooseAction(s, i);
  try {
    return applyAction(s, act);
  } catch {
    const la = legalActions(s);
    act = la.canCheck ? { type: 'check', meta: { label: 'check' } } : la.canCall ? { type: 'call', meta: { label: 'call' } } : { type: 'fold', meta: { label: 'fold' } };
    return applyAction(s, act);
  }
}
