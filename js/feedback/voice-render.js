// The coach-voice feedback screen. Same feedback object, same order, same grids, tables and
// numbers as the plain view (render.js); the words around them are spoken by voice.js.
// Pure string building (no DOM access).
import { esc, step, mdHTML, rulingNote, numbersHTML, classInfoHTML, setRulings, ord, pct, evText } from './render.js';
import { gridHTML, comboList } from '../ui/grid.js';
import { CLASSES, CLASS_KEYS, CLASS_LABEL } from '../range/classes.js';
import { cardsPretty } from '../engine/cards.js';
import {
  voiceFor, HTML, openerText, villainPhrase, rangeQuestion, preflopRangeText, streetRangeText, bucketsText, changeText, whyText, widenText, claimText, versusText,
  whatIfIntro, preflopReact, preflopYouText, preflopFreqText, preflopSizingText, knownLeakText, alsoIntro, alsoRuleText, alsoCatalogText, alsoNothing, gradeText, youDid, verdictText, sizeText, splitText, mathNoteText, quickTakeHead, optionTitle, optionSummary, classLines, whoDoesWhat, wantCallsText, nextText, lookHead, prosText, consText,
} from './voice.js';
import { coachReport } from './coach-report.js';
import { preflopMark, noCoachName } from './marks.js';
import { VERDICT_LABEL, OUTSIDE_LABEL } from './preflop-card.js';
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

// c) One option, spoken: if you do this, here's what he does, class by class, and what it's worth.
// The math lines and the strategy numbers are the engine's, unchanged, behind their own taps.
function optionVoice(o, v, slot, isActual = false) {
  const f = HTML;
  const body = [];
  const cl = classLines(f, o, CLASSES, pct);
  if (cl.length) body.push(`<div class="fb-line"><b>${esc(whoDoesWhat(v, slot))}</b></div><ul class="fb-cls">${cl.map((x) => `<li>${x}</li>`).join('')}</ul>`);
  if (o.wantCalls) body.push(line(wantCallsText(f, v, slot, o.wantCalls)));
  if (o.next) body.push(line(nextText(f, v, slot, o.next)));
  if (o.look) body.push(`<div class="fb-look">${line(lookHead(f, v, slot, o.look))}${o.look.lines.map((l) => line(esc(l))).join('')}<div class="tag">${esc(o.look.tag)}</div></div>`);
  if (o.pros?.length) body.push(line(prosText(f, v, slot, o.pros)));
  if (o.cons?.length) body.push(line(consText(f, v, slot, o.cons)));
  body.push(`<details class="fb-nums"><summary>${esc(v.pick(`${slot}.math`, ['Show the math', 'The math, step by step', 'How the EV adds up']))}</summary><div class="fb-math">${o.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div></details>`);
  if (o.numbers?.length) body.push(`<div class="fb-line muted">His answers come from his strategy for this style:</div>${numbersHTML(o.numbers)}`);
  body.push('<div class="tag">[OUTSIDE SOURCE] math vs his real range and his real strategy</div>');
  return `<details class="fb-opt"><summary><span class="ot"><b>${esc(optionTitle(o.title, isActual))}</b><span class="os">${esc(optionSummary(o, pct))}</span></span><span class="ev">EV ${esc(evText(o.ev))}</span></summary>${body.join('')}</details>`;
}

// f) Something else worth remembering: the other matching brain entries, then any ⚖ / ♣ boxes.
function alsoVoice(also, v, slot) {
  const f = HTML;
  const rules = (also?.rules || []).map((r) => `<div class="fb-also">${alsoRuleText(f, r)}</div>`);
  if (also?.catalog) rules.push(`<div class="fb-also">${alsoCatalogText(f, also.catalog)}</div>`);
  const conflicts = (also?.conflicts || []).map((c) => {
    const body = c.block ? mdHTML(c.block.text) : c.open ? mdHTML(c.open.text) : '';
    const src = c.block ? `[HHP] ${c.block.file} › ${c.block.section}${c.block.dates?.length ? ` · ${c.block.dates.join(', ')}` : ''}` : c.open ? `[HHP] ${c.open.file} · ♣ OPEN #${c.open.number}` : c.tag;
    return `<details class="fb-conflict"><summary>${c.kind === 'open' ? '♣ OPEN QUESTION' : '⚖ CONFLICT'} (not graded, both views): ${esc(c.title)}</summary>${rulingNote(c)}${body}<div class="tag">${esc(src)}</div></details>`;
  });
  if (!rules.length && !conflicts.length) return line(esc(alsoNothing(v, slot)), 'fb-line muted');
  return `${rules.length ? line(esc(alsoIntro(v, slot, rules.length))) : ''}${rules.join('')}${conflicts.join('')}`;
}

