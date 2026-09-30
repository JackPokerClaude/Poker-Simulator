// Villain engine v2: compiled layer, brain-driven model, probabilistic policy.
// Bounds are relative to the compiled numbers, so a brain update can't break them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ranges, model, brainTexts } from './setup.mjs';
import { resolveCompiled, normalizeText } from '../js/brain/compiled.js';
import { createGame, legalActions, dealNextStreet, POSITIONS } from '../js/engine/game.js';
import { villainAct } from '../js/engine/ai.js';
import { villainPolicy } from '../js/engine/policy.js';
import { createHand } from '../js/engine/dealer.js';
import { classifySpot, LJ_CHART } from '../js/engine/scenario.js';
import { gradeDecision } from '../js/grading/grade.js';
import { shuffledDeck, weightedPick, handCode } from '../js/engine/cards.js';

test('compiled layer: quotes checked, stale values fall back and get listed', () => {
  const compiled = { version: 1, values: {
    a: { v: 7.5, src: { file: 'x.md', quote: 'Opens about 7-8%' }, fb: 9 },
    b: { v: 30, src: { file: 'x.md', quote: 'this text is gone' }, fb: 25 },
    c: { v: 0.2, outside: 'no number in the brain' },
  } };
  const r = resolveCompiled(compiled, { 'x.md': '| **Passive** | Opens about 7–8%, 3-bets |' });
  assert.equal(r.values.a.v, 7.5);
  assert.equal(r.values.a.tag, 'HHP');
  assert.equal(r.values.b.v, 25);
  assert.equal(r.values.b.stale, true);
  assert.equal(r.values.c.tag, 'OUTSIDE');
  assert.deepEqual(r.stale.map((x) => x.key), ['b']);
  assert.equal(normalizeText('*Range:* “AA” – **KK**'), 'range: "aa" - kk');
});

test('compiled layer vs the real brain: stale values are reported, never fatal', () => {
  const r = model.resolved;
  for (const s of r.stale) console.log(`# WARNING: stale compiled value ${s.key} (quote gone from ${s.file})`);
  assert.ok(r.counts.total > 100);
  assert.ok(brainTexts['playbook-preflop.md'].length > 0);
});

test('every villain type and style has what the engine needs', () => {
  for (const [t, def] of Object.entries(model.types)) {
    assert.ok(def.label, t);
    assert.ok(def.pre && typeof def.pre.openPct === 'number', `${t} openPct`);
    const styles = Object.keys(def.styleMix);
    for (const st of styles) assert.ok(model.styles[st]?.bet, `${t} -> ${st}`);
  }
});

function mkState(types, deck = shuffledDeck()) {
  const players = POSITIONS.map((pos, i) => {
    const type = types[i % types.length];
    return { type, style: weightedPick(model.types[type].styleMix), stack: 400, cards: [deck[2 * i], deck[2 * i + 1]], meta: {} };
  });
  const s = createGame({ stakes: { label: '1/2', sb: 1, bb: 2 }, players, runout: deck.slice(16, 21) });
  s.drill = { looseness: 1 };
  return s;
}

test('policy: probabilities sum to 1, same answer every time, labels kept on the log', () => {
  for (let h = 0; h < 60; h++) {
    const s = mkState(Object.keys(model.types));
    let guard = 0;
    while (!s.done && guard++ < 200) {
      if (s.awaitingDeal) { dealNextStreet(s); continue; }
      const i = s.toAct;
      const opts = villainPolicy(s, i, s.players[i].cards);
      const tot = opts.reduce((a, o) => a + o.p, 0);
      assert.ok(Math.abs(tot - 1) < 1e-9, `sum ${tot}`);
      assert.deepEqual(villainPolicy(s, i, s.players[i].cards).map((o) => [o.label, o.p]), opts.map((o) => [o.label, o.p]));
      const e = villainAct(s);
      assert.ok(e.meta?.label, 'label on log entry');
    }
  }
});

