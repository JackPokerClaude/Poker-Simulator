import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ranges } from './setup.mjs';
import { parseCard, shuffledDeck, handCode, cardStr, HAND_PCT, expandRange } from '../js/engine/cards.js';
import { evaluate } from '../js/engine/eval.js';
import { createGame, applyAction, legalActions, validateRaise, buildPots, dealNextStreet, potTotal } from '../js/engine/game.js';
import { createHand, DRILLS } from '../js/engine/dealer.js';
import { gradeDecision, checkIsoSize, checkFourBetSize, chartRow } from '../js/grading/grade.js';
import { coachText, buildRecord } from '../js/engine/coach.js';
import { exportCSV, importCSV, computeStats } from '../js/storage/history.js';
import { parseCSV, toCSV } from '../js/storage/csv.js';
import { playOut } from './sim.mjs';

const C = (s) => s.match(/../g).map(parseCard);
const stakes = { label: '1/2', sb: 1, bb: 2 };

function game(stacks, cardsList, runout = 'AsKsQsJs9h') {
  const players = stacks.map((stack, i) => ({ stack, type: 'rec', cards: cardsList?.[i] ? C(cardsList[i]) : C(['2c3d', '4c5d', '6c7d', '8c9d', 'TcJd', '2h3h', '4h5h', '6h7h'][i]) }));
  return createGame({ stakes, players, runout: C(runout) });
}

test('fast evaluator agrees with pokersolver on 20k random 7-card matchups', () => {
  for (let n = 0; n < 20000; n++) {
    const d = shuffledDeck();
    const board = d.slice(4, 9);
    const a = [d[0], d[1], ...board], b = [d[2], d[3], ...board];
    const ea = evaluate(a), eb = evaluate(b);
    const ha = globalThis.Hand.solve(a.map(cardStr)), hb = globalThis.Hand.solve(b.map(cardStr));
    const w = globalThis.Hand.winners([ha, hb]);
    const ps = w.length === 2 ? 0 : w[0] === ha ? 1 : -1;
    const mine = ea === eb ? 0 : ea > eb ? 1 : -1;
    assert.equal(mine, ps, `${a.map(cardStr)} vs ${b.map(cardStr)}`);
  }
});

test('hand codes and range helpers', () => {
  assert.equal(handCode(parseCard('As'), parseCard('Ks')), 'AKs');
  assert.equal(handCode(parseCard('7d'), parseCard('Tc')), 'T7o');
  assert.equal(handCode(parseCard('9d'), parseCard('9c')), '99');
  assert.ok(HAND_PCT.AA < HAND_PCT['72o']);
  assert.deepEqual([...expandRange(['JJ+', 'AK'])].sort(), ['AA', 'AKo', 'AKs', 'JJ', 'KK', 'QQ'].sort());
});

test('blinds, min raise, and impossible bets are rejected', () => {
  const s = game([400, 400, 400, 400, 400, 400, 400, 400]);
  assert.equal(potTotal(s), 3);
  assert.equal(s.toAct, 0);
  assert.match(validateRaise(s, 3), /Minimum raise is to \$4/);
  assert.match(validateRaise(s, 401), /only have/);
  assert.match(validateRaise(s, 2), /Minimum raise is to \$4/);
  assert.match(validateRaise(s, 10.5), /whole-dollar/);
  assert.equal(validateRaise(s, 12), null);
  assert.throws(() => applyAction(s, { type: 'check' }), /must call/);
  applyAction(s, { type: 'raise', to: 12 }); // raise of 10
  assert.match(validateRaise(s, 20), /Minimum raise is to \$22/);
  assert.equal(validateRaise(s, 22), null);
});

test('short all-in does not reopen raising for players who already acted', () => {
  // UTG raises to 20, BTN (30 total) calls, SB jams 27 (short), action back on UTG.
  const s = game([400, 400, 400, 400, 400, 400, 27, 400]);
  applyAction(s, { type: 'raise', to: 20 }); // UTG
  for (let k = 0; k < 5; k++) applyAction(s, { type: 'fold' }); // UTG+1..BTN
  applyAction(s, { type: 'raise', to: 27 }); // SB all-in, +7 < min raise 18
  applyAction(s, { type: 'call' }); // BB calls 27 (hasn't acted yet, could raise)
  assert.equal(s.toAct, 0);
  const la = legalActions(s);
  assert.equal(la.canRaise, false);
  assert.equal(la.toCall, 7);
});

