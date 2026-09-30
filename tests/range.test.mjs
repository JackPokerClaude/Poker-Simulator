// Range tracker: replays hands with the villain's own policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ranges } from './setup.mjs';
import { playOut } from './sim.mjs';
import { createHand } from '../js/engine/dealer.js';
import { trackHand, comboIndex, total, COMBOS, preflopActionMix } from '../js/range/tracker.js';
import { comboClasses, classShares, CLASS_KEYS } from '../js/range/classes.js';
import { rangeCells } from '../js/ui/grid.js';
import { parseCard } from '../js/engine/cards.js';

test('his real hand is always inside the range the tracker gives (300 hands, every street)', () => {
  let checked = 0;
  for (let h = 0; h < 300; h++) {
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

test('classes, shares and grid cells', () => {
  const board = ['Ah', '7c', '2d'].map(parseCard);
  const b = comboClasses(board, 'flop');
  const idx = (x, y) => comboIndex(parseCard(x), parseCard(y));
  assert.equal(b[idx('Ah', 'Ac')], null, 'board card');
  const w = new Float64Array(COMBOS.length).fill(0);
  w[idx('As', 'Kd')] = 1; w[idx('Ks', 'Qs')] = 0.5;
  const sh = classShares(w, b);
  assert.ok(Math.abs(CLASS_KEYS.reduce((a, k) => a + sh[k], 0) - 1) < 1e-9);
  const prev = new Float64Array(w); prev[idx('Kd', 'Qd')] = 1;
  const dead = new Set([...board]);
  const cells = rangeCells({ w, prev, classes: b, dead });
  assert.equal(cells.length, 169);
  const kq = cells.find((c) => c.code === 'KQs');
  assert.equal(kq.live, 4); // no suited KQ is blocked by A-7-2
  assert.ok(Math.abs(kq.freq - 0.5 / 4) < 1e-9, 'frequency = weight over live combos');
  assert.ok(kq.gone > 0);
  const ak = cells.find((c) => c.code === 'AKo');
  assert.equal(ak.live, 9, 'Ah on the board blocks 3 of 12 AKo combos');
});

test('preflop action mix sums to one per hand', () => {
  const s = playOut(createHand({ drill: 'random', ranges }));
  const { ranges: R } = trackHand(s);
  const act = Object.values(R).flatMap((r) => r.actions).find((a) => a.street === 'preflop');
  const mix = preflopActionMix(act);
  for (const m of Object.values(mix)) assert.ok(Math.abs(m.p.raise + m.p.call + m.p.fold - 1) < 1e-9);
});
