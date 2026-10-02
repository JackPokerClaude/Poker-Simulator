// The coach-voice feedback screen. Same feedback object, same order, same grids, tables and
// numbers as the plain view (render.js); the words around them are spoken by voice.js.
// Pure string building (no DOM access).
import { esc, step, alsoHTML, optionHTML, numbersHTML, classInfoHTML, setRulings, ord, pct } from './render.js';
import { gridHTML, comboList } from '../ui/grid.js';
import { CLASS_KEYS, CLASS_LABEL } from '../range/classes.js';
import { cardsPretty } from '../engine/cards.js';
import { voiceFor, HTML, openerText, villainPhrase, rangeQuestion, preflopRangeText, streetRangeText, bucketsText, changeText, whyText, widenText, claimText, versusText } from './voice.js';
import { coachReport } from './coach-report.js';
import { involvedVillains, effectiveStack, describeAction } from '../engine/coach.js';
import { typeLabel, styleLabel } from '../villains/model.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// a) The opener: the scene, read the way a coach starts a hand review.
export function openerData(h, fb) {
  const hero = h.players[h.heroIdx];
  const first = h.log.find((e) => e.street === 'preflop' && !['post', 'deal', 'fold'].includes(e.type) && e.i !== h.heroIdx);
  const last = fb.streets.length ? fb.streets[fb.streets.length - 1].street : 'preflop';
  return {
    stakes: `$${h.stakes.sb}/$${h.stakes.bb}`, heroPos: hero.pos, heroCards: cardsPretty(hero.cards),
    effBB: `${Math.round(effectiveStack(h) / h.stakes.bb)}bb`,
    villains: [...involvedVillains(h)].sort((a, b) => (b.i === fb.preflop.villain) - (a.i === fb.preflop.villain)).map((p, k) => villainPhrase(p, typeLabel, styleLabel, { short: k > 0 })),
    first: first ? describeAction(h, first) : null,
    reach: last,
  };
}