// h) The preflop card in the voice: mark + one-line reason first, then what you did, the chart,
// the chart's message, its mix and the sizing checks (everything the plain card has).
function preflopCardVoice(d, v, slot) {
  const f = HTML;
  const m = preflopMark(d);
  const chartLine = d.sourceTag ? `<span class="src ${d.source === 'OUTSIDE' ? 'outside' : 'hhp'}">${esc(d.sourceTag)}</span>` : d.chart ? esc(d.chart) : 'No HHP chart';
  const msg = d.verdict === 'situational' ? `<b>HHP's rule:</b> ${esc(noCoachName(d.message).replace(/^SITUATIONAL \(HHP\):\s*/i, ''))}` : esc(noCoachName(d.message));
  return `<div class="grade">
    <div class="row1"><div class="spot">${esc(d.label)}</div><span class="badge ${d.verdict}">${(d.source === 'OUTSIDE' ? OUTSIDE_LABEL : VERDICT_LABEL)[d.verdict]}</span></div>
    <div class="pmark">${m.mark} ${esc(preflopReact(v, slot, m.mark))} ${esc(m.reason)}</div>
    <div class="you">${preflopYouText(f, d)}</div>
    <div class="chart">Chart: ${chartLine}</div>
    <div class="msg">${msg}</div>
    ${d.freq && d.verdict !== 'wrong' ? `<div class="freq">${preflopFreqText(f, d.freq)}</div>` : ''}
    ${(d.sizing || []).map((z) => `<div class="sizing ${z.ok ? 'ok' : 'bad'}"><span>${preflopSizingText(f, z)}</span></div>`).join('')}
  </div>`;
}

