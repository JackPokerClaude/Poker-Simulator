// The voice layer: the fixture hands in tests/fixtures/hands.json are the "before". The plain
// view must stay exactly what it was; the voice view must carry every number, size, %, date,
// grade mark and source tag of the plain view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { model, brainTexts } from './setup.mjs';
import { buildFeedback } from '../js/feedback/engine.js';
import { feedbackHTML } from '../js/feedback/render.js';
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
const sameBrain = FX.brainHash === brainHash();
const varied = FX.varied.map((x) => { const h = rebuildHand(x.replay); return { ...x, h, fb: buildFeedback(h, { model, brain }) }; });

test('fixtures: the plain view and Copy for coach are unchanged from the snapshot (same brain)', { skip: sameBrain ? false : 'brain changed since the snapshot: matched rules may differ' }, () => {
  assert.ok(varied.length >= 15);
  for (const x of varied) {
    assert.equal(htmlText(feedbackHTML(x.h, x.fb, { gradeHTML })), x.plainText, `${x.why}: plain view changed`);
    assert.equal(noCR(coachReport(x.h, x.fb)), noCR(x.coachText), `${x.why}: plain coach text changed`);
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
