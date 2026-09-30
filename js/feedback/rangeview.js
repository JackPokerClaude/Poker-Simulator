// Per-villain, per-street range views for the feedback screen (grids + bucket shares).
import { trackHand, comboBuckets, bucketShares, gridCells, preflopActionMix } from '../range/tracker.js';
import { isInvolved } from '../engine/coach.js';

const STREETS = ['preflop', 'flop', 'turn', 'river'];

export function rangeViews(hand, tracked = trackHand(hand)) {
  const R = tracked.ranges;
  const out = [];
  for (const [si, r] of Object.entries(R)) {
    const i = Number(si);
    if (!isInvolved(hand, i)) continue;
    const views = [];
    const pre = r.actions.filter((a) => a.street === 'preflop' && a.label !== 'fold');
    const lastPre = pre[pre.length - 1] || r.actions.find((a) => a.street === 'preflop');
    if (lastPre) views.push({ street: 'preflop', mode: 'action', cells: gridCells({ actionMix: preflopActionMix(lastPre) }), act: lastPre });
    for (const street of STREETS.slice(1)) {
      if (!r.streets[street]) break;
      // Narrowed from the start of this street (last street's range minus the new board cards).
      const prev = r.start[street];
      const deal = hand.log.find((e) => e.type === 'deal' && e.street === street);
      const board = deal.board;
      const buckets = comboBuckets(board, street);
      const w = r.streets[street];
      views.push({ street, mode: 'bucket', board, buckets, w, prev, cells: gridCells({ w, prev, buckets }), shares: bucketShares(w, buckets) });
    }
    out.push({ i, pos: hand.players[i].pos, views, range: r });
  }
  return { villains: out, tracked };
}
