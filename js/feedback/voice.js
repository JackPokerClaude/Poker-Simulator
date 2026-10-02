// The HHP voice: phrase pools and the sentence builders that speak the feedback engine's
// structured result. Delivery only (docs/hhp-voice.md): every number, size, %, date, grade mark
// and source tag is passed through exactly as the engine made it, and no glue phrase carries
// strategy. Picks are seeded by the hand, so the same hand always reads the same way.

// ---------------------------------------------------------------- seed and picks
const fnv = (str) => {
  let x = 0x811c9dc5;
  for (let k = 0; k < str.length; k++) { x ^= str.charCodeAt(k); x = Math.imul(x, 0x01000193); }
  return x >>> 0;
};

// One number per hand, from the deal (the same after a History rebuild).
export function handSeed(h) {
  const init = h.initial || {};
  const cards = (init.players || h.players || []).flatMap((p) => p.cards || []);
  return fnv(`${cards.join(',')}|${(init.runout || []).join(',')}|${h.heroIdx}`);
}

// A picker for one hand: say(slot, pool) always returns the same entry for the same slot.
export function voiceFor(h) {
  const seed = handSeed(h);
  const used = new Map();
  const pick = (slot, pool) => {
    if (!pool.length) return '';
    let k = fnv(`${seed}|${slot}`) % pool.length;
    // Within one hand, avoid repeating the same line from the same pool back to back.
    const prev = used.get(pool);
    if (prev === k && pool.length > 1) k = (k + 1) % pool.length;
    used.set(pool, k);
    return pool[k];
  };
  return { seed, pick };
}

// ---------------------------------------------------------------- formatters
// Builders write glue as literal text (no <, >, &) and pass engine data through f.t / f.b /
// f.q / f.tag, so the same sentence renders on screen (HTML) and in Copy for coach (text).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const HTML = {
  html: true,
  t: (s) => esc(s),
  b: (s) => `<b>${esc(s)}</b>`,
  q: (s) => `“${esc(s)}”`,
  tag: (s) => (s ? ` <span class="tag">${esc(s)}</span>` : ''),
};
export const TEXT = {
  html: false,
  t: (s) => String(s ?? ''),
  b: (s) => String(s ?? ''),
  q: (s) => `"${s}"`,
  tag: (s) => (s ? ` ${s}` : ''),
};

export const lower1 = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
export const upper1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------- a) hand opener
const OPENERS = [
  'All right, let\'s jump in.',
  'Okay, let\'s walk through this one.',
  'Cool, let\'s talk about this hand.',
  'Let\'s dig into this one.',
  'All right, let\'s set the scene.',
  'Okay, walk through this one with me.',
  'Here we go.',
  'Let\'s take this one street by street.',
  'Quick scene-setter first.',
  'Fun one. Let\'s break it down.',
  'All right, pull up a chair.',
  'This one\'s worth a couple of minutes.',
];
const REACH = {
  preflop: ['It\'s all over preflop, so this one\'s quick.', 'This one ends preflop. Short and sweet.', 'No flop for you here, so we keep it short.'],
  flop: ['It goes as far as the flop.', 'We get to see a flop.', 'This one plays out on the flop.'],
  turn: ['It gets to the turn.', 'We go as far as the turn.', 'This one runs through the turn.'],
  river: ['It goes all the way to the river.', 'We get to the river on this one.', 'This one goes the distance, all the way to the river.'],
};
const an = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

// "CO, a thinking player (an aggro folder after the flop)"; short: "CO (thinking player)".
export function villainPhrase(p, typeLabel, styleLabel, { short = false } = {}) {
  const t = lower1(typeLabel(p.type));
  const tl = /^(passive|tight|aggressive)$/.test(t) ? `${t} player` : t;
  if (short) return `${p.pos} (${tl})`;
  const style = p.style && p.style !== 'whale' ? ` (${an(styleLabel(p.style))} ${styleLabel(p.style).toLowerCase()} after the flop)` : '';
  return `${p.pos}, ${an(tl)} ${tl}${style}`;
}