test('calibration: each type opens and plays about as wide as the brain says', () => {
  const types = Object.keys(model.types);
  const st = Object.fromEntries(types.map((t) => [t, { seats: 0, vpip: 0, rfiOpp: 0, rfi: 0 }]));
  for (let h = 0; h < 1500; h++) {
    const s = mkState(types.map((_, k) => types[(h + k) % types.length]));
    while (!s.done && !s.awaitingDeal && s.street === 'preflop') {
      const p = s.players[s.toAct];
      const unopened = s.raiseLevel === 1 && !s.log.some((e) => e.street === 'preflop' && (e.type === 'call' || e.type === 'raise'));
      const e = villainAct(s);
      if (unopened) { st[p.type].rfiOpp++; if (e.type === 'raise') st[p.type].rfi++; }
    }
    for (const p of s.players) {
      st[p.type].seats++;
      if (s.log.some((e) => e.street === 'preflop' && e.i === p.i && (e.type === 'call' || e.type === 'raise'))) st[p.type].vpip++;
    }
  }
  for (const t of types) {
    const pre = model.types[t].pre;
    const rfi = (100 * st[t].rfi) / st[t].rfiOpp;
    if (t !== 'whale') assert.ok(rfi > pre.openPct * 0.5 && rfi < pre.openPct * 1.6, `${t} RFI ${rfi.toFixed(1)} vs ${pre.openPct}`);
    else assert.ok(Math.abs((100 * st[t].vpip) / st[t].seats - pre.vpipPct) < 15, `whale VPIP ${(100 * st[t].vpip) / st[t].seats}`);
  }
});

test('LJ opens use the compiled HHP chart [2025-02-18 HHP]', () => {
  const c = ranges.charts[LJ_CHART];
  assert.ok(c, 'compiled LJ chart loaded');
  assert.equal(Object.values(c.hands).filter((h) => h[0] === 100).length, 44);
  assert.equal(c.hands.A2s[0], 100);
  assert.equal(c.hands['55'][0], 0);
  assert.equal(c.hands.KJo[0], 0);
  let found = null;
  for (let k = 0; k < 3000 && !found; k++) {
    const s = createHand({ drill: 'random', ranges });
    if (s.players[s.heroIdx].pos === 'LJ' && s.spot.kind === 'RFI') found = s;
  }
  assert.ok(found, 'dealt an LJ open');
  const spot = classifySpot(found, found.heroIdx);
  assert.equal(spot.chart, LJ_CHART);
  assert.equal(spot.exact, true);
  const g = gradeDecision({ ranges, spot, code: found.heroCode, action: 'raise' });
  assert.equal(g.source, 'HHP');
  assert.match(g.sourceTag, /^\[HHP\] LJ OPEN - 200BB \(2025-02-18 HHP\) · playbook-preflop\.md › 3\. Opening \(RFI\), 200bb · 2025-02-18 HHP \(compiled\)$/);
  assert.equal(g.verdict, 'correct');
});

test('reads shown to you come from the brain and never name the type', () => {
  for (let k = 0; k < 30; k++) {
    const s = createHand({ drill: 'random', ranges });
    for (const p of s.players) {
      if (p.isHero) continue;
      p.readKeys.forEach((key, n) => {
        assert.equal(model.rec(key)?.tag, 'HHP', key);
        assert.ok(!new RegExp(`\\b${model.types[p.type].label}\\b`, 'i').test(p.reads[n]), p.reads[n]);
      });
    }
  }
});

test('opponent charts count as exact only for the type they were drawn for', () => {
  const g = (type) => {
    for (let k = 0; k < 6000; k++) {
      const s = createHand({ drill: 'blinds', ranges });
      if (s.spot.kind === 'VS_OPEN' && s.players[s.heroIdx].pos === 'BB' && s.players[s.spot.opener].type === type) return s.spot;
    }
    return null;
  };
  const tight = g('tight');
  if (tight) assert.equal(tight.exact, false);
  const passive = g('passive');
  if (passive) { assert.equal(passive.chart, 'BB vs PASSIVE OPEN'); assert.equal(passive.exact, true); }
  void handCode; void legalActions;
});
