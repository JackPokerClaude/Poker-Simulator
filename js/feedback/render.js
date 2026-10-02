// HTML for the feedback screen, in Joan's order. Pure string building (no DOM access).
import { gridHTML, comboList } from '../ui/grid.js';
import { CLASSES, CLASS_KEYS, CLASS_LABEL, CLASS_INFO } from '../range/classes.js';
import { cardsPretty } from '../engine/cards.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const RESP = { fold: 'Fold', call: 'Call', raise: 'Raise', check: 'Check', bet: 'Bet' };

// Tiny markdown for playbook blocks: tables, bold, italics, bullets.
export function mdHTML(text) {
  const lines = String(text).split('\n');
  const out = [];
  let table = null;
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,:;!?]|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const flush = () => {
    if (!table) return;
    const rows = table.filter((r) => !/^\s*\|?\s*-{3,}/.test(r.join('')));
    out.push(`<div class="mdt"><table>${rows.map((r, k) => `<tr>${r.map((c) => (k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join('')}</tr>`).join('')}</table></div>`);
    table = null;
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('|')) { (table ||= []).push(l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); continue; }
    flush();
    if (!l) continue;
    if (/^[-*]\s/.test(l)) out.push(`<div class="mdli">• ${inline(l.replace(/^[-*]\s+/, ''))}</div>`);
    else out.push(`<div class="mdp">${inline(l)}</div>`);
  }
  flush();
  return out.join('');
}

export const step = (n, title, body) => `<div class="fb-step"><div class="fb-n">${n}</div><div class="fb-b"><div class="fb-t">${title}</div>${body}</div></div>`;

// Your rulings (from the Rulings tab), shown on the conflict boxes. Never applied here.
let RULINGS = {};
export const setRulings = (r) => { RULINGS = r || {}; };
export const rulingNote = (c) => {
  const r = RULINGS[c.block?.id] || RULINGS[c.open?.id];
  return r ? `<div class="fb-line"><b>Your ruling:</b> ${esc(r)}. Recorded for your brain session; not applied or graded until the brain says so.</div>` : '';
};

export function alsoHTML(also) {
  const items = [];
  for (const r of also?.rules || []) items.push(`<div class="fb-also"><b>${esc(r.title)}:</b> “${esc(r.quote)}” <span class="tag">${esc(r.tag)}</span></div>`);
  if (also?.catalog) items.push(`<div class="fb-also"><b>${esc(also.catalog.name)}, ${esc(also.catalog.field.toLowerCase())}:</b> ${esc(also.catalog.text)} <span class="tag">${esc(also.catalog.tag)}</span></div>`);
  for (const c of also?.conflicts || []) {
    const body = c.block ? mdHTML(c.block.text) : c.open ? mdHTML(c.open.text) : '';
    const src = c.block ? `[HHP] ${c.block.file} › ${c.block.section}${c.block.dates?.length ? ` · ${c.block.dates.join(', ')}` : ''}` : c.open ? `[HHP] ${c.open.file} · ♣ OPEN #${c.open.number}` : c.tag;
    items.push(`<details class="fb-conflict"><summary>${c.kind === 'open' ? '♣ OPEN QUESTION' : '⚖ CONFLICT'} (not graded, both views): ${esc(c.title)}</summary>${rulingNote(c)}${body}<div class="tag">${esc(src)}</div></details>`);
  }
  return items.join('') || '<div class="fb-line muted">Nothing else in the brain covers this spot.</div>';
}

