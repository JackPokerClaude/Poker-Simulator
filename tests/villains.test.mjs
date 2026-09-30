// Villain engine v2: compiled layer, brain-driven model, probabilistic policy.
// Bounds are relative to the compiled numbers, so a brain update can't break them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ranges, model, brainTexts } from './setup.mjs';
import { resolveCompiled, normalizeText } from '../js/brain/compiled.js';
import { createGame, legalActions, dealNextStreet, applyAction, POSITIONS } from '../js/engine/game.js';
import { villainAct } from '../js/engine/ai.js';
import { villainPolicy } from '../js/engine/policy.js';
import { createHand } from '../js/engine/dealer.js';
import { classifySpot, LJ_CHART, LJ_CHART_100, openEffectiveBB } from '../js/engine/scenario.js';
import { gradeDecision } from '../js/grading/grade.js';
import { shuffledDeck, weightedPick, handCode, ALL_CODES, combosOf, RANKS } from '../js/engine/cards.js';

// Two real cards for a code like 'AKs' (suits chosen so they never clash).
const cardsFor = (code) => { const a = RANKS.indexOf(code[0]) * 4, b = RANKS.indexOf(code[1]) * 4; return code[2] === 's' ? [a, b] : [a, b + 1]; };

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

// Exact, not sampled: for each type in each seat, folded to him, the share of all 1326 hands
// his strategy raises. The average over seats UTG-SB must sit near the brain's open %.
test('calibration: each type opens about as wide as the brain says (exact)', () => {
  const types = Object.keys(model.types);
  for (const t of types) {
    let tot = 0, seats = 0;
    for (let seat = 0; seat <= 6; seat++) {
      const s = mkState(types.map(() => t));
      for (let k = 0; k < seat; k++) applyAction(s, { type: 'fold' });
      let raise = 0;
      for (const code of ALL_CODES) {
        const opts = villainPolicy(s, seat, cardsFor(code));
        raise += combosOf(code) * opts.filter((o) => o.label.startsWith('raise')).reduce((a, o) => a + o.p, 0);
      }
      tot += (100 * raise) / 1326; seats++;
    }
    const avg = tot / seats;
    const pre = model.types[t].pre;
    assert.ok(avg > pre.openPct * 0.7 && avg < pre.openPct * 1.5, `${t} opens ${avg.toFixed(1)}% on average vs brain ${pre.openPct}%`);
  }
});

test('calibration: the whale plays VPIP near the brain\'s 70-80% (large sample)', () => {
  let seats = 0, vpip = 0;
  for (let h = 0; h < 3000; h++) {
    const types = Object.keys(model.types);
    const s = mkState(types.map((_, k) => types[(h + k) % types.length]));
    while (!s.done && !s.awaitingDeal && s.street === 'preflop') villainAct(s);
    for (const p of s.players) if (p.type === 'whale') {
      seats++;
      if (s.log.some((e) => e.street === 'preflop' && e.i === p.i && (e.type === 'call' || e.type === 'raise'))) vpip++;
    }
  }
  assert.ok(Math.abs((100 * vpip) / seats - model.types.whale.pre.vpipPct) < 15, `whale VPIP ${((100 * vpip) / seats).toFixed(1)}`);
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
    // A deep one (the 100bb chart has its own test below).
    if (s.players[s.heroIdx].pos === 'LJ' && s.spot.kind === 'RFI' && openEffectiveBB(s, s.heroIdx) >= 150) found = s;
  }
  assert.ok(found, 'dealt a deep LJ open');
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

test('the reg/pro opens exactly HHP\'s own RFI chart in the seats that have one, and sits only at 1/3 and 2/5', async () => {
  const { TABLE_SETTINGS } = await import('../config/table-settings.js');
  const { getCharts } = await import('../js/villains/model.js');
  assert.ok(!TABLE_SETTINGS.tableMix['1/2'].pro && TABLE_SETTINGS.tableMix['1/3'].pro > 0 && TABLE_SETTINGS.tableMix['2/5'].pro > 0);
  const pre = model.types.pro.pre;
  const types = Object.keys(model.types);
  for (const [pos, chart] of Object.entries(pre.openCharts)) {
    const seat = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'].indexOf(pos);
    const s = mkState(types.map(() => 'pro'));
    for (let k = 0; k < seat; k++) applyAction(s, { type: 'fold' });
    const rows = getCharts().charts[chart].hands;
    for (const code of ALL_CODES) {
      const opts = villainPolicy(s, seat, cardsFor(code));
      const raise = opts.filter((o) => o.label.startsWith('raise')).reduce((a, o) => a + o.p, 0);
      assert.ok(Math.abs(raise - rows[code][0] / 100) < 1e-9, `${pos} ${code}: ${raise} vs chart ${rows[code][0]}%`);
    }
  }
});

test('LJ at about 100bb effective uses the 100bb LJ chart [2025-02-18 HHP]', () => {
  const c = ranges.charts[LJ_CHART_100];
  assert.ok(c, 'compiled 100bb LJ chart loaded');
  assert.equal(Object.values(c.hands).filter((h) => h[0] === 100).length, 36);
  for (const [code, v] of [['A2s', 0], ['ATo', 100], ['KJo', 100], ['QJo', 100], ['98s', 0], ['55', 0], ['66', 100]]) assert.equal(c.hands[code][0], v, code);
  let short = null, deep = null;
  for (let k = 0; k < 6000 && !(short && deep); k++) {
    const s = createHand({ drill: 'random', ranges });
    if (s.players[s.heroIdx].pos !== 'LJ' || s.spot.kind !== 'RFI') continue;
    if (openEffectiveBB(s, s.heroIdx) < 150) short ||= s; else deep ||= s;
  }
  // Force a short table if the random deal didn't give one: everyone behind at 100bb.
  if (!short && deep) {
    short = structuredClone(deep);
    for (const p of short.players) if (p.i !== short.heroIdx) p.stack = Math.min(p.stack, 100 * short.stakes.bb - p.committed);
  }
  assert.equal(classifySpot(short, short.heroIdx).chart, LJ_CHART_100);
  if (deep) assert.equal(classifySpot(deep, deep.heroIdx).chart, LJ_CHART);
});
