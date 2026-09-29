// Bet-sizing helpers for the action bar: quick buttons and the slider scale.
// UI-only: every amount still goes through the engine's validateRaise before it's applied.
import { potTotal } from '../engine/game.js';

export const clampTo = (la, to) => Math.max(la.minTo, Math.min(la.maxTo, Math.round(to)));

// Quick buttons for the current decision: [{ top, to, allIn }]
//  - preflop, no raise yet (open / iso): 5x, 7.5x, 10x the big blind ($10 / $15 / $20 at $1/2)
//  - facing a bet or raise: 3x, 4x, 5x the bet
//  - postflop, no bet yet: 33%, 50%, 75%, pot, all-in
export function quickSizes(s, la) {
  if (!la || !la.canRaise) return [];
  const bb = s.stakes.bb;
  let raw;
  if (s.street === 'preflop' && s.raiseLevel === 1) {
    raw = [[5, 5 * bb], [7.5, Math.ceil(7.5 * bb)], [10, 10 * bb]].map(([m, v]) => [`${m}x`, v]);
  } else if (s.currentBet > 0) {
    raw = [3, 4, 5].map((m) => [`${m}x`, s.currentBet * m]);
  } else {
    const pot = potTotal(s);
    raw = [['33%', pot * 0.33], ['50%', pot * 0.5], ['75%', pot * 0.75], ['Pot', pot], ['All-in', la.maxTo]];
  }
  const out = [];
  const seen = new Set();
  for (const [top, v] of raw) {
    const to = clampTo(la, v);
    if (seen.has(to)) continue;
    seen.add(to);
    out.push({ top, to, allIn: to === la.maxTo });
  }
  return out;
}

// Slider position (0..SLIDER_MAX) <-> dollars. Squared curve: finer control for small bets.
export const SLIDER_MAX = 1000;
export function sliderToAmount(la, pos) {
  if (la.maxTo <= la.minTo) return la.maxTo;
  const f = Math.max(0, Math.min(1, pos / SLIDER_MAX));
  return clampTo(la, la.minTo + (la.maxTo - la.minTo) * f * f);
}
export function amountToSlider(la, to) {
  if (la.maxTo <= la.minTo) return SLIDER_MAX;
  const f = (clampTo(la, to) - la.minTo) / (la.maxTo - la.minTo);
  return Math.round(Math.sqrt(f) * SLIDER_MAX);
}

// Amount as % of the current pot (including bets already in front of players).
export const potPercent = (s, to) => Math.round((to / Math.max(1, potTotal(s))) * 100);
