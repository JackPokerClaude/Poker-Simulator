// The compiled layer: numbers the app needs that the brain only says in words (how wide a
// passive player opens, how often a whale stabs...). Lives in brain-compiled/behavior.json.
//
// Every value is one record:
//   { v, src: { file, section, date, quote }, fb, interp }  sourced: [HHP]
//   { v, outside: "why" }                                    no source: [OUTSIDE SOURCE]
// src.quote must still appear in src.file (after normalizing markdown, quotes, dashes and
// case). If it doesn't, the playbook changed under it: the value is STALE, the app uses fb
// (an [OUTSIDE SOURCE] default) and Brain status asks for a "recompile brain" session.
// interp says how words became a number, when the number itself isn't in the quote.

export function normalizeText(s) {
  return String(s)
    .replace(/[“”„″]/g, '"').replace(/[‘’‚′]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|[\s(])\*(?=\S)|(?<=\S)\*(?=[\s).,:;!?]|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// texts: { fileName: raw text } of the loaded brain.
export function resolveCompiled(compiled, texts) {
  const norm = {};
  const normFor = (f) => (norm[f] ??= texts[f] == null ? null : normalizeText(texts[f]));
  const values = {};
  const stale = [];
  let sourced = 0, outside = 0, interpreted = 0;
  for (const [key, rec] of Object.entries(compiled.values || {})) {
    if (rec.src) {
      const body = normFor(rec.src.file);
      const ok = body != null && body.includes(normalizeText(rec.src.quote));
      if (ok) {
        values[key] = { v: rec.v, tag: 'HHP', src: rec.src, interp: rec.interp || '' };
        sourced++;
        if (rec.interp) interpreted++;
      } else {
        values[key] = { v: rec.fb ?? rec.v, tag: 'OUTSIDE', stale: true, src: rec.src, outside: `stale: the quote is no longer in ${rec.src.file}` };
        stale.push({ key, file: rec.src.file, quote: rec.src.quote });
      }
    } else {
      values[key] = { v: rec.v, tag: 'OUTSIDE', outside: rec.outside || 'default, Joan to review' };
      outside++;
    }
  }
  return {
    version: compiled.version, compiledAt: compiled.compiledAt, values, stale,
    counts: { total: Object.keys(values).length, sourced, interpreted, outside, stale: stale.length },
  };
}

// Value lookup with a default for keys the compiled file doesn't have.
export const val = (resolved, key, dflt) => (resolved?.values[key] ? resolved.values[key].v : dflt);

// Every key under a prefix, e.g. group(r, 'reads.passive') -> [{ key, v, tag, src }].
export function group(resolved, prefix) {
  return Object.entries(resolved?.values || {})
    .filter(([k]) => k === prefix || k.startsWith(`${prefix}.`))
    .map(([key, rec]) => ({ key, ...rec }));
}

// "[HHP] playbook-villains.md › The four player types · 2026-02-17" or "[OUTSIDE SOURCE] why".
export function sourceTag(rec) {
  if (!rec) return '[OUTSIDE SOURCE]';
  if (rec.tag === 'HHP') {
    const s = rec.src;
    return `[HHP] ${s.file}${s.section ? ` › ${s.section}` : ''}${s.date ? ` · ${s.date}` : ''}`;
  }
  return `[OUTSIDE SOURCE] ${rec.outside || ''}`.trim();
}