// One summary line per option (his answer + EV); tap to expand the class-by-class breakdown.
export function optionHTML(o) {
  const mix = o.mix ? Object.entries(o.mix).filter(([, p]) => p > 0.005).sort((a, b) => b[1] - a[1]).map(([r, p]) => `${RESP[r] || r} ${pct(p)}`).join(', ') : '';
  const VERB = { fold: 'folds', call: 'calls', raise: 'raises', check: 'checks', bet: 'bets' };
  const said = o.mix ? Object.entries(o.mix).filter(([, p]) => p > 0.005).sort((a, b) => b[1] - a[1]).map(([r, p]) => `${VERB[r] || r} ${pct(p)}`).join(', ') : '';
  const summary = o.kind === 'fold' ? 'you give up the pot' : o.kind === 'call' ? `you need ${pct(o.need)}, you have ${pct(o.eqAll)}` : o.closes ? 'it checks through' : said ? `he ${said}` : '';
  const rows = o.byClass ? CLASSES.filter((c) => o.byClass[c.key]).map((c) => {
    const x = o.byClass[c.key];
    const cells = ['fold', 'call', 'raise', 'check', 'bet'].filter((r) => x[r] > 0.005).map((r) => `${RESP[r]} ${pct(x[r])}`).join(', ');
    return `<tr><td><i class="dot" style="background:${c.color}"></i>${esc(c.label)}</td><td class="num">${pct(x.share)}</td><td>${cells}</td></tr>`;
  }).join('') : '';
  const next = (o.next ? `<div class="fb-line"><b>Next street:</b> ${esc(o.next)}</div>` : '')
    + (o.look ? `<div class="fb-look"><div class="fb-line"><b>On the ${esc(o.look.street)} that came (${esc(o.look.card)}):</b></div>${o.look.lines.map((l) => `<div class="fb-line">${esc(l)}</div>`).join('')}<div class="tag">${esc(o.look.tag)}</div></div>` : '');
  return `<details class="fb-opt"${o.open ? ' open' : ''}><summary><span class="ot"><b>${esc(o.title)}</b><span class="os">${esc(summary)}</span></span><span class="ev">EV ${esc(evText(o.ev))}</span></summary>
    ${rows ? `<table class="fb-bt"><tr><th>His class</th><th>Share</th><th>What it does</th></tr>${rows}</table>` : ''}
    ${o.wantCalls ? `<div class="fb-line"><b>Do you want the calls?</b> ${esc(o.wantCalls)}</div>` : ''}
    ${next}
    ${o.pros?.length ? `<div class="fb-line"><b>Pros:</b> ${o.pros.map(esc).join(' ')}</div>` : ''}
    ${o.cons?.length ? `<div class="fb-line"><b>Cons:</b> ${o.cons.map(esc).join(' ')}</div>` : ''}
    <div class="fb-math">${o.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    ${o.numbers?.length ? `<div class="fb-line muted">His answers come from his strategy for this style:</div>${numbersHTML(o.numbers)}` : ''}
    <div class="tag">[OUTSIDE SOURCE] math vs his real range and his real strategy</div></details>`;
}
export const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
export const evText = (x) => (Math.abs(x) < 0.05 ? '$0' : `${x < 0 ? '−' : '+'}$${Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0)}`);

// ---- his range at a decision: what he did, the grid, the numbers, why
export function changeHTML(c) {
  const moved = c.before ? CLASS_KEYS.filter((k) => Math.abs((c.after[k] || 0) - (c.before[k] || 0)) >= 0.02) : [];
  const shift = moved.length ? `${moved.map((k) => `${CLASS_LABEL[k]} ${pct(c.before[k])} → ${pct(c.after[k])}`).join(', ')}. ` : '';
  const claims = (c.claims || []).map((x) => (x.ok
    ? `<div class="chg-ok">Matches the brain: “${esc(x.quote)}” <span class="tag">${esc(x.tag)}</span></div>`
    : `<div class="chg-bad">⚖ Brain vs his strategy (not resolved): the brain says “${esc(x.quote)}” <span class="tag">${esc(x.tag)}</span>; his strategy gives ${esc(x.got)}.</div>`)).join('');
  return `<div class="chg"><div><b>${esc(c.what)}.</b> ${esc(shift)}${Math.round(c.combos[0])} → ${Math.round(c.combos[1])} combos (${pct(c.pctStart)} of his starting range).</div>
    <div class="chg-why">Why: ${esc(c.reason.text)}${c.reason.quote ? ` The brain: “${esc(c.reason.quote)}”` : ''} <span class="tag">${esc(c.reason.tag)}</span></div>
    ${c.reason.widen ? `<div class="chg-why">${esc(c.reason.widen.text)} <span class="tag">${esc(c.reason.widen.tag)}</span></div>` : ''}
    ${numbersHTML(c.reason.numbers)}${claims}${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</div>`;
}

