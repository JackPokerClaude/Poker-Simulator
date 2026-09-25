// Hand strength + draw detection for villain decisions.
import { rankOf, suitOf } from './cards.js';
import { evaluate, categoryOf } from './eval.js';

// Share of random opponent hands this hand beats on the current board (0..1).
export function madeStrength(hole, board) {
  const used = new Set([...hole, ...board]);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  const mine = evaluate([...hole, ...board]);
  let win = 0, tie = 0, n = 0;
  const b = [...board, 0, 0];
  const L = board.length;
  for (let x = 0; x < deck.length; x++) {
    b[L] = deck[x];
    for (let y = x + 1; y < deck.length; y++) {
      b[L + 1] = deck[y];
      const v = evaluate(b);
      if (mine > v) win++; else if (mine === v) tie++;
      n++;
    }
  }
  return (win + tie / 2) / n;
}

const straightMaskHas = (mask) => {
  const full = (mask << 1) | ((mask >> 12) & 1);
  for (let lo = 0; lo <= 9; lo++) if (((full >> lo) & 31) === 31) return true;
  return false;
};
const rankMask = (cards) => cards.reduce((m, c) => m | (1 << rankOf(c)), 0);

// Draw outs that use at least one hole card (flop/turn only).
export function drawInfo(hole, board) {
  const out = { flushDraw: false, nutFlushDraw: false, oesd: false, gutshot: false, overcards: 0, outs: 0 };
  if (board.length >= 5 || board.length < 3) return out;
  const all = [...hole, ...board];
  const madeCat = categoryOf(evaluate(all));
  for (let s = 0; s < 4; s++) {
    const n = all.filter((c) => suitOf(c) === s).length;
    const holeN = hole.filter((c) => suitOf(c) === s).length;
    if (n === 4 && holeN > 0 && madeCat < 5) {
      out.flushDraw = true;
      out.nutFlushDraw = hole.some((c) => suitOf(c) === s && rankOf(c) === 12)
        || (holeN === 1 && board.some((c) => suitOf(c) === s && rankOf(c) === 12) && hole.some((c) => suitOf(c) === s && rankOf(c) === 11));
    }
  }
  if (madeCat < 4) {
    const mAll = rankMask(all), mBoard = rankMask(board);
    let completing = 0;
    for (let r = 0; r < 13; r++) {
      if (mAll & (1 << r)) continue;
      if (straightMaskHas(mAll | (1 << r)) && !straightMaskHas(mBoard | (1 << r))) completing++;
    }
    if (completing >= 2) out.oesd = true;
    else if (completing === 1) out.gutshot = true;
  }
  const topBoard = Math.max(...board.map(rankOf));
  out.overcards = hole.filter((c) => rankOf(c) > topBoard).length;
  let outs = (out.flushDraw ? 9 : 0) + (out.oesd ? 8 : out.gutshot ? 4 : 0);
  if (out.flushDraw && (out.oesd || out.gutshot)) outs -= 2;
  if (madeCat === 0 && out.overcards === 2) outs += 3;
  out.outs = Math.min(outs, 15);
  return out;
}

// Classify for the AI: monster / strong / medium / weak(air), plus draw info.
export function assess(hole, board, opponents = 1) {
  const rawHs = madeStrength(hole, board);
  const draws = drawInfo(hole, board);
  const cat = categoryOf(evaluate([...hole, ...board]));
  // Does the hand use a hole card to make a pair or better (vs. playing the board)?
  const boardCat = categoryOf(evaluate(board));
  const hasPair = cat >= 1 && cat > boardCat;
  // Strength vs random hands overrates unpaired hands; ranges that bet/call are stronger.
  const hs = hasPair ? rawHs : rawHs * 0.55;
  const eqMulti = Math.pow(hs, Math.max(1, opponents));
  let cls;
  if (eqMulti > 0.9 || (hs > 0.97)) cls = 'monster';
  else if (eqMulti > 0.72) cls = 'strong';
  else if (eqMulti > 0.55 || (hasPair && opponents <= 2 && hs > 0.6)) cls = 'medium';
  else cls = 'air';
  const drawEq = board.length === 3 ? draws.outs * 0.04 : board.length === 4 ? draws.outs * 0.02 : 0;
  const isDraw = draws.outs >= 8;
  return { hs, rawHs, eq: eqMulti, cls, draws, drawEq, isDraw, hasPair, cat };
}
