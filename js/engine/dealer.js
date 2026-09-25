// Builds a realistic live hand up to hero's first decision, only dealing hero hands
// the HHP chart plays in that spot, and filtered by drill mode.
import { VILLAIN_CONFIG } from '../../config/villains.js';
import { shuffledDeck, handCode, weightedPick, randInt, rand, pick, HAND_PCT, expandRange } from './cards.js';
import { createGame, applyAction, legalActions, POSITIONS } from './game.js';
import { villainAct } from './ai.js';
import { classifySpot } from './scenario.js';
import { chartRow, isPlayable, gradeDecision, checkIsoSize, checkFourBetSize } from '../grading/grade.js';
import { assess } from './strength.js';

export const STAKES = [
  { label: '1/2', sb: 1, bb: 2, weight: 60 },
  { label: '1/3', sb: 1, bb: 3, weight: 25 },
  { label: '2/5', sb: 2, bb: 5, weight: 15 },
];

export const DRILLS = {
  random: { name: 'Random', desc: 'Any spot, natural live mix.', looseness: 1 },
  multiway: { name: 'Multiway pots', desc: 'Two or more players already in before you.', looseness: 1.3 },
  threebet: { name: '3-bet pots', desc: 'You 3-bet, or you open and get 3-bet.', looseness: 1 },
  limpers: { name: 'Vs limpers', desc: 'Limpers ahead: iso, overlimp, or fold.', looseness: 1.1 },
  blinds: { name: 'Blind defense', desc: 'You are in the SB/BB facing an open.', looseness: 1 },
  bigpots: { name: 'Big pots', desc: 'Hands built to reach the river.', looseness: 1.6 },
};

function villainStack(bb) {
  const r = rand();
  const bbs = 80 + 320 * Math.pow(r, 1.7); // 80-400bb, skewed toward ~100-200
  const raw = bbs * bb;
  return rand() < 0.6 ? Math.round(raw / 5) * 5 : Math.round(raw);
}

function makeReads(type) {
  const pool = [...VILLAIN_CONFIG.reads[type]];
  const n = rand() < 0.55 ? 2 : 1;
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    const t = pool.splice(randInt(pool.length), 1)[0];
    out.push(t.replace('{n}', String(2 + randInt(3))));
  }
  return out;
}

function heroSeatFor(drill) {
  if (drill === 'blinds') return pick([6, 7]);
  if (drill === 'limpers') return 2 + randInt(6);
  return randInt(8);
}

function sample3betHand(type, deckSpare) {
  const cfg = VILLAIN_CONFIG.types[type].preflop;
  const set = cfg.threeBet ? expandRange(cfg.threeBet) : null;
  for (let t = 0; t < 400; t++) {
    const a = randInt(deckSpare.length);
    let b = randInt(deckSpare.length);
    if (a === b) continue;
    const code = handCode(deckSpare[a], deckSpare[b]);
    if (set ? set.has(code) : HAND_PCT[code] <= cfg.threeBetPct / 100) return [a, b];
  }
  return null;
}

function drillAccepts(drill, s, spot, row, heroIdx, bucket) {
  const pre = s.log.filter((e) => e.street === 'preflop' && e.type !== 'post');
  const inBefore = new Set(pre.filter((e) => e.type === 'call' || e.type === 'raise').map((e) => e.i)).size;
  switch (drill) {
    case 'multiway': return inBefore >= 2;
    case 'threebet':
      // bucket A: hero can 3-bet (or cold 4-bet); bucket B: hero opens and a villain behind 3-bets.
      if (bucket === 'A') return ['VS_OPEN', 'SQZ', 'COLD4B'].includes(spot.kind) && row.a > 0;
      return ['RFI', 'ISO'].includes(spot.kind) && row.a > 0 && s.players.some((p) => p.i > heroIdx && !p.folded);
    case 'limpers': return spot.kind === 'ISO' || spot.kind === 'BB_LIMP';
    case 'blinds': return (spot.kind === 'VS_OPEN' || spot.kind === 'SQZ') && ['SB', 'BB'].includes(s.players[heroIdx].pos);
    case 'bigpots': {
      const hero = s.players[heroIdx];
      const flop = s.runout.slice(0, 3);
      const a = assess(hero.cards, flop, 1);
      return (a.hasPair && a.hs > 0.7) || a.draws.outs >= 8;
    }
    default: return true;
  }
}

