// "Copy for coach": the hand facts, then every street in the feedback screen's order: his range
// (class % before → after each action), the options weighed, your action and grade, the verdict
// with its source, leak tags, and the takeaway. Plain text, built from the same feedback object
// the screen shows, so the two never disagree.
import { handFacts, streetLine, resultText } from '../engine/coach.js';
import { CLASS_KEYS, CLASS_LABEL } from '../range/classes.js';
import { cardsPretty } from '../engine/cards.js';
import { preflopMark } from './marks.js';

const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const ev = (x) => (Math.abs(x) < 0.05 ? '$0' : `${x < 0 ? '-' : '+'}$${Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0)}`);
const SHORT = { cpfs: 'CPFS', thick: 'Thick', thin: 'Thin', highDraw: 'Hi-draw', lowDraw: 'Lo-draw', sdv: 'SDV', air: 'Air' };
const VERB = { fold: 'folds', call: 'calls', raise: 'raises', check: 'checks', bet: 'bets' };

const sharesLine = (sh) => CLASS_KEYS.filter((k) => sh[k] >= 0.005).map((k) => `${SHORT[k]} ${pct(sh[k])}`).join(', ') || 'empty';

function changeLine(c) {
  const head = `${c.what}: ${Math.round(c.combos[0])} → ${Math.round(c.combos[1])} combos (${pct(c.pctStart)} of his start)`;
  if (!c.before) return head;
  const moved = CLASS_KEYS.filter((k) => Math.abs((c.after[k] || 0) - (c.before[k] || 0)) >= 0.02);
  return `${head}${moved.length ? `; ${moved.map((k) => `${SHORT[k]} ${pct(c.before[k])} → ${pct(c.after[k])}`).join(', ')}` : '; classes about the same'}`;
}

function claimLines(c, out, pad) {
  for (const x of c.claims || []) if (!x.ok) out.push(`${pad}⚖ Brain vs his strategy (not resolved): "${x.quote}" ${x.tag}; his strategy gives ${x.got}.`);
}

function optionLine(o) {
  const said = o.mix ? Object.entries(o.mix).filter(([, p]) => p > 0.005).sort((a, b) => b[1] - a[1]).map(([r, p]) => `${VERB[r] || r} ${pct(p)}`).join(', ') : '';
  const what = o.kind === 'fold' ? 'give up the pot' : o.kind === 'call' ? `need ${pct(o.need)}, have ${pct(o.eqAll)}` : o.closes ? 'checks through' : said ? `he ${said}` : '';
  return `${o.title}: ${what ? `${what}, ` : ''}EV ${ev(o.ev)}`;
}

function decisionLines(pt, h, k, out, ruled) {
  const a = pt.analysis;
  const pos = h.players[pt.vi].pos;
  out.push(`${k === 0 ? 'Decision' : 'Then'}${a ? `: you ${a.actual.title.toLowerCase()}` : ' (no decision for you)'} (vs ${pos})`);
  const changes = pt.changes || [];
  const first = changes.find((c) => c.before);
  if (k === 0 && changes.length) out.push(`  His range at the start of the street: ${sharesLine(first ? first.before : pt.shares)}`);
  for (const c of changes) { out.push(`  ${changeLine(c)}`); claimLines(c, out, '    '); }
  out.push(`  His range ${changes.length ? 'now' : k === 0 ? 'at the start of the street' : 'still'}: ${sharesLine(pt.shares)}${pt.grid?.combos ? `; ${pt.grid.combos}` : ''}`);
  if (pt.versus) out.push(`  You vs his range: beat ${pct(pt.versus.beat)}, lose to ${pct(pt.versus.lose)}, chop ${pct(pt.versus.chop)}.`);
  if (!a) return;
  out.push(`  Options weighed (equity ${pct(a.eq.total)}${a.real < 1 ? `, realized at ${pct(a.real)} out of position [OUTSIDE SOURCE]` : ''}):`);
  for (const o of a.opts) {
    out.push(`    - ${optionLine(o)}`);
    if (o.look) out.push(`      then, on the ${o.look.street} that came (${o.look.card}): ${o.look.lines.join(' ')}`);
  }
  if (!a.opts.includes(a.actual)) out.push(`    - What you did, ${optionLine(a.actual)}`);
  out.push(`  Your action: ${a.grade.mark} ${a.actual.title}. ${a.grade.text}`);
  out.push(`  Verdict: ${a.verdict.title}. ${a.verdict.why} ${a.verdict.source}`);
  if (a.verdict.size) out.push(`  Size: his range is ${a.verdict.size.why}. "${a.verdict.size.quote}" ${a.verdict.size.tag}`);
  if (a.verdict.split) out.push(`  Brain lines disagree here (no ⚖), so the math decides: ${a.verdict.split.map((x) => `${x.title} → ${x.line.toLowerCase()} ${x.tag}`).join('; ')}.`);
  if (a.verdict.math) out.push(`  ${a.verdict.math}`);
  for (const c of a.also?.conflicts || []) out.push(`  ${c.kind === 'open' ? '♣ Open question' : '⚖ Conflict'} (not graded): ${c.title}${ruled(c)}`);
  out.push(`  Leak tags: ${a.leaks.length ? a.leaks.join(', ') : 'none'}`);
}

