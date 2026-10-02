// The voice layer: the fixture hands in tests/fixtures/hands.json are the "before". The plain
// view must stay exactly what it was; the voice view must carry every number, size, %, date,
// grade mark and source tag of the plain view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { model, brainTexts } from './setup.mjs';
import { buildFeedback } from '../js/feedback/engine.js';
import { feedbackHTML, mdHTML } from '../js/feedback/render.js';
import { coachReport } from '../js/feedback/coach-report.js';
import { gradeHTML } from '../js/feedback/preflop-card.js';
import { rebuildHand } from '../js/feedback/replay.js';
import { loadBrain, memoryLastGood } from '../js/brain/loader.js';
import { brainHash, loadFixtures, htmlText, missingTokens, missingTags } from './fixture-utils.mjs';
import { voiceFeedbackHTML, voiceCoachReport } from '../js/feedback/voice-render.js';

const manifest = JSON.parse(readFileSync(new URL('../config/brain-files.json', import.meta.url), 'utf8'));
const brain = await loadBrain({ manifest, fetchText: async (p) => brainTexts[p.replace('brain/', '')], lastGood: memoryLastGood() });
const FX = loadFixtures();
const noCR = (t) => t.replace(/\r/g, '');
// The one label change since the snapshot: chart notes no longer name a coach ("(Mark)" shows as "(HHP)").
const relabel = (t) => t.replace(/\((?:Mark|Marc)\)/g, '(HHP)');
const sameBrain = FX.brainHash === brainHash();
const varied = FX.varied.map((x) => { const h = rebuildHand(x.replay); return { ...x, h, fb: buildFeedback(h, { model, brain }) }; });

test('fixtures: the plain view and Copy for coach are unchanged from the snapshot (same brain)', { skip: sameBrain ? false : 'brain changed since the snapshot: matched rules may differ' }, () => {
  assert.ok(varied.length >= 15);
  for (const x of varied) {
    assert.equal(htmlText(feedbackHTML(x.h, x.fb, { gradeHTML })), relabel(x.plainText), `${x.why}: plain view changed`);
    assert.equal(noCR(coachReport(x.h, x.fb)), relabel(noCR(x.coachText)), `${x.why}: plain coach text changed`);
  }
});

const voiceText = (x) => htmlText(voiceFeedbackHTML(x.h, x.fb, { gradeHTML }));
const plainText = (x) => htmlText(feedbackHTML(x.h, x.fb, { gradeHTML }));

test('voice: every number, size, %, date, grade mark and source tag of the plain view survives', () => {
  for (const x of varied) {
    const p = plainText(x), vt = voiceText(x);
    const miss = [...missingTokens(p, vt), ...missingTags(x.fb, p, vt)];
    assert.deepEqual(miss, [], `${x.why}: missing in the voice view`);
  }
});

test('voice: Copy for coach carries every number, %, date, mark and tag of the plain coach text', () => {
  for (const x of varied) {
    const p = coachReport(x.h, x.fb), vt = voiceCoachReport(x.h, x.fb);
    const miss = [...missingTokens(p, vt), ...missingTags(x.fb, p, vt)];
    assert.deepEqual(miss, [], `${x.why}: missing in the voice coach text`);
  }
});

test('voice: the same hand always reads the same way (seeded by the deal)', () => {
  for (const x of varied.slice(0, 5)) {
    const again = rebuildHand(x.replay);
    assert.equal(voiceFeedbackHTML(again, buildFeedback(again, { model, brain }), { gradeHTML }).replace(/data-grid="g\d+"/g, ''), voiceFeedbackHTML(x.h, x.fb, { gradeHTML }).replace(/data-grid="g\d+"/g, ''));
  }
});

test('voice: every postflop decision keeps the five steps in order', () => {
  let decs = 0;
  for (const x of varied) {
    const html = voiceFeedbackHTML(x.h, x.fb, { gradeHTML });
    for (const block of html.split('<div class="fb-dec">').slice(1)) {
      if (!block.includes('What happens if')) continue;
      decs++;
      const ks = [/range\?/, /What happens if/, /Your action/, /The verdict/, /Something else worth remembering/].map((re) => block.search(re));
      assert.ok(ks.every((k, n) => k >= 0 && (n === 0 || k > ks[n - 1])), `${x.why}: five steps in order`);
    }
  }
  assert.ok(decs > 10, `only ${decs} decisions`);
});

const forty = FX.forty.map((x) => { const h = rebuildHand(x.replay); return { ...x, h, fb: buildFeedback(h, { model, brain }) }; });