export function createHand({ drill = 'random', ranges }) {
  const bucket = drill === 'threebet' ? (rand() < 0.5 ? 'A' : 'B') : null;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const stakeLabel = weightedPick(Object.fromEntries(STAKES.map((k) => [k.label, k.weight])));
    const stakes = STAKES.find((x) => x.label === stakeLabel);
    const heroIdx = heroSeatFor(drill);
    const deck = shuffledDeck();
    const mix = VILLAIN_CONFIG.tableMix[stakes.label];
    const players = POSITIONS.map((pos, i) => {
      const isHero = i === heroIdx;
      const type = isHero ? null : weightedPick(mix);
      return {
        isHero,
        type,
        stack: isHero ? Math.round((stakes.bb * (190 + rand() * 20)) / 5) * 5 : villainStack(stakes.bb),
        cards: [deck[i * 2], deck[i * 2 + 1]],
        reads: isHero ? [] : makeReads(type),
        meta: {},
      };
    });
    const runout = deck.slice(16, 21);
    const spare = deck.slice(21);
    const s = createGame({ stakes, players, runout });
    s.heroIdx = heroIdx;
    s.drill = { mode: drill, looseness: DRILLS[drill]?.looseness || 1 };
    s.heroDecisions = [];

    while (!s.done && s.toAct !== heroIdx && s.toAct >= 0) villainAct(s);
    if (s.done || s.toAct !== heroIdx) continue;

    const spot = classifySpot(s, heroIdx);
    if (spot.kind === 'NONE') continue;
    const code = handCode(...s.players[heroIdx].cards);
    const row = chartRow(ranges, spot.chart, code);
    if (!isPlayable(row)) continue;
    if (!drillAccepts(drill, s, spot, row, heroIdx, bucket)) continue;

    // 3-bet drill, hero opening: plant a 3-bettor behind (50% of 3-bet drill hands).
    if (drill === 'threebet' && bucket === 'B') {
      const behind = s.players.filter((p) => p.i > heroIdx && !p.folded);
      const weights = Object.fromEntries(behind.map((p) => [p.i, p.type === 'aggressive' || p.type === 'thinking' ? 3 : 1]));
      const v = s.players[Number(weightedPick(weights))];
      const got = sample3betHand(v.type, spare);
      if (!got) continue;
      const [a, b] = got;
      const newCards = [spare[a], spare[b]];
      spare[a] = v.cards[0]; spare[b] = v.cards[1];
      v.cards = newCards;
      v.meta.force3bet = true;
    }
    s.spot = spot;
    s.heroCode = code;
    s.attempts = attempt + 1;
    return s;
  }
  throw new Error('Could not build a hand for this drill. Try Random.');
}

// Hero acts; preflop decisions get graded against the chart first.
export function heroAct(s, action, ranges) {
  const heroIdx = s.heroIdx;
  const la = legalActions(s);
  if (!la || la.player.i !== heroIdx) throw new Error('Not your turn.');
  let grade = null;
  if (s.street === 'preflop') {
    const spot = s.heroDecisions.length === 0 ? s.spot : classifySpot(s, heroIdx);
    const kind = action.type === 'bet' ? 'raise' : action.type;
    grade = gradeDecision({ ranges, spot, code: s.heroCode, action: kind });
    grade.sizing = [];
    if (kind === 'raise') {
      const to = action.to;
      if ((spot.kind === 'ISO' || spot.kind === 'BB_LIMP') && spot.limperIdx) {
        grade.sizing.push(checkIsoSize({ s, heroIdx, limperIdx: spot.limperIdx, to }));
      }
      if (spot.kind === 'VS_3BET' || spot.kind === 'COLD4B') {
        grade.sizing.push(...checkFourBetSize({ s, heroIdx, villainIdx: spot.threeBettor, threeBetTo: s.currentBet, to }));
      }
    }
    grade.to = action.to || (action.type === 'call' ? s.currentBet : 0);
  }
  const entry = applyAction(s, action);
  if (grade) { grade.entry = entry; s.heroDecisions.push(grade); }
  return entry;
}

export { villainAct };
