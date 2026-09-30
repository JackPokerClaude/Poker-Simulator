// Prediction step: context, truth, grading, coach line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ranges } from './setup.mjs';
import { createHand, heroAct, villainAct } from '../js/engine/dealer.js';
import { dealNextStreet, legalActions } from '../js/engine/game.js';
import { predictionContext, computeTruth, gradePrediction, preflopBucket, predictionLine, BUCKETS } from '../js/predict/predict.js';
import { coachText } from '../js/engine/coach.js';

test('preflop buckets [OUTSIDE SOURCE]', () => {
  assert.equal(preflopBucket('AA'), 'strong');
  assert.equal(preflopBucket('AKo'), 'strong');
  assert.equal(preflopBucket('KQo'), 'medium');
  assert.equal(preflopBucket('ATo'), 'medium');
  assert.equal(preflopBucket('76s'), 'draws');
  assert.equal(preflopBucket('44'), 'draws');
  assert.equal(preflopBucket('A5s'), 'draws');
  assert.equal(preflopBucket('72o'), 'air');
});

// Play a hand, calling/checking as hero, and predict at every street's first decision.
function playWithPredictions(drill = 'bigpots') {
  const s = createHand({ drill, ranges });
  s.predictions = {};
  let guard = 0;
  while (!s.done && guard++ < 300) {
    if (s.awaitingDeal) { dealNextStreet(s); continue; }
    if (s.toAct !== s.heroIdx) { villainAct(s); continue; }
    if (!s.predictions[s.street]) {
      const ctx = predictionContext(s);
      if (ctx) {
        const blocks = { strong: 3, medium: 3, draws: 2, air: 2 };
        const answers = Object.fromEntries(ctx.questions.map((q) => [q.id, q.options[1][0]]));
        const pred = { street: s.street, target: ctx.target, blocks: ctx.askRange ? blocks : null, answers, questions: ctx.questions };
        const truth = computeTruth(s, ctx);
        s.predictions[s.street] = { ...pred, truth, grade: gradePrediction(pred, truth) };
        s.predictions[s.street].line = predictionLine(s, pred);
      }
    }
    const la = legalActions(s);
    heroAct(s, la.canCheck ? { type: 'check' } : { type: 'call' }, ranges);
  }
  return s;
}

test('truth: his range shares and response mixes each sum to 1; grades are marks', () => {
  let n = 0;
  for (let h = 0; h < 25; h++) {
    const s = playWithPredictions(h % 2 ? 'bigpots' : 'random');
    for (const p of Object.values(s.predictions)) {
      n++;
      if (p.truth.shares) assert.ok(Math.abs(BUCKETS.reduce((a, b) => a + p.truth.shares[b], 0) - 1) < 1e-9);
      for (const a of Object.values(p.truth.answers)) assert.ok(Math.abs(Object.values(a.mix).reduce((x, y) => x + y, 0) - 1) < 1e-6);
      if (p.grade.range) assert.match(p.grade.range.mark, /✅|⚠️|❌/);
      for (const g of Object.values(p.grade.answers)) assert.match(g.mark, /✅|⚠️|❌/);
    }
  }
  assert.ok(n > 10);
});

test('grading: a perfect read is ✅, a wild one is ❌', () => {
  const truth = { shares: { strong: 0.1, medium: 0.4, draws: 0.2, air: 0.3 }, answers: { ifBet: { mix: { fold: 0.6, call: 0.3, raise: 0.1 } } } };
  const good = gradePrediction({ blocks: { strong: 1, medium: 4, draws: 2, air: 3 }, answers: { ifBet: 'fold' } }, truth);
  assert.equal(good.range.mark, '✅'); assert.equal(good.range.off, 0); assert.equal(good.answers.ifBet.mark, '✅');
  const bad = gradePrediction({ blocks: { strong: 8, medium: 0, draws: 1, air: 1 }, answers: { ifBet: 'raise' } }, truth);
  assert.equal(bad.range.mark, '❌'); assert.equal(bad.range.worst, 'strong'); assert.equal(bad.range.dir, 'too much');
  assert.equal(bad.answers.ifBet.mark, '❌');
  const mid = gradePrediction({ blocks: { strong: 1, medium: 4, draws: 2, air: 3 }, answers: { ifBet: 'call' } }, truth);
  assert.equal(mid.answers.ifBet.mark, '⚠️');
});

test('Copy for coach carries the read line right under its street', () => {
  for (let h = 0; h < 20; h++) {
    const s = playWithPredictions();
    if (!s.predictions.flop) continue;
    const lines = coachText(s).split('\n');
    const k = lines.findIndex((l) => l.startsWith('Flop'));
    assert.match(lines[k + 1], /^Flop read \(vs (UTG\+1|UTG|LJ|HJ|CO|BTN|SB|BB)\): /);
    if (s.predictions.flop.blocks) assert.match(lines[k + 1], /his range \d+ Strong \/ \d+ Medium \/ \d+ Draws \/ \d+ Air/);
    return;
  }
  assert.fail('no hand reached the flop with a prediction');
});
