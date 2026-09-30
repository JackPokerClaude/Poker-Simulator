// Range tracker: replays hands with the villain's own policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ranges } from './setup.mjs';
import { playOut } from './sim.mjs';
import { createHand } from '../js/engine/dealer.js';
import { trackHand, comboIndex, total, comboBuckets, bucketShares, gridCells, COMBOS, preflopActionMix } from '../js/range/tracker.js';
import { parseCard } from '../js/engine/cards.js';

test('his real hand is always inside the range the tracker gives', () => {
  let checked = 0;
  for (let h = 0; h < 120; h++) {
    const s = playOut(createHand({ drill: h % 3 === 0 ? 'bigpots' : h % 3 === 1 ? 'threebet' : 'random', ranges }));
    const { ranges: R, state } = trackHand(s);
    assert.deepEqual(state.board.slice(0, s.board.length), s.board.slice(0, state.board.length), 'replay in sync');
    for (const [i, r] of Object.entries(R)) {
      const p = s.players[i];
      const k = comboIndex(...p.cards);
      for (const [street, w] of Object.entries(r.streets)) {
        assert.ok(w[k] > 0, `hand ${h}: ${p.pos} ${p.type}/${p.style} real hand dropped on ${street}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500);
});

test('ranges narrow: a raise keeps only part of his hands', () => {
  let opens = 0, n = 0;
  for (let h = 0; h < 200 && n < 20; h++) {
    const s = playOut(createHand({ drill: 'random', ranges }));
    const { ranges: R } = trackHand(s);
    for (const [i, r] of Object.entries(R)) {
      const first = r.actions.find((a) => a.street === 'preflop');
      if (first?.label === 'raise' && first.entry.level === 1) {
        const frac = total(first.after) / total(first.before);
        assert.ok(frac > 0 && frac < 0.85, `open share ${frac}`); // a whale isos ~80% of what he plays
        opens += frac; n++;
      }
      void i;
    }
  }
  assert.ok(n > 0);
});

test('buckets and grid cells', () => {
  const board = ['Ah', '7c', '2d'].map(parseCard);
  const b = comboBuckets(board, 'flop');
  const idx = (x, y) => comboIndex(parseCard(x), parseCard(y));
  assert.equal(b[idx('As', 'Kd')], 'strong');
  assert.equal(b[idx('7s', '7d')], 'strong');
  assert.equal(b[idx('Ks', 'Qs')], 'air');
  assert.equal(b[idx('Ah', 'Ac')], null, 'board card');
  const w = new Float64Array(COMBOS.length).fill(0);
  w[idx('As', 'Kd')] = 1; w[idx('Ks', 'Qs')] = 1;
  const sh = bucketShares(w, b);
  assert.equal(sh.strong, 0.5); assert.equal(sh.air, 0.5);
  const prev = new Float64Array(w); prev[idx('Kd', 'Qd')] = 1;
  const cells = gridCells({ w, prev, buckets: b });
  assert.equal(cells.length, 169);
  const kq = cells.find((c) => c.code === 'KQs');
  assert.ok(kq.segs.air > 0 && kq.segs.gone > 0);
});

test('preflop action mix sums to one per hand', () => {
  const s = playOut(createHand({ drill: 'random', ranges }));
  const { ranges: R } = trackHand(s);
  const act = Object.values(R).flatMap((r) => r.actions).find((a) => a.street === 'preflop');
  const mix = preflopActionMix(act);
  for (const m of Object.values(mix)) assert.ok(Math.abs(m.p.raise + m.p.call + m.p.fold - 1) < 1e-9);
});