// "Where the numbers come from": every strategy number with its own tag, collapsed.
export function numbersHTML(nums) {
  if (!nums?.length) return '';
  return `<details class="fb-nums"><summary>Where the numbers come from</summary>${nums.map((n) => `<div class="fb-num"><b>${esc(n.what)}:</b> ${esc(n.val)} <span class="tag">${esc(n.tag)}</span>${n.quote ? `<div class="muted">“${esc(n.quote)}”</div>` : ''}</div>`).join('')}</details>`;
}

export function classInfoHTML(key) {
  const info = CLASS_INFO[key];
  if (!info) return `<div class="gd-h"><b>${esc(CLASS_LABEL[key] || key)}</b></div>`;
  return `<div class="gd-h"><b>${esc(info.label)}</b></div><div class="fb-line">${esc(info.rule)}</div>${info.quote ? `<div class="fb-line">“${esc(info.quote)}” <span class="tag">${esc(info.tag)}</span></div>` : ''}`;
}

export function rangeStepHTML(pt, pos) {
  const g = pt.grid;
  const changes = (pt.changes || []).map(changeHTML).join('');
  const grid = g ? gridHTML(g.cells, { mode: g.mode, shares: g.shares, combosLeft: g.combos, detail: (code) => comboList(code, g.detail), classInfo: classInfoHTML }) : '';
  const vs = pt.versus ? `<div class="fb-line"><b>Your hand vs his range right now:</b> you beat ${pct(pt.versus.beat)}, lose to ${pct(pt.versus.lose)}, chop ${pct(pt.versus.chop)}.</div>` : '';
  return `${changes ? `<div class="fb-sub2">How ${esc(pos)}'s range changed</div>${changes}` : ''}${grid}${vs}<div class="fb-p">${esc(pt.paragraph || '')}</div>`;
}