// Stakes, your seat and cards, depth, who you're up against, how far it goes.
// villains[0] is the main opponent (full phrase), the rest are short.
export function openerText(f, v, { stakes, heroPos, heroCards, effBB, villains, first, reach }) {
  const [main, ...rest] = villains;
  const who = !main ? 'Everybody else got out of the way.'
    : `${v.pick('open-who', ['Your main guy here is', 'The player to watch is', 'You\'re mostly up against', 'Your opponent:'])} ${f.t(main)}.${rest.length ? ` ${v.pick('open-rest', ['Also in:', 'Also along for the ride:', 'Plus'])} ${f.t(rest.join(', '))}.` : ''}`;
  const firstLine = first ? ` ${v.pick('open-first', ['First up:', 'Action starts:', 'Off we go:'])} ${f.t(first)}.` : '';
  return `${v.pick('opener', OPENERS)} ${f.t(stakes)}, you're in the ${f.t(heroPos)} with ${f.b(heroCards)}, ${f.t(effBB)} effective. ${who}${firstLine} ${v.pick('reach', REACH[reach] || REACH.preflop)}`;
}

// ---------------------------------------------------------------- b) his range at a decision
// Step 1's title: always the same question, asked a few ways.
export const RANGE_Q = [
  'What\'s {pos}\'s range?',
  'So what\'s {pos}\'s range?',
  'First question: what\'s {pos}\'s range?',
  'Okay, what\'s {pos}\'s range?',
  'Start with him: what\'s {pos}\'s range?',
];
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
export const rangeQuestion = (v, slot, pos) => fill(v.pick(slot, RANGE_Q), { pos });

const classWord = (label) => (/CPFS/.test(label) ? 'can-play-for-stacks hands' : label.toLowerCase());
const SHORT = { cpfs: 'CPFS', thick: 'thick value', thin: 'thin value', highDraw: 'high-equity draws', lowDraw: 'low-equity draws', sdv: 'showdown value', air: 'air' };

// Preflop: who he is, what HHP says about the type, what his action keeps.
export function preflopRangeText(f, v, slot, info) {
  const out = [];
  const [type, style] = info.label.split(' · ');
  out.push(`${f.t(info.pos)} is ${an(type)} ${f.t(lower1(type))}${style ? ` (${an(style)} ${f.t(style)} after the flop)` : ''}.`);
  if (info.typeQuote) out.push(`${v.pick(`${slot}.type`, ['Here\'s how HHP sums up this type:', 'HHP on this type:', 'What HHP says about guys like this:'])} ${f.q(info.typeQuote.quote)}${f.tag(info.typeQuote.tag)}.`);
  if (info.keep) out.push(`He ${f.t(info.words.join(', then '))}, ${v.pick(`${slot}.keep`, ['and that leaves him about', 'which keeps about', 'so he\'s down to about'])} ${f.t(info.keep.pct)} of all hands (${f.t(`${info.keep.combos} of ${info.keep.full}`)} combos).`);
  if (info.bigOpen) out.push(`And look at the size, his open was unusually big: ${f.q(info.bigOpen.quote)}${f.tag(info.bigOpen.tag)}.`);
  out.push(v.pick(`${slot}.grid`, ['The grid is his own strategy replayed, so it\'s the range he\'s actually playing.', 'The grid replays his own strategy, the one he actually plays from.', 'That grid is his real strategy replayed, not a guess.']));
  return out.join(' ');
}

// Postflop: what moved when he acted, the two biggest buckets, combos left.
export function streetRangeText(f, v, slot, info) {
  const out = [];
  if (!info.acted) out.push(`He hasn't acted on the ${f.t(info.street)} yet when you decide, so this is still his range from the ${info.street === 'flop' ? 'preflop action' : 'last street'}.`);
  for (const m of info.moves) out.push(`${v.pick(`${slot}.move`, ['When', 'After'])} ${f.t(m.what)}, the big mover is ${f.t(classWord(m.label))}: ${f.t(`${m.from} → ${m.to}`)}.`);
  const [a, b] = info.top;
  out.push(`${v.pick(`${slot}.top`, ['So he\'s mostly', 'Bottom line, he\'s mostly', 'That makes him mostly'])} ${f.t(classWord(a.label))} (${f.t(a.share)}) and ${f.t(classWord(b.label))} (${f.t(b.share)}), with ${f.t(info.combosLeft)} weighted combos left.`);
  return out.join(' ');
}

// "Bucket by bucket: 5% CPFS, 91% showdown value, 3% air" (classes at 0.5% or more, HHP's order).
export function bucketsText(f, v, slot, shares, keys) {
  const list = keys.filter((k) => shares[k] >= 0.005).map((k) => `${Math.round(shares[k] * 100)}% ${SHORT[k]}`);
  return list.length ? `${v.pick(`${slot}.buckets`, ['Bucket by bucket:', 'All seven buckets, top to bottom:', 'Bucket by bucket, he\'s'])} ${f.t(list.join(', '))}.` : '';
}

