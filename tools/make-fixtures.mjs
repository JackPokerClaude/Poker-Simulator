// Builds tests/fixtures/hands.json: about 15 varied hands (every street, folds/calls/raises,
// close calls, OOP realization, conflicts, split brain lines, the known-leak card, every villain
// type) plus a fixed 40-hand set, each saved as a replay with the feedback it produced the day
// it was captured (plain screen text + Copy for coach). These are the "before" for the voice
// layer's content tests.  Run: node tools/make-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { ranges, model, brainTexts } from '../tests/setup.mjs';
import { playOut } from '../tests/sim.mjs';
import { createHand } from '../js/engine/dealer.js';
import { buildFeedback } from '../js/feedback/engine.js';
import { feedbackHTML } from '../js/feedback/render.js';
import { coachReport } from '../js/feedback/coach-report.js';
import { gradeHTML } from '../js/feedback/preflop-card.js';
import { packReplay, rebuildHand } from '../js/feedback/replay.js';
import { loadBrain, memoryLastGood } from '../js/brain/loader.js';
import { brainHash, htmlText } from '../tests/fixture-utils.mjs';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/brain-files.json', import.meta.url), 'utf8'));
const brain = await loadBrain({ manifest, fetchText: async (p) => brainTexts[p.replace('brain/', '')], lastGood: memoryLastGood() });

function tagsOf(s, fb) {
  const t = new Set();
  const pts = fb.streets.flatMap((x) => x.points).filter((p) => p.analysis);
  const last = fb.streets.length ? fb.streets[fb.streets.length - 1].street : 'preflop';
  t.add(`ends-${last}`);
  for (const d of s.heroDecisions || []) { t.add(`pre-${d.verdict}`); t.add(`pre-act-${d.action}`); }
  if (fb.preflop.conflicted) t.add('pre-conflict');
  for (const p of pts) {
    const a = p.analysis;
    t.add(`${a.street}-${a.actual.line}`);
    t.add(`grade-${a.grade.mark}`);
    if (a.grade.close) t.add('close-call');
    if (a.grade.sizing) t.add('sizing-grade');
    if (a.real < 1) t.add('oop-realization');
    if (a.also.conflicts.length) t.add('conflict');
    if (a.also.conflicts.some((c) => c.kind === 'open')) t.add('open-question');
    if (a.verdict.split) t.add('split');
    if (a.verdict.size) t.add('sized-verdict');
    if (a.verdict.rule) t.add('brain-verdict');
    if (a.multiway) t.add('multiway');
    if (a.also.catalog) t.add('catalog');
    if (a.opts.some((o) => o.look)) t.add('lookahead');
    t.add(`vtype-${s.players[p.vi].type}`);
  }
  if (fb.preflop.villain != null) t.add(`vtype-${s.players[fb.preflop.villain].type}`);
  if (fb.end.known.length) t.add('known-leak');
  if (fb.end.leaks.length) t.add('leaks');
  if ((s.heroDecisions || []).some((d) => (d.sizing || []).length)) t.add('pre-sizing');
  return t;
}

const pool = [];
const drills = ['random', 'bigpots', 'threebet', 'multiway', 'limpers', 'blinds'];
for (let n = 0; n < 2500; n++) {
  const drill = drills[n % drills.length];
  let s;
  try { s = playOut(createHand({ drill, ranges })); } catch { continue; }
  const fb = buildFeedback(s, { model, brain });
  pool.push({ s, fb, tags: tagsOf(s, fb), drill });
}

// Greedy cover: each pick adds the most tags not covered yet.
const want = new Set(pool.flatMap((x) => [...x.tags]));
const picked = [];
const covered = new Set();
while (picked.length < 15) {
  let best = null, gain = -1;
  for (const x of pool) {
    if (picked.includes(x)) continue;
    const g = [...x.tags].filter((t) => !covered.has(t)).length;
    if (g > gain) { gain = g; best = x; }
  }
  if (!best) break;
  picked.push(best);
  for (const t of best.tags) covered.add(t);
}
const forty = pool.filter((x) => !picked.includes(x)).slice(0, 40);

const snap = (x, why) => {
  const replay = JSON.parse(JSON.stringify(packReplay(x.s)));
  const h = rebuildHand(replay);
  const fb = buildFeedback(h, { model, brain });
  return {
    why, drill: x.drill, tags: [...x.tags].sort(), replay,
    plainText: htmlText(feedbackHTML(h, fb, { gradeHTML })),
    coachText: coachReport(h, fb),
  };
};
const out = {
  captured: new Date().toISOString().slice(0, 10),
  brainHash: brainHash(),
  note: 'Before snapshots for the voice layer. plainText/coachText are only compared while brainHash matches the brain on disk (a brain update changes matched rules, which is fine).',
  varied: picked.map((x, k) => snap(x, `varied #${k + 1}`)),
  forty: forty.map((x, k) => ({ why: `forty #${k + 1}`, drill: x.drill, replay: JSON.parse(JSON.stringify(packReplay(x.s))) })),
};
mkdirSync(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
writeFileSync(new URL('../tests/fixtures/hands.json', import.meta.url), JSON.stringify(out));
console.log(`varied ${out.varied.length}, forty ${out.forty.length}; tags not covered: ${[...want].filter((t) => !covered.has(t)).join(', ') || 'none'}`);
for (const v of out.varied) console.log(v.why, v.tags.join(' '));