function decisionHTML(pt, h, k) {
  const a = pt.analysis;
  const pos = h.players[pt.vi].pos;
  const head = k === 0 ? `Your decision${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}` : `Then${a ? `: you ${esc(a.actual.title.toLowerCase())}` : ''}`;
  if (!a) return `<div class="fb-dec"><div class="fb-dh">No decision for you on this street</div>${step(1, `What is ${esc(pos)}'s range?`, rangeStepHTML(pt, pos))}</div>`;
  const wIf = a.opts.map((o) => optionHTML({ ...o, open: false })).join('');
  const actualExtra = a.opts.includes(a.actual) ? '' : optionHTML({ ...a.actual, title: `What you did: ${a.actual.title}` });
  const verdictSize = a.verdict.size ? `<div class="fb-line"><b>Size:</b> his range is ${esc(a.verdict.size.why)}. “${esc(a.verdict.size.quote)}” <span class="tag">${esc(a.verdict.size.tag)}</span></div>` : '';
  return `<div class="fb-dec"><div class="fb-dh">${head}</div>
    ${step(1, `What is ${esc(pos)}'s range?`, rangeStepHTML(pt, pos))}
    ${step(2, 'What happens if…?', `${a.multiway ? '<div class="fb-line muted">Multiway: his answers treat him as next to act.</div>' : ''}<div class="fb-line">Your equity vs this range: <b>${pct(a.eq.total)}</b> (${a.eq.combos} combos, ${a.eq.exact ? 'exact' : `${a.eq.runouts} sampled runouts`}).</div>${wIf}${actualExtra}`)}
    ${step(3, 'Your action', `<div class="fb-line">${a.grade.mark} <b>You: ${esc(a.actual.title)}.</b> ${esc(a.grade.text)}</div>`)}
    ${step(4, 'Verdict', `<div class="fb-line"><b>${esc(a.verdict.title)}.</b> ${esc(a.verdict.why)} <span class="tag">${esc(a.verdict.source)}</span></div>${verdictSize}${a.verdict.split ? `<div class="fb-line"><b>Brain lines disagree here</b> (no ⚖ in the playbook), so the math decides: ${a.verdict.split.map((x) => `${esc(x.title)} → ${esc(x.line.toLowerCase())} <span class="tag">${esc(x.tag)}</span>`).join('; ')}.</div>` : ''}${a.verdict.math ? `<div class="fb-line muted">${esc(a.verdict.math)}</div>` : ''}`)}
    ${step(5, 'Also from the brain', alsoHTML(a.also))}</div>`;
}

export function feedbackHTML(h, fb, { resultLine = '', handsHTML = '', gradeHTML = () => '', rulings = {} } = {}) {
  RULINGS = rulings || {};
  const pre = fb.preflop;
  const qs = pre.questions;
  const qHTML = `<ol class="fb-q">${qs.list.map((x) => `<li><b>${esc(x.q)}</b> ${esc(x.a || '')}</li>`).join('')}</ol><div class="tag">${esc(qs.tag)}</div>${qs.extra.map((x) => `<div class="fb-line"><b>${esc(x.q)}</b> ${esc(x.a)} <span class="tag">${esc(x.tag)}</span></div>`).join('')}`;
  const prePoints = pre.points.map((pt, k) => {
    const pos = pt.vi != null ? h.players[pt.vi].pos : null;
    const range = pos ? rangeStepHTML(pt, pos) : `<div class="fb-line muted">${esc(pt.paragraph)}</div>`;
    const conflictNote = pre.conflicted ? '<div class="fb-line"><b>⚖ Not graded:</b> this spot is an open conflict in your playbook (below). The chart grade is shown for reference only.</div>' : '';
    return `<div class="fb-dec"><div class="fb-dh">${k === 0 ? 'Your decision' : 'Then'}${pt.grade ? `: you ${esc(String(pt.grade.heroAction || pt.grade.action).toLowerCase())}` : ''}</div>
      ${step(1, pos ? `What is ${esc(pos)}'s range?` : 'Who is in?', range)}
      ${k === 0 ? step(2, 'The questions to ask here', qHTML) : ''}
      ${step(k === 0 ? 3 : 2, 'Your action', `${conflictNote}${pt.grade ? gradeHTML(pt.grade) : '<div class="fb-line muted">No chart grade for this decision.</div>'}`)}
      ${k === 0 ? step(4, 'Also from the brain', alsoHTML(pre.also)) : ''}</div>`;
  }).join('') || '<div class="fb-line muted">No preflop decision.</div>';
  const preSection = `<section class="fb-sec"><h3>Preflop${pre.villain != null ? ` · vs ${esc(h.players[pre.villain].pos)}` : ''}</h3>${prePoints}</section>`;

  const streets = fb.streets.map((s) => `<section class="fb-sec"><h3>${esc(`${cap(s.street)} ${cardsPretty(s.board)}`)}</h3>${s.points.map((pt, k) => decisionHTML(pt, h, k)).join('')}</section>`).join('');

  const e = fb.end;
  const leakHTML = e.leaks.length ? e.leaks.map((l) => `<span class="leak">${esc(l.tag)}${l.repeats ? ` <b>🔁 ${ord(l.repeats + 1)} time in your last 50 hands</b>` : ''}</span>`).join('') : '<span class="muted">No leaks this hand.</span>';
  const endSection = `<section class="fb-sec fb-end"><h3>End of hand</h3>
    <div class="fb-take">${esc(e.takeaway)}</div>
    <div class="fb-line"><b>Leak tags:</b> ${leakHTML}</div>
    ${e.known.map((k) => `<div class="fb-line"><b>Your known leak: ${esc(k.title)}.</b> ${esc(k.text)} <span class="tag">${esc(k.tag)}</span></div>`).join('')}
    ${e.whole.map((x) => `<details class="fb-more"><summary><b>For the whole hand:</b> ${esc(x.title)}</summary>${x.fields.map((f) => `<div class="fb-line"><b>${esc(f.name)}:</b> ${esc(f.text)}</div>`).join('')}<div class="tag">${esc(x.tag)}</div></details>`).join('')}
  </section>`;

  return `<div class="resultbox">${esc(resultLine)}</div>
    <h3>Hands</h3><div class="hands-grid">${handsHTML}</div>
    ${preSection}${streets}${endSection}`;
}