// One of his actions: combos before → after, the class shifts, why, the brain line behind it.
export function changeText(f, v, slot, c, moved) {
  const shift = moved.length ? ` ${v.pick(`${slot}.shift`, ['Watch the buckets move:', 'Here\'s what that does to his buckets:', 'Buckets:'])} ${f.t(moved.join(', '))}.` : '';
  return `${f.b(`${c.what}.`)} ${v.pick(`${slot}.combos`, ['His range goes', 'That moves him', 'Combos go'])} ${f.t(`${Math.round(c.combos[0])} → ${Math.round(c.combos[1])}`)} combos (${f.t(`${Math.round(c.pctStart * 100)}%`)} of his starting range).${shift}`;
}
export function whyText(f, v, slot, reason) {
  const quote = reason.quote ? ` ${v.pick(`${slot}.bq`, ['The brain backs it:', 'Straight from the brain:', 'The brain:'])} ${f.q(reason.quote)}` : '';
  return `${v.pick(`${slot}.why`, ['Why?', 'Why does that happen?', 'How come?'])} ${f.t(reason.text)}${quote}${f.tag(reason.tag)}`;
}
export const widenText = (f, w) => `Plus, ${f.t(lower1(w.text))}${f.tag(w.tag)}`;
export function claimText(f, x) {
  return x.ok
    ? `That lines up with the brain: ${f.q(x.quote)}${f.tag(x.tag)}`
    : `⚖ Here the brain and his strategy don't agree, and this review doesn't pick one (not resolved). The brain says ${f.q(x.quote)}${f.tag(x.tag)}; his strategy gives ${f.t(x.got)}.`;
}
export const versusText = (f, v, slot, vs, pct) => `${v.pick(`${slot}.vs`, ['Where do you stand right now?', 'And your hand against all that?', 'How does your hand stack up right now?'])} You beat ${f.t(pct(vs.beat))} of his range, lose to ${f.t(pct(vs.lose))}, chop ${f.t(pct(vs.chop))}.`;

// ---------------------------------------------------------------- c) what happens if
const VERB = { fold: 'folds', call: 'calls', raise: 'raises', check: 'checks', bet: 'bets' };
export function whatIfIntro(f, v, slot, { eq, combos, exact, runouts, multiway, pct }) {
  const mw = multiway ? `${v.pick(`${slot}.mw`, ['It\'s multiway, so heads up:', 'Multiway pot, so keep in mind:'])} his answers treat him as next to act. ` : '';
  const how = exact ? 'exact' : `${runouts} sampled runouts`;
  return `${mw}${v.pick(`${slot}.wi`, ['Now the fun part: what happens if...?', 'So, what happens if...?', 'Let\'s run the options.', 'Okay, what happens if you...'])} Your equity vs this range: ${f.b(pct(eq))} (${f.t(`${combos} combos, ${how}`)}).`;
}
// "If you bet small ($35, 35% pot)" / "What you actually did: bet an in-between size ($59)"
export function optionTitle(title, isActual) {
  if (isActual) return `What you actually did: ${lower1(title)}`;
  return `If you ${lower1(title)}`;
}
export function optionSummary(o, pct) {
  const said = o.mix ? Object.entries(o.mix).filter(([, p]) => p > 0.005).sort((a, b) => b[1] - a[1]).map(([r, p]) => `${VERB[r] || r} ${pct(p)}`).join(', ') : '';
  return o.kind === 'fold' ? 'you give up the pot' : o.kind === 'call' ? `you need ${pct(o.need)}, you have ${pct(o.eqAll)}` : o.closes ? 'it checks through' : said ? `he ${said}` : '';
}
// One line per class: "His air (40% of his range): folds 80%, calls 20%."
export function classLines(f, o, classes, pct) {
  if (!o.byClass) return [];
  return classes.filter((c) => o.byClass[c.key]).map((c) => {
    const x = o.byClass[c.key];
    const acts = ['fold', 'call', 'raise', 'check', 'bet'].filter((r) => x[r] > 0.005).map((r) => `${VERB[r]} ${pct(x[r])}`);
    const name = /CPFS/.test(c.label) ? 'can-play-for-stacks hands' : c.label.toLowerCase();
    return `His ${f.t(name)} (${f.t(pct(x.share))} of his range): ${f.t(acts.join(', ') || 'does nothing')}.`;
  });
}
export const whoDoesWhat = (v, slot) => v.pick(`${slot}.who`, ['Who does what:', 'Here\'s who calls, who folds, who raises:', 'Class by class:']);
export const wantCallsText = (f, v, slot, t) => `${v.pick(`${slot}.wc`, ['Do you even want the calls?', 'Do you want the calls?', 'Ask yourself: do you want the calls?'])} ${f.t(t)}`;
export const nextText = (f, v, slot, t) => `${v.pick(`${slot}.nx`, ['Next street:', 'Then, next street:', 'Looking one street ahead:'])} ${f.t(t)}`;
export const lookHead = (f, v, slot, look) => `${v.pick(`${slot}.lk`, ['And on the', 'Now, on the', 'On the'])} ${f.t(look.street)} that actually came (${f.b(look.card)}):`;
export const prosText = (f, v, slot, list) => `${v.pick(`${slot}.pro`, ['The good:', 'What it has going for it:', 'Upside:'])} ${f.t(list.join(' '))}`;
export const consText = (f, v, slot, list) => `${v.pick(`${slot}.con`, ['The catch:', 'The downside:', 'What can go wrong:'])} ${f.t(list.join(' '))}`;

