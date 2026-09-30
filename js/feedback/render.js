// HTML for the feedback screen, in Joan's order. Pure string building (no DOM access).
import { gridHTML } from '../ui/grid.js';
const BUCKETS = ['strong', 'medium', 'draws', 'air'];
const BUCKET_LABEL = { strong: 'Strong', medium: 'Medium', draws: 'Draws', air: 'Air' };
import { cardsPretty } from '../engine/cards.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const RESP = { fold: 'Fold', call: 'Call', raise: 'Raise', check: 'Check', bet: 'Bet' };

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

const step = (n, title, body) => `<div class="fb-step"><div class="fb-n">${n}</div><div class="fb-b"><div class="fb-t">${title}</div>${body}</div></div>`;

function alsoHTML(also) {
  const items = [];
  for (const r of also?.rules || []) items.push(`<div class="fb-also"><b>${esc(r.title)}:</b> “${esc(r.quote)}” <span class="tag">${esc(r.tag)}</span></div>`);
  if (also?.catalog) items.push(`<div class="fb-also"><b>${esc(also.catalog.name)}, ${esc(also.catalog.field.toLowerCase())}:</b> ${esc(also.catalog.text)} <span class="tag">${esc(also.catalog.tag)}</span></div>`);
  for (const c of also?.conflicts || []) {
    const body = c.block ? mdHTML(c.block.text) : c.open ? mdHTML(c.open.text) : '';
    const src = c.block ? `[HHP] ${c.block.file} › ${c.block.section}${c.block.dates?.length ? ` · ${c.block.dates.join(', ')}` : ''}` : c.open ? `[HHP] ${c.open.file} · ♣ OPEN #${c.open.number}` : c.tag;
    items.push(`<details class="fb-conflict"><summary>${c.kind === 'open' ? '♣ OPEN QUESTION' : '⚖ CONFLICT'} (not graded, both views): ${esc(c.title)}</summary>${body}<div class="tag">${esc(src)}</div></details>`);
  }
  return items.join('') || '<div class="fb-line muted">Nothing else in the brain covers this spot.</div>';
}

function optionHTML(o) {
  const mix = o.mix ? Object.entries(o.mix).filter(([, p]) => p > 0.005).map(([r, p]) => `${RESP[r] || r} ${pct(p)}`).join(' · ') : '';
  const rows = o.byBucket ? BUCKETS.filter((b) => o.byBucket[b]).map((b) => {
    const x = o.byBucket[b];
    const cells = ['fold', 'call', 'raise', 'check', 'bet'].filter((r) => x[r] > 0.005).map((r) => `${RESP[r]} ${pct(x[r])}`).join(', ');
    return `<tr><td><i class="dot ${b}"></i>${BUCKET_LABEL[b]} <span class="muted">${pct(x.share)}</span></td><td>${cells}</td></tr>`;
  }).join('') : '';
  return `<details class="fb-opt"${o.open ? ' open' : ''}><summary><b>${esc(o.title)}</b><span class="ev">EV ${esc(evText(o.ev))}</span></summary>
    ${mix ? `<div class="fb-line">His answer: ${esc(mix)}</div>` : ''}
    ${rows ? `<table class="fb-bt">${rows}</table>` : ''}
    ${o.wantCalls ? `<div class="fb-line"><b>Do you want the calls?</b> ${esc(o.wantCalls)}</div>` : ''}
    ${o.callShares ? `<div class="fb-line"><b>Later streets:</b> his calls are ${BUCKETS.map((b) => `${pct(o.callShares[b])} ${BUCKET_LABEL[b]}`).join(', ')}.</div>` : ''}
    ${o.pros?.length ? `<div class="fb-line"><b>Pros:</b> ${o.pros.map(esc).join(' ')}</div>` : ''}
    ${o.cons?.length ? `<div class="fb-line"><b>Cons:</b> ${o.cons.map(esc).join(' ')}</div>` : ''}
    <div class="fb-math">${o.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    <div class="tag">[OUTSIDE SOURCE] math vs his real range and his real strategy</div></details>`;
}
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const evText = (x) => (Math.abs(x) < 0.05 ? '$0' : `${x < 0 ? '−' : '+'}$${Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0)}`);

function decisionHTML(a, first) {
  const order = a.opts;
  const wIf = order.map((o) => optionHTML({ ...o, open: false })).join('');
  const actualExtra = order.includes(a.actual) ? '' : optionHTML({ ...a.actual, title: `What you did: ${a.actual.title}` });
  const verdictSize = a.verdict.size ? `<div class="fb-line"><b>Size:</b> his range is ${esc(a.verdict.size.why)}. “${esc(a.verdict.size.quote)}” <span class="tag">${esc(a.verdict.size.tag)}</span></div>` : '';
  return `${first ? '' : `<div class="fb-sub">Then: ${esc(a.actual.title)}</div>`}
    ${step(2, 'What happens if…?', `${a.multiway ? '<div class="fb-line muted">Multiway: his answers treat him as next to act.</div>' : ''}<div class="fb-line">Your equity vs his real range: <b>${pct(a.eq.total)}</b> (${a.eq.combos} combos, ${a.eq.exact ? 'exact' : `${a.eq.runouts} sampled runouts`}).</div>${wIf}${actualExtra}`)}
    ${step(3, 'Your action', `<div class="fb-line">${a.grade.mark} <b>You: ${esc(a.actual.title)}.</b> ${esc(a.grade.text)}</div>`)}
    ${step(4, 'Verdict', `<div class="fb-line"><b>${esc(a.verdict.title)}.</b> ${esc(a.verdict.why)} <span class="tag">${esc(a.verdict.source)}</span></div>${verdictSize}${a.verdict.math ? `<div class="fb-line muted">${esc(a.verdict.math)}</div>` : ''}`)}
    ${step(5, 'Also from the brain', alsoHTML(a.also))}`;
}

