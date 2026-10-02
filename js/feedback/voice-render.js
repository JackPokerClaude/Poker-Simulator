// The coach-voice feedback screen. Same feedback object, same order, same grids, tables and
// numbers as the plain view (render.js); the words around them are spoken by voice.js.
// Pure string building (no DOM access).
import { esc, step, alsoHTML, optionHTML, rangeStepHTML, setRulings, ord, pct } from './render.js';
import { cardsPretty } from '../engine/cards.js';
import { voiceFor } from './voice.js';
import { coachReport } from './coach-report.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

function preflopSectionHTML(h, fb, v, gradeHTML) {
  const pre = fb.preflop;
  const qs = pre.questions;
  const qHTML = `<ol class="fb-q">${qs.list.map((x) => `<li><b>${esc(x.q)}</b> ${esc(x.a || '')}</li>`).join('')}</ol><div class="tag">${esc(qs.tag)}</div>${qs.extra.map((x) => `<div class="fb-line"><b>${esc(x.q)}</b> ${esc(x.a)} <span class="tag">${esc(x.tag)}</span></div>`).join('')}`;
  const points = pre.points.map((pt, k) => {
    const pos = pt.vi != null ? h.players[pt.vi].pos : null;
    const range = pos ? rangeStepHTML(pt, pos) : `<div class="fb-line muted">${esc(pt.paragraph)}</div>`;
    const conflictNote = pre.conflicted ? '<div class="fb-line"><b>⚖ Not graded:</b> this spot is an open conflict in your playbook (below). The chart grade is shown for reference only.</div>' : '';
    return `<div class="fb-dec"><div class="fb-dh">${k === 0 ? 'Your decision' : 'Then'}${pt.grade ? `: you ${esc(String(pt.grade.heroAction || pt.grade.action).toLowerCase())}` : ''}</div>
      ${step(1, pos ? `What's ${esc(pos)}'s range?` : 'Who is in?', range)}
      ${k === 0 ? step(2, 'The questions to ask here', qHTML) : ''}
      ${step(k === 0 ? 3 : 2, 'Your action', `${conflictNote}${pt.grade ? gradeHTML(pt.grade) : '<div class="fb-line muted">No chart grade for this decision.</div>'}`)}
      ${k === 0 ? step(4, 'Something else worth remembering', alsoHTML(pre.also)) : ''}</div>`;
  }).join('') || '<div class="fb-line muted">No preflop decision.</div>';
  return `<section class="fb-sec"><h3>Preflop${pre.villain != null ? ` · vs ${esc(h.players[pre.villain].pos)}` : ''}</h3>${points}</section>`;
}

function decisionHTML(pt, h, k, v) {
  const a = pt.analysis;
  const pos = h.players[pt.vi].pos;
  const head = k === 0 ? `Your decision${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}` : `Then${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}`;
  if (!a) return `<div class="fb-dec"><div class="fb-dh">No decision for you on this street</div>${step(1, `What's ${esc(pos)}'s range?`, rangeStepHTML(pt, pos))}</div>`;
  const wIf = a.opts.map((o) => optionHTML({ ...o, open: false })).join('');
  const actualExtra = a.opts.includes(a.actual) ? '' : optionHTML({ ...a.actual, title: `What you did: ${a.actual.title}` });
  const verdictSize = a.verdict.size ? `<div class="fb-line"><b>Size:</b> his range is ${esc(a.verdict.size.why)}. “${esc(a.verdict.size.quote)}” <span class="tag">${esc(a.verdict.size.tag)}</span></div>` : '';
  return `<div class="fb-dec"><div class="fb-dh">${head}</div>
    ${step(1, `What's ${esc(pos)}'s range?`, rangeStepHTML(pt, pos))}
    ${step(2, 'What happens if…?', `${a.multiway ? '<div class="fb-line muted">Multiway: his answers treat him as next to act.</div>' : ''}<div class="fb-line">Your equity vs this range: <b>${pct(a.eq.total)}</b> (${a.eq.combos} combos, ${a.eq.exact ? 'exact' : `${a.eq.runouts} sampled runouts`}).</div>${wIf}${actualExtra}`)}
    ${step(3, 'Your action', `<div class="fb-line">${a.grade.mark} <b>You: ${esc(a.actual.title)}.</b> ${esc(a.grade.text)}</div>`)}
    ${step(4, 'The verdict', `<div class="fb-line"><b>${esc(a.verdict.title)}.</b> ${esc(a.verdict.why)} <span class="tag">${esc(a.verdict.source)}</span></div>${verdictSize}${a.verdict.split ? `<div class="fb-line"><b>Brain lines disagree here</b> (no ⚖ in the playbook), so the math decides: ${a.verdict.split.map((x) => `${esc(x.title)} → ${esc(x.line.toLowerCase())} <span class="tag">${esc(x.tag)}</span>`).join('; ')}.</div>` : ''}${a.verdict.math ? `<div class="fb-line muted">${esc(a.verdict.math)}</div>` : ''}`)}
    ${step(5, 'Something else worth remembering', alsoHTML(a.also))}</div>`;
}

function endSectionHTML(fb) {
  const e = fb.end;
  const leakHTML = e.leaks.length ? e.leaks.map((l) => `<span class="leak">${esc(l.tag)}${l.repeats ? ` <b>🔁 ${ord(l.repeats + 1)} time in your last 50 hands</b>` : ''}</span>`).join('') : '<span class="muted">No leaks this hand.</span>';
  return `<section class="fb-sec fb-end"><h3>End of hand</h3>
    <div class="fb-take">${esc(e.takeaway)}</div>
    <div class="fb-line"><b>Leak tags:</b> ${leakHTML}</div>
    ${e.known.map((k) => `<div class="fb-line"><b>Your known leak: ${esc(k.title)}.</b> ${esc(k.text)} <span class="tag">${esc(k.tag)}</span></div>`).join('')}
    ${e.whole.map((x) => `<details class="fb-more"><summary><b>For the whole hand:</b> ${esc(x.title)}</summary>${x.fields.map((f) => `<div class="fb-line"><b>${esc(f.name)}:</b> ${esc(f.text)}</div>`).join('')}<div class="tag">${esc(x.tag)}</div></details>`).join('')}
  </section>`;
}

export function voiceFeedbackHTML(h, fb, { resultLine = '', handsHTML = '', gradeHTML = () => '', rulings = {} } = {}) {
  setRulings(rulings);
  const v = voiceFor(h);
  const streets = fb.streets.map((s) => `<section class="fb-sec"><h3>${esc(`${cap(s.street)} ${cardsPretty(s.board)}`)}</h3>${s.points.map((pt, k) => decisionHTML(pt, h, k, v)).join('')}</section>`).join('');
  return `<div class="fb-voice"><div class="resultbox">${esc(resultLine)}</div>
    <h3>Hands</h3><div class="hands-grid">${handsHTML}</div>
    ${preflopSectionHTML(h, fb, v, gradeHTML)}${streets}${endSectionHTML(fb)}</div>`;
}

// Copy for coach in the voice: the hand data plus the spoken review.
export function voiceCoachReport(h, fb, rulings = {}) {
  return coachReport(h, fb, rulings);
}
