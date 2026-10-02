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
