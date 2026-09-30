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

const points = (fb) => fb.streets.flatMap((st) => st.points);

test('every decision builds in the fixed order', () => {
  let decs = 0;
  for (const { s, fb } of hands) {
    const html = feedbackHTML(s, fb, { gradeHTML: () => '<div class="grade">g</div>' });
    if (fb.preflop.points.length) {
      let at = html.indexOf('Your decision');
      for (const t of ['The questions to ask here', 'Your action', 'Also from the brain']) { const k = html.indexOf(t, at); assert.ok(k > at, `preflop: missing ${t}`); at = k; }
    }
    // Each postflop decision block: range, what happens if, action, verdict, also.
    for (const block of html.split('<div class="fb-dec">').slice(1)) {
      if (!block.includes('What happens if')) continue;
      decs++;
      const ks = [/range\?/, /What happens if/, /Your action/, /Verdict/, /Also from the brain/].map((re) => block.search(re));
      assert.ok(ks.every((k, n) => k >= 0 && (n === 0 || k > ks[n - 1])), 'five steps in order');
    }
    assert.ok(html.indexOf('End of hand') > 0);
  }
  assert.ok(decs > 10);
});

test('the chart and the equity math use the same range', () => {
  for (const { fb } of hands) for (const pt of points(fb)) {
    if (!pt.analysis) continue;
    assert.equal(pt.analysis.rangeRef, pt.grid.detail.w, 'same array');
    const sum = Object.values(pt.shares).reduce((a, x) => a + x, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `class shares sum to ${sum}`);
    if (pt.versus) assert.ok(Math.abs(pt.versus.beat + pt.versus.lose + pt.versus.chop - 1) < 1e-9);
  }
});

test('every range change has a reason with a source tag', () => {
  let n = 0;
  for (const { fb } of hands) for (const pt of [...fb.preflop.points, ...points(fb)]) for (const c of pt.changes || []) {
    n++;
    assert.match(c.reason.tag, /^\[HHP\] |^\[OUTSIDE SOURCE\]/);
    if (c.before) assert.ok(Math.abs(Object.values(c.after).reduce((a, x) => a + x, 0) - 1) < 1e-6);
  }
  assert.ok(n > 20);
});

test('verdicts are tagged, grades are marks, conflicts are never graded', () => {
  for (const { fb } of hands) for (const pt of points(fb)) {
    const a = pt.analysis;
    if (!a) continue;
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
  for (const { fb } of hands) for (const pt of points(fb)) {
    const a = pt.analysis;
    if (!a) continue;
    const call = a.opts.find((o) => o.kind === 'call');
    if (call) {
      const t = call.need * a.pot / (1 - call.need);
      const real = a.real ?? 1;
      assert.ok(Math.abs(call.ev - (a.eq.total * real * (a.pot + t) - t)) < 1e-6);
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

test('out of position before the river, math-only EVs use the realization factor', () => {
  let seen = 0;
  for (const { fb } of hands) for (const pt of points(fb)) {
    const a = pt.analysis;
    if (!a) continue;
    if (a.street === 'river') assert.equal(a.real, 1);
    if (a.real < 1) { seen++; assert.ok(a.opts.some((o) => o.lines.some((l) => /realize about 80%/.test(l)))); }
    if (a.grade.close) assert.equal(a.grade.mark, '⚠️');
  }
  assert.ok(seen > 0);
});

test('your known leak is written to you and tagged [YOUR LOG]', async () => {
  const { knownLeakForYou } = await import('../js/feedback/engine.js');
  const kl = brain.knownLeaks.find((k) => /loses above it/i.test(k.title));
  assert.ok(kl);
  const k = knownLeakForYou(kl, brain.knownLeaksFrom);
  assert.equal(k.title, 'you win at 1/2, lose above it');
  assert.doesNotMatch(k.text, /Bring this up|\bshe\b/);
  assert.match(k.text, /\$1\/2: \+\$5,493/);
  assert.match(k.tag, /^\[YOUR LOG\] project-instructions\.md › Known leaks \(Jul 3/);
});

// Every [HHP] tag on screen must point at a real brain file and a heading in it, and quoted
// text next to it must be in that file: no [HHP] on content that isn't from the brain.
test('[HHP] tags only sit on brain content', () => {
  const norm = (t) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ');
  let tags = 0;
  for (const { s, fb } of hands) {
    const html = feedbackHTML(s, fb, { gradeHTML: () => '' }).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    for (const m of html.matchAll(/(?:“([^”]{12,})”\s*(?:<[^>]+>\s*)*)?\[HHP\]\s+([\w.-]+\.md)\s+›\s+([^<·(\n]+)/g)) {
      tags++;
      const [, quote, file, section] = m;
      const text = brainTexts[file];
      assert.ok(text, `[HHP] tag names ${file}, which isn't a brain file`);
      const sec = section.trim().split(' › ').pop().replace(/([^\d\s])\.(\s.*)?$/, '$1'); // inline tag ends at its sentence
      assert.ok(norm(text).includes(norm(sec)), `${file} has no section "${sec}"`);
      if (quote) for (const part of quote.split(/\s*…\s*|\.\.\./)) if (part.length > 12) assert.ok(norm(text).includes(norm(part).replace(/^"|"$/g, '')), `quote not in ${file}: ${part.slice(0, 60)}`);
    }
  }
  assert.ok(tags > 50, `only ${tags} tags checked`);
});
