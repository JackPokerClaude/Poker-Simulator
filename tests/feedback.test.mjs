// Feedback engine: Joan's format, the math, conflicts never graded, leak tags from her list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ranges, model, brainTexts } from './setup.mjs';
import { playOut } from './sim.mjs';
import { createHand } from '../js/engine/dealer.js';
import { buildFeedback } from '../js/feedback/engine.js';
import { feedbackHTML } from '../js/feedback/render.js';
import { equityVsRange } from '../js/feedback/equity.js';
import { whenMatches } from '../js/feedback/match.js';
import { packReplay, rebuildHand } from '../js/feedback/replay.js';
import { loadBrain, memoryLastGood } from '../js/brain/loader.js';
import { COMBOS, comboIndex } from '../js/range/tracker.js';
import { parseCard } from '../js/engine/cards.js';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/brain-files.json', import.meta.url), 'utf8'));
const brain = await loadBrain({ manifest, fetchText: async (p) => brainTexts[p.replace('brain/', '')], lastGood: memoryLastGood() });

const hands = [];
for (let h = 0; h < 45; h++) {
  const s = playOut(createHand({ drill: h % 3 === 0 ? 'random' : 'bigpots', ranges }));
  hands.push({ s, fb: buildFeedback(s, { model, brain }) });
}

test('every hand builds feedback in the fixed order', () => {
  let streets = 0;
  for (const { s, fb } of hands) {
    const html = feedbackHTML(s, fb, { gradeHTML: () => '<div class="grade">g</div>' });
    const order = ["Opponent's range", 'The questions to ask here', 'Your action', 'Also from the brain'];
    let at = 0;
    for (const t of order) { const k = html.indexOf(t, at); assert.ok(k >= 0, `missing ${t}`); at = k; }
    for (const st of fb.streets) {
      if (!st.decisions.length) continue;
      streets++;
      const k0 = html.indexOf(`What is my opponent's range?`);
      const k1 = html.indexOf('What happens if…?', k0);
      const k2 = html.indexOf('Your action', k1);
      const k3 = html.indexOf('Verdict', k2);
      const k4 = html.indexOf('Also from the brain', k3);
      assert.ok(k0 >= 0 && k1 > k0 && k2 > k1 && k3 > k2 && k4 > k3, 'street steps in order');
    }
    assert.ok(html.indexOf('End of hand') > 0);
  }
  assert.ok(streets > 10);
});

test('verdicts are tagged, grades are marks, conflicts are never graded', () => {
  for (const { fb } of hands) for (const st of fb.streets) for (const a of st.decisions) {
    assert.match(a.verdict.source, /^\[HHP\]|^\[OUTSIDE SOURCE\]/);
    assert.match(a.grade.mark, /^(✅|⚠️|❌|⚖)$/);
    if (a.also.conflicts.length) { assert.equal(a.grade.mark, '⚖'); assert.deepEqual(a.leaks, []); }
    if (a.verdict.size) assert.match(a.verdict.size.tag, /^\[HHP\] playbook-postflop\.md/);
  }
});

test('leak tags only come from your list in project-instructions.md', () => {
  const allowed = new Set(brain.leakTags);
  assert.ok(allowed.has('thin-value-too-thin') && allowed.has('bad-sizing'));
  for (const { fb } of hands) for (const t of fb.leaks) assert.ok(allowed.has(t), t);
});

test('the math on screen matches the numbers', () => {
  for (const { fb } of hands) for (const st of fb.streets) for (const a of st.decisions) {
    const call = a.opts.find((o) => o.kind === 'call');
    if (call) {
      const t = call.need * a.pot / (1 - call.need);
      assert.ok(Math.abs(call.ev - (a.eq.total * (a.pot + t) - t)) < 1e-6);
    }
    for (const o of a.opts) if (o.mix) assert.ok(Math.abs(Object.values(o.mix).reduce((x, y) => x + y, 0) - 1) < 1e-6);
  }
});

test('equity is computed, exact on the river', () => {
  const board = ['2c', '7d', '9h', 'Js', '3c'].map(parseCard);
  const w = new Float64Array(COMBOS.length);
  w[comboIndex(parseCard('Kh'), parseCard('Kd'))] = 1;
  const aa = equityVsRange(['Ah', 'Ad'].map(parseCard), board, w);
  assert.equal(aa.total, 1); assert.equal(aa.exact, true);
  const qq = equityVsRange(['Qh', 'Qd'].map(parseCard), board, w);
  assert.equal(qq.total, 0);
  const turn = equityVsRange(['Ah', 'Ad'].map(parseCard), board.slice(0, 4), w);
  assert.ok(turn.total > 0.9 && turn.total < 1 && turn.exact);
});

test('matcher: an unknown condition never matches', () => {
  assert.equal(whenMatches({ street: ['flop'] }, { street: 'flop' }), true);
  assert.equal(whenMatches({ street: ['flop'], madeUp: true }, { street: 'flop' }), false);
  assert.equal(whenMatches({ board: { dry: true } }, { board: { dry: false } }), false);
});

test('a saved hand rebuilds exactly for feedback from History', () => {
  for (const { s } of hands.slice(0, 10)) {
    const rep = JSON.parse(JSON.stringify(packReplay(s)));
    const r = rebuildHand(rep);
    assert.deepEqual(r.board, s.board);
    assert.deepEqual(r.result.won, s.result.won);
    assert.doesNotThrow(() => buildFeedback(r, { model, brain }));
  }
});
