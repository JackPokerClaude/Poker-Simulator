// Why a postflop playbook topic has no "Also from the brain" entry (js/brain/coverage.js).
// Key: `<file>|<first 48 chars of the normalized topic title>` (topicKey). Written by the app
// builder, not by HHP: default, Joan to review.
const PF = 'playbook-postflop.md|';
const WK = 'playbook-postflop-weakness-and-position.md|';
const BR = 'playbook-postflop-bluffs-and-rivers.md|';
const SIDE = 'A ⚖ side-by-side table with no "⚖ CONFLICT: Joan to decide" marker, so it isn\'t a parsed conflict. A rule would apply one side, which is Joan\'s call; it stays out of the matcher.';
const TELLS = 'Live physical or timing tells: the simulator has no tells to match.';
export const UNCOVERED_REASONS = {
  [`${PF}1. read his range first`]: 'Section intro ("Do this before picking an action or a size"): framing, no spot. The method bullets under it are covered.',
  [`${PF}current answer, c-bet size in a single-raised po`]: 'The "range-bet small" part hangs on ♣ OPEN #2 (range-bet the flop?), already shown as a conflict; its 20-25 vs half-pot sizes fall in the same small/in-between buckets, so no separate spot to match.',
  [`${WK}⚖ the small river lead: raise it, or call it? (j`]: `${SIDE} (Joan: keep both.)`,
  [`${WK}⚖ multiway flop checks through, then you act on `]: SIDE,
  [`${WK}⚖ a multiway c-bet: "too weak" or "run"? (hhp; d`]: `${SIDE} The non-⚖ reads (big multiway c-bet = strong, small = weak) are covered by other rules.`,
  [`${WK}5. out of position, as the preflop caller [08-18`]: 'Section intro (a student\'s leak, "too little aggression out of position"): no spot of its own; the section\'s flop/turn/river topics are covered.',
  [`${BR}current answer, how big is "significant" in doll`]: 'A dollar threshold for a "significant" bet: the matcher sees bet size as a share of the pot, not dollars at each stake.',
  [`${BR}⚖ a 3x raise: bluff clue or value? (hhp; dated v`]: SIDE,
  [`${BR}⚖ a big turn donk: strong or bluffy? (hhp; dated`]: SIDE,
  [`${BR}⚖ raising air vs a polar river bet (joan: keep b`]: `${SIDE} (Joan: keep both.)`,
  [`${BR}11. live tells [08-11, 07-28, 08-18]`]: TELLS,
  [`${BR}more live tells, marc's "40+ tells" video [2025-`]: TELLS,
  [`${BR}current answer, how much to trust a tell [02-10]`]: TELLS,
  [`${BR}timing tells vs a rec [2025-01-28 hhp, this poke`]: TELLS,
  [`${WK}out of position as the preflop raiser, the flop `]: 'New in brain batch 13 (2026-10-02, [undated HHP: start-over]). No matcher rule yet: the voice-layer run (2026-10-02) was told not to touch the matcher. Its check-everything-vs-recs line sits next to the range-bet views already shown as ♣ OPEN #2 and a logged ⚖ CONFLICT. Joan to review.',
  [`${BR}12. how marc says to practice`]: 'Practice advice (how to study), not a table spot.',
};