export function feedbackHTML(h, fb, { resultLine = '', handsHTML = '', gradeHTML = () => '' } = {}) {
  const pre = fb.preflop;
  const pv = pre.villain;
  const preGrid = pv != null && pre.grids[pv] ? `${gridHTML(pre.grids[pv].cells, { mode: 'action' })}<div class="fb-p">${esc(pre.grids[pv].paragraph)}</div>` : '<div class="fb-line muted">Nobody else played a hand.</div>';
  const qs = pre.questions;
  const qHTML = `<ol class="fb-q">${qs.list.map((x) => `<li><b>${esc(x.q)}</b> ${esc(x.a || '')}</li>`).join('')}</ol><div class="tag">${esc(qs.tag)}</div>${qs.extra.map((x) => `<div class="fb-line"><b>${esc(x.q)}</b> ${esc(x.a)} <span class="tag">${esc(x.tag)}</span></div>`).join('')}`;
  const preAction = pre.actions.length ? pre.actions.map((d) => gradeHTML(d)).join('') : '<div class="fb-line muted">No preflop decision.</div>';
  const others = fb.involved.filter((i) => i !== pv && pre.grids[i]);
  const preSection = `<section class="fb-sec"><h3>Preflop${pv != null ? ` · vs ${esc(h.players[pv].pos)}` : ''}</h3>
    ${step(1, "Opponent's range", preGrid + (others.length ? `<details class="fb-more"><summary>Also in the hand: ${others.map((i) => esc(h.players[i].pos)).join(', ')}</summary>${others.map((i) => `<div class="fb-sub">${esc(h.players[i].pos)}</div>${gridHTML(pre.grids[i].cells, { mode: 'action' })}<div class="fb-p">${esc(pre.grids[i].paragraph)}</div>`).join('')}</details>` : ''))}
    ${step(2, 'The questions to ask here', qHTML)}
    ${step(3, 'Your action', `${pre.conflicted ? '<div class="fb-line"><b>⚖ Not graded:</b> this spot is an open conflict in your playbook (below). The chart grade is shown for reference only.</div>' : ''}${preAction}`)}
    ${step(4, 'Also from the brain', alsoHTML(pre.also))}</section>`;

  const streets = fb.streets.map((s) => {
    const title = `${cap(s.street)} ${cardsPretty(s.board)} · vs ${h.players[s.villain].pos}`;
    const decs = s.decisions.length ? s.decisions.map((a, k) => decisionHTML(a, k === 0)).join('') : `${step(2, 'What happens if…?', '<div class="fb-line muted">You had no decision on this street.</div>')}`;
    return `<section class="fb-sec"><h3>${esc(title)}</h3>
      ${step(1, 'What is my opponent\'s range?', `${gridHTML(s.grid.cells, { mode: 'bucket', shares: s.grid.shares })}<div class="fb-p">${esc(s.paragraph)}</div>`)}
      ${decs}</section>`;
  }).join('');

  const e = fb.end;
  const leakHTML = e.leaks.length ? e.leaks.map((l) => `<span class="leak">${esc(l.tag)}${l.repeats ? ` <b>🔁 ${ord(l.repeats + 1)} time in your last 50 hands</b>` : ''}</span>`).join('') : '<span class="muted">No leaks this hand.</span>';
  const endSection = `<section class="fb-sec fb-end"><h3>End of hand</h3>
    <div class="fb-take">${esc(e.takeaway)}</div>
    <div class="fb-line"><b>Leak tags:</b> ${leakHTML}</div>
    ${e.known.map((k) => `<div class="fb-line"><b>Known leak: ${esc(k.title)}.</b> ${esc(k.text)} <span class="tag">${esc(k.tag)}</span></div>`).join('')}
    ${e.whole.map((x) => `<details class="fb-more"><summary><b>For the whole hand:</b> ${esc(x.title)}</summary>${x.fields.map((f) => `<div class="fb-line"><b>${esc(f.name)}:</b> ${esc(f.text)}</div>`).join('')}<div class="tag">${esc(x.tag)}</div></details>`).join('')}
  </section>`;

  return `<div class="resultbox">${esc(resultLine)}</div>
    <h3>Hands</h3><div class="hands-grid">${handsHTML}</div>
    ${preSection}${streets}${endSection}`;
}
