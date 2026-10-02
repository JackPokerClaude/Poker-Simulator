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
