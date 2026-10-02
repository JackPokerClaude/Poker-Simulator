// Phone-size pass for the feedback sheet (dev tool, not deployed). Plays N random hands, renders
// each one's feedback (coach voice or plain) in the real sheet, opens every collapsed section,
// and checks: no sideways scroll, nothing cut off with an ellipsis, no undefined/NaN/null text,
// no [HHP] tag without a source, and the quick take (every verdict) inside the first screen.
// Results land in window.__phone (and on the page).
import { loadBrain, browserFetchText, memoryLastGood, missingCharts } from '../js/brain/loader.js';
import { buildModel, setModel, setCharts } from '../js/villains/model.js';
import { CHARTS_USED } from '../js/engine/scenario.js';
import { createHand, heroAct, villainAct } from '../js/engine/dealer.js';
import { legalActions, dealNextStreet, potTotal } from '../js/engine/game.js';
import { rand } from '../js/engine/cards.js';
import { buildFeedback } from '../js/feedback/engine.js';
import { feedbackHTML } from '../js/feedback/render.js';
import { voiceFeedbackHTML } from '../js/feedback/voice-render.js';
import { gradeHTML } from '../js/feedback/preflop-card.js';
import { winnerLine } from '../js/engine/coach.js';

const q = new URLSearchParams(location.search);
const N = Number(q.get('n') || 40);
const view = q.get('view') || 'voice';
const DRILLS = ['random', 'bigpots', 'blinds', 'limpers', 'threebet', 'multiway'];

function policy(s) {
  const la = legalActions(s);
  const r = rand();
  if (la.canRaise && r < 0.3) return { type: la.isBet ? 'bet' : 'raise', to: Math.min(la.maxTo, Math.max(la.minTo, Math.round(s.currentBet * 3 || potTotal(s) * 0.6))) };
  if (la.canCheck) return { type: 'check' };
  return r < 0.75 ? { type: 'call' } : { type: 'fold' };
}

const manifest = await (await fetch('../config/brain-files.json')).json();
const brain = await loadBrain({ manifest: { ...manifest, files: manifest.files.map((f) => ({ ...f })) }, fetchText: (p) => browserFetchText(`../${p}`), lastGood: memoryLastGood() });
const compiled = await (await fetch('../brain-compiled/behavior.json')).json();
const model = buildModel(compiled, brain.texts);
setModel(model);
Object.assign(brain.charts.charts, model.charts);
brain.missing = missingCharts(brain, CHARTS_USED);
const ranges = brain.charts;
setCharts(ranges);

const body = document.getElementById('sheetBody');
const results = [];
for (let n = 0; n < N; n++) {
  const s = createHand({ drill: DRILLS[n % DRILLS.length], ranges });
  let guard = 0;
  while (!s.done && guard++ < 500) {
    if (s.awaitingDeal) { dealNextStreet(s); continue; }
    if (s.toAct === s.heroIdx) heroAct(s, policy(s), ranges); else villainAct(s);
  }
  const t0 = performance.now();
  const fb = buildFeedback(s, { model, brain });
  const render = view === 'voice' ? voiceFeedbackHTML : feedbackHTML;
  body.innerHTML = `<div class="sheet-top"><h2>Hand feedback</h2><div class="seg fb-view"><button class="on">Coach</button><button>Plain</button></div><button class="close">✕</button></div>${render(s, fb, { resultLine: winnerLine(s, true), handsHTML: '', gradeHTML })}`;
  const ms = performance.now() - t0;
  body.scrollTop = 0;
  const quick = body.querySelector('.fb-quick');
  const quickBottom = quick ? quick.getBoundingClientRect().bottom - body.getBoundingClientRect().top : null;
  body.querySelectorAll('details').forEach((d) => { d.open = true; });
  const bad = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) bad.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  if (body.scrollWidth > body.clientWidth + 1) bad.push(`sheet scrolls sideways (${body.scrollWidth} > ${body.clientWidth})`);
  for (const el of body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) bad.push(`cut off: ${el.className} "${el.textContent.slice(0, 40)}"`);
    const r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 1 && !el.closest('.mdt, .fb-bt')) { bad.push(`sticks out: ${el.tagName}.${el.className} (${Math.round(r.right)}px)`); break; }
  }
  const text = body.innerText;
  if (/\bundefined\b|\bNaN\b|\bnull\b/.test(text)) bad.push(`bad text: ${/.{0,30}(undefined|NaN|null).{0,30}/.exec(text)[0]}`);
  if (/\[HHP\](?!\s+\S)/.test(text)) bad.push('[HHP] tag without a source');
  if (view === 'voice' && quick && quickBottom > window.innerHeight) bad.push(`quick take ends below the first screen (${Math.round(quickBottom)}px)`);
  results.push({ n, drill: DRILLS[n % DRILLS.length], ms: Math.round(ms), chars: text.length, quickBottom: quickBottom && Math.round(quickBottom), bad });
}
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
window.__phone = {
  view, n: N, width: document.documentElement.clientWidth, height: window.innerHeight,
  problems: results.filter((r) => r.bad.length),
  medianMs: ms[Math.floor(ms.length / 2)], p90Ms: ms[Math.floor(ms.length * 0.9)], worstMs: ms[ms.length - 1],
  medianChars: results.map((r) => r.chars).sort((a, b) => a - b)[Math.floor(N / 2)],
  worstQuick: Math.max(...results.map((r) => r.quickBottom || 0)),
};
document.title = `done: ${window.__phone.problems.length} problem hands`;
console.log(JSON.stringify(window.__phone));