test('side pots and payouts conserve chips', () => {
  // UTG all-in 100 with AA, SB all-in 50 with KK, BB 400 with QQ. Board blanks.
  const s = game([100, 400, 400, 400, 400, 400, 50, 400], ['AhAd', null, null, null, null, null, 'KhKd', 'QhQd'], '2c7d9sTh3c');
  applyAction(s, { type: 'raise', to: 100 });
  for (let k = 0; k < 5; k++) applyAction(s, { type: 'fold' });
  applyAction(s, { type: 'call' }); // SB all-in 50
  applyAction(s, { type: 'call' }); // BB calls 100
  while (!s.done) dealNextStreet(s);
  const pots = s.result.pots;
  assert.deepEqual(pots.map((p) => p.amount), [150, 100]);
  assert.equal(s.result.won[0], 250); // AA wins both pots
  const total = s.players.reduce((a, p) => a + p.stack, 0);
  assert.equal(total, 100 + 400 * 6 + 50);
});

test('uncalled bet is returned', () => {
  const s = game([400, 400, 400, 400, 400, 400, 400, 400]);
  applyAction(s, { type: 'raise', to: 15 });
  for (let k = 0; k < 7; k++) applyAction(s, { type: 'fold' });
  assert.ok(s.done);
  assert.equal(s.players[0].stack, 403); // wins blinds, gets own 13 back
});

test('buildPots with folded dead money', () => {
  const pots = buildPots([
    { i: 0, total: 50, folded: false }, { i: 1, total: 200, folded: false }, { i: 2, total: 80, folded: true }, { i: 3, total: 200, folded: false },
  ]);
  assert.deepEqual(pots, [{ amount: 200, eligible: [0, 1, 3] }, { amount: 330, eligible: [1, 3] }]);
});

test('dealer only deals chart-playable hands, for every drill', () => {
  for (const drill of Object.keys(DRILLS)) {
    for (let n = 0; n < 60; n++) {
      const s = createHand({ drill, ranges });
      assert.equal(s.toAct, s.heroIdx);
      const row = chartRow(ranges, s.spot.chart, s.heroCode);
      assert.ok(row && (row.a > 0 || row.c > 0), `${drill}: ${s.spot.chart} ${s.heroCode}`);
      const hero = s.players[s.heroIdx];
      assert.ok(hero.startStack >= s.stakes.bb * 185 && hero.startStack <= s.stakes.bb * 215);
      for (const p of s.players) if (!p.isHero) assert.ok(p.startStack >= s.stakes.bb * 79 && p.startStack <= s.stakes.bb * 401);
    }
  }
});

test('simulated hands: no chip leaks, every hand terminates, record builds', () => {
  for (let n = 0; n < 300; n++) {
    const s = createHand({ drill: 'random', ranges });
    const before = s.players.reduce((a, p) => a + p.startStack, 0);
    playOut(s);
    assert.equal(s.players.reduce((a, p) => a + p.stack, 0), before);
    const rec = buildRecord(s);
    assert.ok(rec.coachText.startsWith('Stakes / venue:'));
  }
});