test('voice: across 40 hands no opening phrase is used for more than 25% of hands', () => {
  const firsts = {};
  for (const x of forty) {
    const html = voiceFeedbackHTML(x.h, x.fb, { gradeHTML });
    const open = htmlText(/<div class="fb-open">([\s\S]*?)<\/div>/.exec(html)[1]);
    const first = open.split(/(?<=[.!?])\s/)[0];
    firsts[first] = (firsts[first] || 0) + 1;
  }
  const [top, n] = Object.entries(firsts).sort((a, b) => b[1] - a[1])[0];
  assert.ok(n / forty.length <= 0.25, `"${top}" opens ${n} of ${forty.length} hands`);
  assert.ok(Object.keys(firsts).length >= 6, 'at least 6 different openers');
});

test('no coach is named in app-written text (chart notes show "(HHP)")', () => {
  for (const x of varied) for (const html of [feedbackHTML(x.h, x.fb, { gradeHTML }), voiceFeedbackHTML(x.h, x.fb, { gradeHTML })]) {
    assert.doesNotMatch(html, /\((?:Mark|Marc)\)|Mark's rule|Marc's/, x.why);
  }
});

const WINNER = /\b(wins?|winner|winning view|better (one|view|line)|the right (one|view)|go with|prefer|stronger (one|view)|is correct|is wrong|should follow|trust (this|that|the first|the second)|but\b)/i;
test('voice: every ⚖ / ♣ box shows both views and the dated playbook text, and its own words pick no winner', () => {
  let boxes = 0;
  for (const x of varied) {
    const html = voiceFeedbackHTML(x.h, x.fb, { gradeHTML });
    const shown = [...html.matchAll(/<details class="fb-conflict">([\s\S]*?)<\/details>/g)].map((m) => m[1]);
    const cs = [...(x.fb.preflop.also?.conflicts || []), ...x.fb.streets.flatMap((s) => s.points.flatMap((p) => p.analysis?.also.conflicts || []))];
    assert.equal(shown.length, cs.length, `${x.why}: one box per conflict`);
    cs.forEach((c, k) => {
      boxes++;
      const box = shown[k];
      assert.ok((box.match(/class="fb-view"/g) || []).length >= 2, `${x.why}: both views listed`);
      const src = c.block || c.open;
      if (src) assert.ok(htmlText(box).includes(htmlText(mdHTML(src.text))), `${x.why}: the playbook text in full`);
      for (const d of src?.dates || []) assert.ok(box.includes(d), `${x.why}: date ${d}`);
      const glue = htmlText(box.replace(/<div class="fb-cbody">[\s\S]*?<\/div><div class="tag">/, '<div class="tag">').replace(/<li class="fb-view">[\s\S]*?<\/li>/g, '').replace(/<div class="tag">[\s\S]*?<\/div>/g, '').replace(/<summary>[\s\S]*?\(not graded\):/, '<summary>'));
      assert.doesNotMatch(glue.split(c.title).join(''), WINNER, `${x.why}: the voice leans: ${glue}`);
    });
  }
  assert.ok(boxes >= 5, `only ${boxes} conflict boxes in the fixtures`);
});

test('voice: [YOUR LOG] never turns into [HHP], and [OUTSIDE SOURCE] items keep their label', () => {
  for (const x of varied) {
    const t = htmlText(voiceFeedbackHTML(x.h, x.fb, { gradeHTML }));
    for (const k of x.fb.end.known) {
      assert.ok(t.includes(k.tag) && k.tag.startsWith('[YOUR LOG]'), x.why);
      assert.ok(!t.includes(k.tag.replace('[YOUR LOG]', '[HHP]')), `${x.why}: known leak relabeled`);
    }
    const p = htmlText(feedbackHTML(x.h, x.fb, { gradeHTML }));
    const n = (s, re) => (s.match(re) || []).length;
    assert.ok(n(t, /\[OUTSIDE SOURCE\]/g) >= n(p, /\[OUTSIDE SOURCE\]/g), `${x.why}: an [OUTSIDE SOURCE] label went missing`);
    assert.ok(n(t, /\[YOUR LOG\]/g) === n(p, /\[YOUR LOG\]/g), `${x.why}: [YOUR LOG] count changed`);
  }
});

test('voice Copy for coach: hand facts, then per decision his range, options, your action, verdict (with source), leak tags', () => {
  for (const x of [...varied, ...forty.slice(0, 10)]) {
    const t = voiceCoachReport(x.h, x.fb);
    assert.ok(t.startsWith('Stakes / venue:') && t.includes('PREFLOP') && t.includes('Takeaway: ') && t.includes('Result: '), x.why);
    for (const st of x.fb.streets) {
      const at = t.indexOf(`\n${st.street.toUpperCase()} `);
      assert.ok(at > 0, `${x.why}: ${st.street} missing`);
      const block = t.slice(at, t.indexOf('\n\n', at + 1) >>> 0);
      for (const pt of st.points) {
        if (!pt.analysis) continue;
        for (const re of [/His range/, /Options weighed/, /Your action: /, /Verdict: /, /Leak tags: /]) assert.match(block, re, `${x.why} ${st.street}: ${re}`);
        assert.ok(block.includes(pt.analysis.verdict.source), 'verdict carries its source');
      }
    }
  }
});
