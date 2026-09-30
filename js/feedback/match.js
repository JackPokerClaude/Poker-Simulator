// "Also from the brain": the compiled rules and conflicts whose conditions all match this spot.
// A condition the spot doesn't have (unknown key or missing value) never matches, so an entry
// only shows when it really applies. No padding.
import { group, sourceTag } from '../brain/compiled.js';

function test(when, f) {
  for (const [k, want] of Object.entries(when || {})) {
    if (k === 'board') {
      for (const [bk, bv] of Object.entries(want)) if (!f.board || f.board[bk] !== bv) return false;
      continue;
    }
    const have = f[k];
    if (have === undefined || have === null) return false;
    if (Array.isArray(want)) { if (!want.includes(have)) return false; } else if (have !== want) return false;
  }
  return true;
}

// f: spot features (spot.js) plus heroAction, heroCode, spot (preflop kind), limperPos.
// brain: the loaded brain (conflicts, open questions) so conflicts show their live text.
export function matchBrain(model, f, brain) {
  const rules = group(model.resolved, 'rules')
    .filter((r) => r.tag === 'HHP' && r.v && test(r.v.when, f))
    .map((r) => ({ key: r.key, title: r.v.title, quote: r.src.quote, tag: sourceTag(r), recommend: r.v.recommend || null }));
  const conflicts = group(model.resolved, 'conflicts')
    .filter((r) => r.tag === 'HHP' && r.v && test(r.v.when, f))
    .map((r) => {
      const c = brain?.conflicts?.find((x) => !x.summary && (x.title.includes(r.v.find) || x.text.split('\n')[0].includes(r.v.find)));
      const o = r.v.open ? brain?.openQuestions?.find((x) => x.id === r.v.open) : null;
      return {
        key: r.key, title: r.v.title, tag: sourceTag(r),
        kind: o && !c ? 'open' : 'conflict',
        block: c ? { file: c.file, section: c.section, dates: c.dates, title: c.title, text: c.text } : null,
        open: o ? { file: o.file, title: o.title, text: o.text, number: o.number, dates: o.dates } : null,
      };
    });
  return { rules, conflicts };
}

export { test as whenMatches };
