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
import { brainHash, loadFixtures, htmlText } from './fixture-utils.mjs';

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
