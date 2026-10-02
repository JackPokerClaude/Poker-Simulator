// The preflop card: ✅/⚠️/❌ with a one-line reason, the chart, your action, the chart message,
// the mix and the sizing checks. Pure string building, shared by the feedback screen, History
// and the tests.
import { preflopMark, noCoachName } from './marks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const VERDICT_LABEL = { correct: '✓ Chart play', mixed: '≈ Mixed', wrong: '✗ Off chart', situational: '⚑ Situational', nochart: '— No chart' };
export const OUTSIDE_LABEL = { correct: '✓ Good', mixed: '≈ Borderline', wrong: '✗ Mistake', situational: '⚑ Situational', nochart: '— No chart' };

// ✅/⚠️/❌ and a one-line reason for a preflop grade ("Chart 3-bets J9s 100% here").
export function gradeHTML(d) {
  const sizing = (d.sizing || []).map((z) => `<div class="sizing ${z.ok ? 'ok' : 'bad'}"><span class="ic">${z.ok ? '✓' : '✗'}</span><span><b>${esc(z.rule)}:</b> ${esc(z.message)}</span></div>`).join('');
  const chartLine = d.sourceTag
    ? `<span class="src ${d.source === 'OUTSIDE' ? 'outside' : 'hhp'}">${esc(d.sourceTag)}</span>`
    : d.chart ? esc(d.chart) : 'No HHP chart';
  const msg = d.verdict === 'situational' ? `<b>HHP's rule:</b> ${esc(noCoachName(d.message).replace(/^SITUATIONAL \(HHP\):\s*/i, ''))}` : esc(noCoachName(d.message));
  return `<div class="grade">
    <div class="row1"><div class="spot">${esc(d.label)}</div><span class="badge ${d.verdict}">${(d.source === 'OUTSIDE' ? OUTSIDE_LABEL : VERDICT_LABEL)[d.verdict]}</span></div>
    <div class="pmark">${preflopMark(d).mark} ${esc(preflopMark(d).reason)}</div>
    <div class="chart">${chartLine}</div>
    <div class="you">You: <b>${esc(d.heroAction || d.action)}${d.to ? ` $${d.to}` : ''}</b> with <b>${esc(d.code)}</b></div>
    <div class="msg">${msg}</div>
    ${d.freq && d.verdict !== 'wrong' ? `<div class="freq">Chart: ${esc(d.freq)}</div>` : ''}
    ${sizing}
  </div>`;
}