export function coachReport(h, fb, rulings = {}) {
  const ruled = (c) => { const r = rulings[c.block?.id] || rulings[c.open?.id]; return r ? ` (your ruling: ${r}; not applied)` : ''; };
  const out = [...handFacts(h), ''];
  const pre = fb.preflop;
  out.push(`PREFLOP${pre.villain != null ? ` (vs ${h.players[pre.villain].pos})` : ''}`);
  out.push(`Action: ${streetLine(h, 'preflop')}`);
  pre.points.forEach((pt, k) => {
    const g = pt.grade;
    out.push(`${k === 0 ? 'Decision' : 'Then'}${g ? `: you ${String(g.heroAction || g.action).toLowerCase()}${g.to ? ` $${g.to}` : ''}` : ''}`);
    for (const c of pt.changes || []) {
      out.push(`  ${changeLine(c)}`);
      out.push(`    Why: ${c.reason.text}${c.reason.quote ? ` The brain: "${c.reason.quote}"` : ''} ${c.reason.tag}`);
      if (c.reason.widen) out.push(`    ${c.reason.widen.text} ${c.reason.widen.tag}`);
    }
    if (g) {
      const m = preflopMark(g);
      out.push(`  Your action: ${m.mark} ${g.heroAction || g.action} with ${g.code}. ${m.reason}`);
      const src = g.sourceTag || g.chart || '';
      out.push(m.reason === g.message ? `  Source: ${src || 'no HHP chart'}` : `  Verdict: ${g.message} ${src}`.trimEnd());
      for (const z of g.sizing || []) out.push(`  Sizing (${z.rule}): ${z.ok ? 'OK' : 'Off'}. ${z.message}`);
    }
  });
  if (pre.conflicted) for (const c of pre.also?.conflicts || []) out.push(`  ${c.kind === 'open' ? '♣ Open question' : '⚖ Conflict'} (not graded): ${c.title}${ruled(c)}`);
  out.push(`Leak tags: ${pre.leaks.length ? pre.leaks.join(', ') : 'none'}`);

  const streetsSeen = new Set(fb.streets.map((s) => s.street));
  for (const s of fb.streets) {
    const deal = h.log.find((e) => e.type === 'deal' && e.street === s.street);
    out.push('', `${s.street.toUpperCase()} ${cardsPretty(s.board)}${deal ? ` (pot $${deal.pot})` : ''}`);
    out.push(`Action: ${streetLine(h, s.street) || 'no betting (all-in)'}`);
    s.points.forEach((pt, k) => decisionLines(pt, h, k, out, ruled));
  }
  const unreached = [];
  for (const st of ['flop', 'turn', 'river']) {
    if (streetsSeen.has(st)) continue;
    const deal = h.log.find((x) => x.type === 'deal' && x.street === st);
    if (deal) out.push('', `${st.toUpperCase()} ${cardsPretty(deal.board)}: no betting (all-in)`);
    else unreached.push(st);
  }
  if (unreached.length) out.push('', `${unreached.map((x) => x[0].toUpperCase() + x.slice(1)).join(', ')}: not reached`);

  const e = fb.end;
  out.push('', `Result: ${resultText(h)}`);
  out.push(`Takeaway: ${e.takeaway}`);
  out.push(`Leak tags (hand): ${e.leaks.length ? e.leaks.map((l) => `${l.tag}${l.repeats ? ` (${l.repeats + 1}x in last 50)` : ''}`).join(', ') : 'none'}`);
  for (const k of e.known) out.push(`Known leak: ${k.title}. ${k.text} ${k.tag}`);
  out.push('My question: Review every decision street by street.');
  return out.join('\n');
}
