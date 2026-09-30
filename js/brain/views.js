// The views a ⚖ CONFLICT sets side by side, and the options of a ♣ OPEN question, for the
// rulings screen. Read from the conflict's own title ("X: [A] vs [B]", "size UP, or bet TINY?")
// or the question's lettered options "(a) ... (b) ...". When the title doesn't split cleanly the
// views are just "View A" / "View B" (the first and second view in the text shown below them).
const clip = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const tidy = (s) => s.replace(/\*\*/g, '').replace(/^[\s:;,.-]+|[\s.;,]+$/g, '').trim();

export function viewsOf(conflict) {
  const t = tidy(conflict.title || '');
  const colon = t.lastIndexOf(': ');
  const tail = colon >= 0 ? t.slice(colon + 2) : t;
  for (const re of [/\s+vs\.?\s+/i, /,?\s+or\s+/i]) {
    const parts = tail.split(re).map(tidy).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 5 && parts.every((p) => p.length <= 160)) return parts.map((p) => clip(p));
  }
  return ['the first view in the text', 'the second view in the text'];
}

export function optionsOf(open) {
  const out = [];
  for (const m of String(open.text || '').matchAll(/^\s*[-*]?\s*\*{0,2}\(([a-e])\)\*{0,2}\s*(.+)$/gm)) out.push(clip(tidy(m[2])));
  return out.length >= 2 ? out : ['the first option in the text', 'the second option in the text'];
}

export const LETTER = (k) => String.fromCharCode(65 + k); // 0 -> A