// b) His range at a decision: the question, the read, each thing he did and why, the seven
// buckets, where you stand; the grid itself is unchanged, one tap away.
const line = (s, cls = 'fb-line') => (s ? `<div class="${cls}">${s}</div>` : '');
function rangeStepVoice(pt, pos, v, slot) {
  const f = HTML;
  const out = [];
  if (pt.para && pt.street === 'preflop') out.push(line(preflopRangeText(f, v, slot, pt.para), 'fb-p'));
  else if (pt.para) out.push(line(streetRangeText(f, v, slot, pt.para), 'fb-p'));
  else out.push(line(esc(pt.paragraph || ''), 'fb-p'));
  if (pt.changes?.length) {
    out.push(`<div class="fb-sub2">${v.pick(`${slot}.chg`, ['What he did, and what it tells you', `How ${esc(pos)}'s range got here`, 'Each move he made'])}</div>`);
    pt.changes.forEach((c, n) => {
      const moved = c.before ? CLASS_KEYS.filter((k) => Math.abs((c.after[k] || 0) - (c.before[k] || 0)) >= 0.02).map((k) => `${CLASS_LABEL[k]} ${pct(c.before[k])} → ${pct(c.after[k])}`) : [];
      const cs = `${slot}.c${n}`;
      out.push(`<div class="chg"><div>${changeText(f, v, cs, c, moved)}</div><div class="chg-why">${whyText(f, v, cs, c.reason)}</div>${c.reason.widen ? `<div class="chg-why">${widenText(f, c.reason.widen)}</div>` : ''}${numbersHTML(c.reason.numbers)}${(c.claims || []).map((x) => `<div class="${x.ok ? 'chg-ok' : 'chg-bad'}">${claimText(f, x)}</div>`).join('')}${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</div>`);
    });
  }
  if (pt.grid?.mode === 'class') out.push(line(bucketsText(f, v, slot, pt.shares, CLASS_KEYS)));
  if (pt.versus) out.push(line(versusText(f, v, slot, pt.versus, pct)));
  const g = pt.grid;
  if (g) out.push(`<details class="fb-grid"><summary>${v.pick(`${slot}.gs`, ['Show his range grid', 'His range, cell by cell', 'Tap for the range grid'])} · ${esc(g.combos)}</summary>${gridHTML(g.cells, { mode: g.mode, shares: g.shares, combosLeft: g.combos, detail: (code) => comboList(code, g.detail), classInfo: classInfoHTML })}</details>`);
  return out.join('');
}

function preflopSectionHTML(h, fb, v, gradeHTML) {
  const pre = fb.preflop;
  const qs = pre.questions;
  const qHTML = `<ol class="fb-q">${qs.list.map((x) => `<li><b>${esc(x.q)}</b> ${esc(x.a || '')}</li>`).join('')}</ol><div class="tag">${esc(qs.tag)}</div>${qs.extra.map((x) => `<div class="fb-line"><b>${esc(x.q)}</b> ${esc(x.a)} <span class="tag">${esc(x.tag)}</span></div>`).join('')}`;
  const points = pre.points.map((pt, k) => {
    const pos = pt.vi != null ? h.players[pt.vi].pos : null;
    const range = pos ? rangeStepVoice(pt, pos, v, `pre${k}`) : `<div class="fb-line muted">${esc(v.pick('pre.nobody', ["Nobody's put money in yet, so everyone behind you still has a full range.", 'Nobody has put money in yet: everyone behind you has a full range.']))}</div>`;
    const conflictNote = pre.conflicted ? '<div class="fb-line"><b>⚖ Not graded:</b> this spot is an open conflict in your playbook (below). The chart grade is shown for reference only.</div>' : '';
    return `<div class="fb-dec"><div class="fb-dh">${k === 0 ? 'Your decision' : 'Then'}${pt.grade ? `: you ${esc(String(pt.grade.heroAction || pt.grade.action).toLowerCase())}` : ''}</div>
      ${step(1, pos ? esc(rangeQuestion(v, `pre${k}.q`, pos)) : 'Who is in?', range)}
      ${k === 0 ? step(2, 'The questions to ask here', qHTML) : ''}
      ${step(k === 0 ? 3 : 2, 'Your action', `${conflictNote}${pt.grade ? gradeHTML(pt.grade) : '<div class="fb-line muted">No chart grade for this decision.</div>'}`)}
      ${k === 0 ? step(4, 'Something else worth remembering', alsoHTML(pre.also)) : ''}</div>`;
  }).join('') || '<div class="fb-line muted">No preflop decision.</div>';
  return `<section class="fb-sec"><h3>Preflop${pre.villain != null ? ` · vs ${esc(h.players[pre.villain].pos)}` : ''}</h3>${points}</section>`;
}

function decisionHTML(pt, h, k, v) {
  const a = pt.analysis;
  const pos = h.players[pt.vi].pos;
  const slot = `${pt.street}${k}`;
  const head = k === 0 ? `Your decision${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}` : `Then${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}`;
  if (!a) return `<div class="fb-dec"><div class="fb-dh">No decision for you on this street</div>${step(1, esc(rangeQuestion(v, `${slot}.q`, pos)), rangeStepVoice(pt, pos, v, slot))}</div>`;
  const wIf = a.opts.map((o) => optionHTML({ ...o, open: false })).join('');
  const actualExtra = a.opts.includes(a.actual) ? '' : optionHTML({ ...a.actual, title: `What you did: ${a.actual.title}` });
  const verdictSize = a.verdict.size ? `<div class="fb-line"><b>Size:</b> his range is ${esc(a.verdict.size.why)}. “${esc(a.verdict.size.quote)}” <span class="tag">${esc(a.verdict.size.tag)}</span></div>` : '';
  return `<div class="fb-dec"><div class="fb-dh">${head}</div>
    ${step(1, esc(rangeQuestion(v, `${slot}.q`, pos)), rangeStepVoice(pt, pos, v, slot))}
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
  return `<div class="fb-voice"><div class="fb-open">${openerText(HTML, v, openerData(h, fb))}</div><div class="resultbox">${esc(resultLine)}</div>
    <h3>Hands</h3><div class="hands-grid">${handsHTML}</div>
    ${preflopSectionHTML(h, fb, v, gradeHTML)}${streets}${endSectionHTML(fb)}</div>`;
}

// Copy for coach in the voice: the hand data plus the spoken review.
export function voiceCoachReport(h, fb, rulings = {}) {
  return coachReport(h, fb, rulings);
}
