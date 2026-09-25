// Quick simulation report: node tests/sim.mjs [hands] [drill]
import { ranges } from './setup.mjs';
import { createHand, heroAct, villainAct, DRILLS } from '../js/engine/dealer.js';
import { legalActions, dealNextStreet, potTotal } from '../js/engine/game.js';
import { rand } from '../js/engine/cards.js';

export function heroRandomPolicy(s) {
  const la = legalActions(s);
  const r = rand();
  if (la.canRaise && r < 0.3) {
    const to = Math.min(la.maxTo, Math.max(la.minTo, Math.round(s.currentBet * 3 || potTotal(s) * 0.6)));
    return { type: la.isBet ? 'bet' : 'raise', to };
  }
  if (la.canCheck) return { type: 'check' };
  if (r < 0.75) return { type: 'call' };
  return { type: 'fold' };
}

export function playOut(s, policy = heroRandomPolicy) {
  let guard = 0;
  while (!s.done) {
    if (++guard > 500) throw new Error('hand did not terminate');
    if (s.awaitingDeal) { dealNextStreet(s); continue; }
    if (s.toAct === s.heroIdx) heroAct(s, policy(s), ranges);
    else villainAct(s);
  }
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = Number(process.argv[2] || 500);
  const drills = process.argv[3] ? [process.argv[3]] : Object.keys(DRILLS);
  for (const drill of drills) {
    const stats = { attempts: 0, spots: {}, flopPlayers: {}, river: 0, threebet: 0, t: Date.now(), verdicts: {} };
    for (let n = 0; n < N; n++) {
      const s = createHand({ drill, ranges });
      stats.attempts += s.attempts;
      stats.spots[s.spot.kind] = (stats.spots[s.spot.kind] || 0) + 1;
      const before = s.players.reduce((a, p) => a + p.startStack, 0);
      playOut(s);
      const after = s.players.reduce((a, p) => a + p.stack, 0);
      if (before !== after) throw new Error(`chip leak ${before} -> ${after}`);
      if (s.players.some((p) => p.stack < 0)) throw new Error('negative stack');
      const flopEntry = s.log.find((e) => e.type === 'deal' && e.street === 'flop');
      if (flopEntry) {
        const idx = s.log.indexOf(flopEntry);
        const folded = new Set(s.log.slice(0, idx).filter((e) => e.type === 'fold').map((e) => e.i));
        const k = 8 - folded.size;
        stats.flopPlayers[k] = (stats.flopPlayers[k] || 0) + 1;
      }
      if (s.log.some((e) => e.street === 'river')) stats.river++;
      if (s.log.some((e) => e.street === 'preflop' && e.type === 'raise' && e.level === 2)) stats.threebet++;
      for (const d of s.heroDecisions) stats.verdicts[d.verdict] = (stats.verdicts[d.verdict] || 0) + 1;
    }
    console.log(drill, JSON.stringify({ avgAttempts: (stats.attempts / N).toFixed(1), ms: Date.now() - stats.t,
      spots: stats.spots, flopPlayers: stats.flopPlayers, riverPct: (stats.river / N * 100).toFixed(0),
      threebetPct: (stats.threebet / N * 100).toFixed(0), verdicts: stats.verdicts }));
  }
}