// ---------------------------------------------------------------- d) your action, graded
const PAST = { call: 'called', fold: 'folded', check: 'checked', raise: 'raised', bet: 'bet' };
// "Bet small ($194)" → "You bet small ($194)"; "Raise ($39)" → "You raised ($39)".
export function youDid(title) {
  const m = /^(\w+)(.*)$/.exec(title || '');
  if (!m) return `You: ${title}`;
  const w = m[1].toLowerCase();
  return `You ${PAST[w] || w}${m[2]}`;
}
const REACT = {
  '✅': ['Love it.', 'That\'s it.', 'Nice.', 'Good. Good.', 'Yes. That\'s the one.', 'Clean.'],
  close: ['This one\'s close, so don\'t lose sleep over it.', 'This was close, here\'s why.', 'Honestly? Close spot.', 'Not a big deal either way, it\'s close.'],
  sizing: ['Right idea, wrong size.', 'Love the idea, not the size.', 'Half right.', 'Close, but the size is off.'],
  '⚠️': ['Close, but not quite.', 'Not bad, but not the line.', 'Hmm, close one.', 'I don\'t hate it, but it\'s not the line.'],
  '❌': ['Okay, this one hurts a little.', 'We have to talk about this one.', 'Hold on, hold on.', 'I don\'t like it.', 'Yeah, no.', 'This is the one to fix.'],
  '⚖': ['No grade on this one, on purpose.', 'This one doesn\'t get a grade.', 'No grade here.'],
};
// The specific thing that was right, from the verdict's own source.
function whyRight(v, slot, a) {
  if (a.verdict.rule) return v.pick(`${slot}.wr`, ['That\'s the brain\'s line for this exact spot.', 'Exactly the line the brain gives here.']);
  if (a.verdict.size) return v.pick(`${slot}.wr`, ['Right line, and the size the brain\'s sizing rule picks.', 'Line and size both match the brain\'s sizing rule.']);
  return v.pick(`${slot}.wr`, ['And the math backs it up.', 'The math agrees with you.']);
}
// mark + reaction + what you did + the engine's reason (word for word) + what made it right/close.
export function gradeText(f, v, slot, a, pct) {
  const g = a.grade;
  const kind = g.mark === '⚠️' ? (g.close ? 'close' : g.sizing ? 'sizing' : '⚠️') : g.mark;
  const out = [`${g.mark} ${v.pick(`${slot}.re`, REACT[kind] || REACT['⚠️'])} ${f.b(`${youDid(a.actual.title)}.`)} ${f.t(g.text)}`];
  if (g.mark === '✅') out.push(whyRight(v, slot, a));
  if (g.close && a.real < 1) out.push(`And out of position, every EV here already counts only about ${f.t(pct(a.real))} of your equity${f.tag('[OUTSIDE SOURCE]')}.`);
  if (g.mark === '❌') out.push(v.pick(`${slot}.fx`, ['The verdict right below says why.', 'Here\'s the fix, right below.', 'Look at the verdict below and you\'ll see it.']));
  return out.join(' ');
}

