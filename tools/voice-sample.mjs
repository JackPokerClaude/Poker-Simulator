// Prints coach-voice reviews of fixture hands, one line per block, grids left out.
//   node tools/voice-sample.mjs [indexes, e.g. 0,3,6] [--forty] [--coach]
import { model, brainTexts } from '../tests/setup.mjs';
import { readFileSync } from 'node:fs';
import { buildFeedback } from '../js/feedback/engine.js';
import { rebuildHand } from '../js/feedback/replay.js';
import { loadBrain, memoryLastGood } from '../js/brain/loader.js';
import { loadFixtures } from '../tests/fixture-utils.mjs';
import { voiceFeedbackHTML, voiceCoachReport } from '../js/feedback/voice-render.js';
import { gradeHTML } from '../js/feedback/preflop-card.js';

const manifest = JSON.parse(readFileSync(new URL('../config/brain-files.json', import.meta.url), 'utf8'));
const brain = await loadBrain({ manifest, fetchText: async (p) => brainTexts[p.replace('brain/', '')], lastGood: memoryLastGood() });
const args = process.argv.slice(2);
const set = args.includes('--forty') ? loadFixtures().forty : loadFixtures().varied;
const which = (args.find((a) => /^\d/.test(a)) || '0').split(',').map(Number);
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const text = (html) => html
  .replace(/<details class="fb-grid">[\s\S]*?<\/details>/g, '[grid]')
  .replace(/<details class="fb-nums">[\s\S]*?<\/details>/g, '[numbers]')
  .replace(/<\/(div|li|summary|h3|section|tr|details)>/g, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENT[m])
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
for (const k of which) {
  const x = set[k];
  const h = rebuildHand(x.replay);
  const fb = buildFeedback(h, { model, brain });
  console.log(`===== ${x.why}`);
  console.log(args.includes('--coach') ? voiceCoachReport(h, fb) : text(voiceFeedbackHTML(h, fb, { gradeHTML })));
}