test('grading: situational shows Mark rule, Joan AA-only 5-bet rule', () => {
  // Find a situational cell and an action it gives 0%: that must show Mark's rule, not "wrong".
  let found = null;
  for (const c of Object.values(ranges.charts)) {
    for (const [code, h] of Object.entries(c.hands)) {
      if (!h[4]) continue;
      const action = h[0] === 0 ? 'raise' : h[3] === 0 && h[1] === 0 ? 'fold' : null;
      if (action && c.scenario !== 'vs_4bet') { found = { c, code, action }; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'expected a situational cell');
  const g = gradeDecision({ ranges, spot: { kind: 'VS_OPEN', chart: found.c.name, exact: true, label: 'x' }, code: found.code, action: found.action });
  assert.equal(g.verdict, 'situational');
  assert.match(g.message, /Mark/);
  const s4 = { kind: 'VS_4BET', chart: 'CONTINUING vs AGGRO 4B', exact: true, label: 'x' };
  assert.equal(gradeDecision({ ranges, spot: s4, code: 'KK', action: 'raise' }).verdict, 'wrong');
  assert.match(gradeDecision({ ranges, spot: s4, code: 'KK', action: 'raise' }).message, /only 5-bet AA/);
  assert.equal(gradeDecision({ ranges, spot: s4, code: 'KK', action: 'call' }).verdict, 'correct');
  assert.equal(gradeDecision({ ranges, spot: s4, code: 'AA', action: 'call' }).verdict, 'wrong');
  assert.equal(gradeDecision({ ranges, spot: s4, code: 'AA', action: 'raise' }).verdict, 'correct');
  const rfi = { kind: 'RFI', chart: 'RFI - EP - 200BB', exact: true, label: 'x' };
  assert.equal(gradeDecision({ ranges, spot: rfi, code: 'AA', action: 'raise' }).verdict, 'correct');
  assert.equal(gradeDecision({ ranges, spot: rfi, code: 'AA', action: 'call' }).verdict, 'wrong');
});

test('sizing checks: iso and 4-bet', () => {
  const s = game([400, 400, 400, 400, 400, 400, 400, 400]);
  // BTN (5) iso over UTG + LJ limpers: IP target 6bb + 2bb = 16
  assert.equal(checkIsoSize({ s, heroIdx: 5, limperIdx: [0, 2], to: 16 }).ok, true);
  assert.equal(checkIsoSize({ s, heroIdx: 5, limperIdx: [0, 2], to: 10 }).ok, false);
  // SB iso over one limper: OOP 7bb + 1bb = 16
  assert.match(checkIsoSize({ s, heroIdx: 6, limperIdx: [0], to: 16 }).message, /Out of position/);
  assert.equal(checkIsoSize({ s, heroIdx: 6, limperIdx: [0], to: 16 }).ok, true);
  // Hero BTN opened, BB 3-bet to 45: hero IP -> 2.5x = ~112
  const [ratio, cap] = checkFourBetSize({ s, heroIdx: 5, villainIdx: 7, threeBetTo: 45, to: 112 });
  assert.equal(ratio.ok, true);
  assert.equal(cap.ok, false); // cap = 27.5% of $400 = $110
  const [, cap2] = checkFourBetSize({ s, heroIdx: 5, villainIdx: 7, threeBetTo: 40, to: 100 });
  assert.equal(cap2.ok, true);
  const [r3] = checkFourBetSize({ s, heroIdx: 1, villainIdx: 5, threeBetTo: 40, to: 100 });
  assert.equal(r3.ok, false); // OOP wants 3-3.5x
});

test('coach text has the exact section order', () => {
  const s = createHand({ drill: 'random', ranges });
  playOut(s);
  const lines = coachText(s).split('\n');
  const labels = ['Stakes / venue:', 'Effective stack ($):', 'Hero seat + cards:', 'Villain(s):', 'Preflop:', 'Flop', 'Turn', 'River', 'Result:', 'My question: Review every decision street by street.'];
  labels.forEach((l, k) => assert.ok(lines[k].startsWith(l), `line ${k}: ${lines[k]}`));
  assert.match(lines[0], /Simulator/);
});

test('CSV round trip keeps records and handles quotes/newlines', () => {
  const rows = [['a', 'b,c', 'd"e', 'f\ng']];
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const recs = [];
  for (let n = 0; n < 5; n++) { const s = createHand({ drill: 'random', ranges }); playOut(s); recs.push(buildRecord(s)); }
  const csv = exportCSV(recs);
  assert.equal(importCSV(csv), 5);
  assert.equal(importCSV(csv), 0); // duplicates skipped
  const st = computeStats(JSON.parse(store['hhp-sim-history-v1']));
  assert.equal(st.hands, 5);
});