function preflopSectionHTML(h, fb, v) {
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
      ${step(k === 0 ? 3 : 2, 'Your action', `${conflictNote}${pt.grade ? preflopCardVoice(pt.grade, v, `pre${k}`) : '<div class="fb-line muted">No chart grade for this decision.</div>'}`)}
      ${k === 0 ? step(4, 'Something else worth remembering', alsoVoice(pre.also, v, 'pre')) : ''}</div>`;
  }).join('') || '<div class="fb-line muted">No preflop decision.</div>';
  return `<section class="fb-sec"><h3>Preflop${pre.villain != null ? ` · vs ${esc(h.players[pre.villain].pos)}` : ''}</h3>${points}</section>`;
}

function decisionHTML(pt, h, k, v) {
  const a = pt.analysis;
  const pos = h.players[pt.vi].pos;
  const slot = `${pt.street}${k}`;
  const head = k === 0 ? `Your decision${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}` : `Then${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}`;
  if (!a) return `<div class="fb-dec"><div class="fb-dh">No decision for you on this street</div>${step(1, esc(rangeQuestion(v, `${slot}.q`, pos)), rangeStepVoice(pt, pos, v, slot))}</div>`;
  const wIf = a.opts.map((o, n) => optionVoice(o, v, `${slot}.o${n}`)).join('');
  const actualExtra = a.opts.includes(a.actual) ? '' : optionVoice(a.actual, v, `${slot}.oa`, true);
  const vd = a.verdict;
  const verdict = line(verdictText(HTML, v, slot, vd), 'fb-line fb-verdict')
    + (vd.size ? line(sizeText(HTML, v, slot, vd.size)) : '')
    + (vd.split ? line(splitText(HTML, vd.split)) : '')
    + (vd.math ? line(mathNoteText(HTML, v, slot, vd.math), 'fb-line muted') : '');
  return `<div class="fb-dec"><div class="fb-dh">${head}</div>
    ${step(1, esc(rangeQuestion(v, `${slot}.q`, pos)), rangeStepVoice(pt, pos, v, slot))}
    ${step(2, 'What happens if…?', `${line(whatIfIntro(HTML, v, slot, { eq: a.eq.total, combos: a.eq.combos, exact: a.eq.exact, runouts: a.eq.runouts, multiway: a.multiway, pct }))}${wIf}${actualExtra}`)}
    ${step(3, 'Your action', line(gradeText(HTML, v, slot, a, pct), `fb-line fb-grade g-${a.grade.close ? 'close' : a.grade.mark === '⚠️' ? 'warn' : a.grade.mark === '✅' ? 'ok' : a.grade.mark === '❌' ? 'bad' : 'none'}`))}
    ${step(4, 'The verdict', verdict)}
    ${step(5, 'Something else worth remembering', alsoVoice(a.also, v, slot))}</div>`;
}

function endSectionHTML(h, fb, v) {
  const e = fb.end;
  const leakHTML = e.leaks.length ? e.leaks.map((l) => `<span class="leak">${esc(l.tag)}${l.repeats ? ` <b>🔁 ${ord(l.repeats + 1)} time in your last 50 hands</b>` : ''}</span>`).join('') : '<span class="muted">No leaks this hand.</span>';
  return `<section class="fb-sec fb-end"><h3>End of hand</h3>
    <div class="fb-take">${esc(e.takeaway)}</div>
    <div class="fb-line"><b>Leak tags:</b> ${leakHTML}</div>
    ${e.known.map((k, n) => `<div class="fb-line fb-known">${knownLeakText(HTML, v, `end.k${n}`, k, `$${h.stakes.sb}/$${h.stakes.bb}`)}</div>`).join('')}
    ${e.whole.map((x) => `<details class="fb-more"><summary><b>For the whole hand:</b> ${esc(x.title)}</summary>${x.fields.map((f) => `<div class="fb-line"><b>${esc(f.name)}:</b> ${esc(f.text)}</div>`).join('')}<div class="tag">${esc(x.tag)}</div></details>`).join('')}
  </section>`;
}

// The quick take: one line per decision (grade, what you did, the verdict), so the verdicts are
// on screen before any scrolling. Everything in it is repeated in full further down.
export function quickTakeItems(fb) {
  const out = [];
  for (const g of fb.preflop.points.map((p) => p.grade).filter(Boolean)) {
    const m = preflopMark(g);
    out.push({ street: 'Preflop', mark: fb.preflop.conflicted ? '⚖' : m.mark, did: `${String(g.heroAction || g.action).toLowerCase()}${g.to ? ` $${g.to}` : ''} with ${g.code}`, verdict: fb.preflop.conflicted ? 'not graded (open conflict)' : m.reason });
  }
  for (const s of fb.streets) for (const pt of s.points) {
    const a = pt.analysis;
    if (!a) continue;
    out.push({ street: cap(s.street), mark: a.grade.mark, did: youDid(a.actual.title).replace(/^You /, ''), verdict: a.grade.mark === '⚖' ? 'not graded (open conflict)' : a.grade.close ? `${a.verdict.title}, by a hair (math only)` : `${a.verdict.title}${a.grade.mark === '✅' ? '' : ' is the line'}` });
  }
  return out;
}

export function voiceFeedbackHTML(h, fb, { resultLine = '', handsHTML = '', gradeHTML = () => '', rulings = {} } = {}) {
  setRulings(rulings);
  const v = voiceFor(h);
  const streets = fb.streets.map((s) => `<section class="fb-sec"><h3>${esc(`${cap(s.street)} ${cardsPretty(s.board)}`)}</h3>${s.points.map((pt, k) => decisionHTML(pt, h, k, v)).join('')}</section>`).join('');
  const qt = quickTakeItems(fb);
  const quick = qt.length ? `<div class="fb-quick"><div class="fb-qh">${esc(quickTakeHead(v))}</div>${qt.map((x) => `<div class="fb-qi"><span class="qs">${esc(x.street)}</span> ${x.mark} you ${esc(x.did)} <span class="qv">→ ${esc(x.verdict)}</span></div>`).join('')}</div>` : '';
  return `<div class="fb-voice"><div class="fb-open">${openerText(HTML, v, openerData(h, fb))}</div>${quick}<div class="resultbox">${esc(resultLine)}</div>
    <h3>Hands</h3><div class="hands-grid">${handsHTML}</div>
    ${preflopSectionHTML(h, fb, v)}${streets}${endSectionHTML(h, fb, v)}</div>`;
}

// Copy for coach in the voice: the hand data plus the spoken review.
export function voiceCoachReport(h, fb, rulings = {}) {
  return coachReport(h, fb, rulings);
}
