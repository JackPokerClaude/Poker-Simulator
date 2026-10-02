// Prints coach-voice reviews of fixture hands: node tools/voice-sample.mjs [indexes] [line regex] [chars]
import { model, brainTexts } from '../tests/setup.mjs';
import { readFileSync } from 'node:fs';
import { buildFeedback } from '../js/feedback/engine.js';
import { rebuildHand } from '../js/feedback/replay.js';
import { loadBrain, memoryLastGood } from '../js/brain/loader.js';
import { loadFixtures, htmlText } from '../tests/fixture-utils.mjs';
import { voiceFeedbackHTML } from '../js/feedback/voice-render.js';
import { gradeHTML } from '../js/feedback/preflop-card.js';
const manifest = JSON.parse(readFileSync(new URL('../config/brain-files.json', import.meta.url), 'utf8'));
const brain = await loadBrain({ manifest, fetchText: async (p) => brainTexts[p.replace('brain/', '')], lastGood: memoryLastGood() });
const which = process.argv[2] ? process.argv[2].split(',').map(Number) : [0, 3, 6];
const re = process.argv[3] ? new RegExp(process.argv[3]) : null;
for (const k of which) {
  const x = loadFixtures().varied[k]; const h = rebuildHand(x.replay); const fb = buildFeedback(h, { model, brain });
  let t = voiceFeedbackHTML(h, fb, { gradeHTML });
  t = t.replace(/<div class="gwrap[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '[GRID]');
  t = htmlText(t.replace(/<\/(div|li|summary|h3|section|tr)>/g, '\n$&'));
  console.log(`===== ${x.why}\n` + (re ? t.split('\n').filter((l) => re.test(l)).join('\n') : t.slice(0, +process.argv[4] || 1500)));
}