// ---------------------------------------------------------------- e) the verdict, with its source
// An [HHP] verdict is "the play" with the brain's words; a math verdict says the math decides.
export function verdictText(f, v, slot, vd) {
  const hhp = /^\[HHP\]/.test(vd.source);
  const lead = hhp
    ? v.pick(`${slot}.vd`, ['Here\'s what I\'d do:', 'Here\'s the play:', 'The play here:'])
    : vd.size
      ? v.pick(`${slot}.vd`, ['The math says bet, and the brain\'s sizing rule picks the size:', 'No HHP line on whether to bet, so the math decides that; the brain\'s sizing rule picks the size:'])
      : v.pick(`${slot}.vd`, ['No HHP line covers this exact spot, so the math decides:', 'The brain doesn\'t have a line for this exact spot, so this one\'s on the math:', 'No brain rule for this one, so we go with the math:']);
  const why = hhp
    ? `${v.pick(`${slot}.bw`, ['The brain says', 'Why? The brain:', 'Straight from the brain:'])} ${f.t(vd.why)}`
    : `${v.pick(`${slot}.mw`, ['Why?', 'The numbers:', 'Here\'s why:'])} ${f.t(vd.why)}`;
  return `${lead} ${f.b(`${vd.title}.`)} ${why}${f.tag(vd.source)}`;
}
export function sizeText(f, v, slot, sz) {
  const lead = v.pick(`${slot}.sz`, ['On size:', 'And the size?', 'Now, how big?']);
  return `${lead} ${lead.endsWith('?') ? 'His' : 'his'} range is ${f.t(sz.why)}. The brain's sizing rule: ${f.q(sz.quote)}${f.tag(sz.tag)}`;
}
// Two brain rules pointing different ways (no ⚖ in the playbook): both shown, neither decides.
export function splitText(f, split) {
  return `Two brain lines point different ways here (no ⚖ in the playbook), so neither one decides and the math does: ${split.map((x) => `${f.t(x.title)} → ${f.t(x.line.toLowerCase())}${f.tag(x.tag)}`).join('; ')}.`;
}
export const mathNoteText = (f, v, slot, t) => `${v.pick(`${slot}.mn`, ['For the record:', 'Side note:', 'Just so you know:'])} ${f.t(lower1(t))}`;

// The quick take at the top: every decision's grade and verdict in one line each.
export function quickTakeHead(v) {
  return v.pick('qt', ['The short version first:', 'Quick take before we go street by street:', 'Here\'s the bottom line up top:', 'Short version:']);
}

// ---------------------------------------------------------------- f) something else worth remembering
export const alsoIntro = (v, slot, n) => (n > 1
  ? v.pick(`${slot}.ai`, ['A few more things from the brain worth remembering here:', 'Couple more things worth remembering:', 'Other stuff in the brain that fits this spot:'])
  : v.pick(`${slot}.ai`, ['One more thing worth remembering here:', 'Something else from the brain that fits:', 'Also worth keeping in your back pocket:']));
export const alsoRuleText = (f, r) => `${f.b(`${r.title}.`)} ${f.q(r.quote)}${f.tag(r.tag)}`;
export const alsoCatalogText = (f, c) => `${f.b(`Your read on a ${c.name.replace(/\s*\(.*$/, '').toLowerCase()}, ${c.field.toLowerCase()}:`)} ${f.t(c.text)}${f.tag(c.tag)}`;
export const alsoNothing = (v, slot) => v.pick(`${slot}.an`, ['Nothing else in the brain covers this spot.', 'That\'s it, nothing else in the brain on this one.', 'Nothing more from the brain here.']);

// ---------------------------------------------------------------- g) your known leak ([YOUR LOG], never HHP)
// Your own pattern from your own session log: a heads-up, not coaching content.
export function knownLeakText(f, v, slot, k, stakes) {
  const lead = v.pick(`${slot}.kl`, ['Heads up, this one\'s about you, from your own log:', 'Real talk, from your own session log:', 'Quick heads-up about your pattern (your log, not HHP):']);
  return `${lead} ${f.b(`${k.title}.`)} ${f.t(k.text)}${f.tag(k.tag)} ${v.pick(`${slot}.ks`, ['This hand is at {s}, the stakes your log flags.', 'And this one\'s at {s}.', 'This hand: {s}.']).replace('{s}', f.t(stakes))}`;
}
