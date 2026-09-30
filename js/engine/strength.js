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

// ---------- fast per-board strength (the villain policy and the range tracker share it) ----------
// Every two-card hand's value on this board, sorted, so any hand's percentile vs random hands
// is a binary search. Same number madeStrength() gives (minus tiny card-removal effects).
const tableCache = new Map();
export function boardTable(board) {
  const key = board.join(',');
  let t = tableCache.get(key);
  if (t) return t;
  const used = new Set(board);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  const vals = [];
  const b = [...board, 0, 0];
  const L = board.length;
  for (let x = 0; x < deck.length; x++) {
    b[L] = deck[x];
    for (let y = x + 1; y < deck.length; y++) { b[L + 1] = deck[y]; vals.push(evaluate(b)); }
  }
  const sorted = Int32Array.from(vals).sort();
  t = { sorted, boardCat: categoryOf(evaluate(board)) };
  if (tableCache.size > 24) tableCache.delete(tableCache.keys().next().value);
  tableCache.set(key, t);
  return t;
}

function percentile(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  const below = lo;
  hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= v) lo = m + 1; else hi = m; }
  return (below + (lo - below) / 2) / sorted.length;
}

// Everything the policy needs to know about one hand on one board.
export function features(hole, board, table = boardTable(board)) {
  const v = evaluate([...hole, ...board]);
  const rawHs = percentile(table.sorted, v);
  const cat = categoryOf(v);
  // Does the hand use a hole card to make a pair or better (vs. playing the board)?
  const hasPair = cat >= 1 && cat > table.boardCat;
  // Strength vs random hands overrates unpaired hands; ranges that bet/call are stronger.
  const hs = hasPair ? rawHs : rawHs * 0.55;
  return { v, rawHs, hs, cat, hasPair, draws: drawInfo(hole, board) };
}

// AI hand class (monster / strong / medium / air), tighter with more opponents.
export function aiClass(f, opponents = 1) {
  const eq = f.hs ** Math.max(1, opponents);
  if (eq > 0.9 || f.hs > 0.97) return 'monster';
  if (eq > 0.72) return 'strong';
  if (eq > 0.55 || (f.hasPair && opponents <= 2 && f.hs > 0.6)) return 'medium';
  return 'air';
}

// HHP range buckets, heads-up: Strong (can play for stacks + thick value), Medium (thin value
// + showdown value), Draws, Air. A made medium hand with a draw counts as Medium.
export function bucketOf(f, street) {
  const c = aiClass(f, 1);
  if (c === 'monster' || c === 'strong') return 'strong';
  if (c === 'medium') return 'medium';
  if (street !== 'river' && f.draws.outs >= 4) return 'draws';
  return 'air';
}

// Classify for the AI: monster / strong / medium / weak(air), plus draw info.
export function assess(hole, board, opponents = 1) {
  const f = features(hole, board);
  const drawEq = board.length === 3 ? f.draws.outs * 0.04 : board.length === 4 ? f.draws.outs * 0.02 : 0;
  return { hs: f.hs, rawHs: f.rawHs, eq: f.hs ** Math.max(1, opponents), cls: aiClass(f, opponents), draws: f.draws, drawEq, isDraw: f.draws.outs >= 8, hasPair: f.hasPair, cat: f.cat };
}
