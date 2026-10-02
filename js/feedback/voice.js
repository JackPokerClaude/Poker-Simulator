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
