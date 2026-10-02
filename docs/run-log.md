# Run log

Autonomous run (started 2026-09-30). One item per commit; tests + phone/laptop browser run before every push.

## Status

| # | Item | Status | Commit | Tests |
|---|------|--------|--------|-------|
| 1 | Remove the prediction step | Done | b256886 (+ test fix efb582b) | 48 pass |
| 2 | Range chart at every decision, narrowed by what he did | Done | e7c75f2 | 50 pass |
| 3 | HHP's seven hand classes | Done | b72b81e | 51 pass |
| 4 | Every decision in the five-step order | Done | 6a551cc | 51 pass |
| 5 | OOP realization factor, math-only close calls | Done | b8ea613 | 52 pass |
| 6 | Preflop card: ✅/⚠️/❌ + one-line reason | Done | 906fca6 | 52 pass |
| 7 | Known leak line: second person, [YOUR LOG] | Done | c62a145 | 53 pass |
| 8 | Range paragraphs: HHP base vs seat widening, sources for every number | Done | 843d35a | 54 pass |
| 9 | Copy for coach rebuilt around the new format | Done | 2275870 | 55 pass |
| 10 | "Also from the brain" matcher coverage, in batches (59/74 topics; the other 15 listed with reasons) | Done | 02d8446 (13/74), b79a031 (24/74), 6cae08f (43/74), 4da00db (59/74) | 57 pass |
| 11 | Reg/pro villain type, 2024 PRO charts, 1/3 and 2/5 mix | Done | 9ef2998 | 59 pass |
| 12 | 100bb LJ chart when effective stacks are closer to 100bb | Done | 0d7f722 | 60 pass |
| 13 | What-ifs look one street ahead | Done | 5f25535 | 61 pass |
| 14 | Step 6: the rulings screen | Done | 5d28b60 | 63 pass |
| Final | 40 hands at phone size | Done | da97898 (+ test fix b0dcb7a) | 63 pass |

## Notes and open issues

- Item 1's first deploy went red: a random-sample calibration test (rec open % sampled at 2.6% vs a 3% floor) was flaky. The deploy step was skipped, so the live site stayed on the previous version. Fixed by computing each type's open % exactly from its strategy instead of sampling.

- Item 2: range-claim check over 400 simulated hands: whale stabs keep less than 15% air in 20 of 63 cases (the brain says he over-stabs). Shown in-app as "⚖ Brain vs his strategy", not resolved. Other claims: poolCheckRaise 6/7 agree, multiwayDonk 36/37, recTelegraph 31/31, bigMultiwayCbet 11/11, passiveFolderRiver 6/6, smallDryCbet 4/4.

- Item 3, your A-Q-J question: the old colors used a cut-off at the 88th percentile of hands vs random cards, which is why A5-A9 fell on one side and A4 on the other. It had no brain basis and is gone. Now on A-Q-J: AK and AT are thick value (top pair with the best or second-best kicker still available: K, then T), and A9 through A2 are all thin value (top pair, weaker kicker), per "TPTK, an overpair" (thick) and "KQ, AQ, weaker queens" (thin).
- Item 3: claim re-check with the seven classes (400 hands): whale stabs keep >=15% air in 32 of 45 cases; aggro folder flop raises reached 49% strong value (claim says 50%+) in 1 of 5.

- Item 3's deploy run went red on a GitHub Pages server error (HTTP 502 while creating the deployment; tests had passed). Item 4's deploy right after it went green, so the live site was never broken.

- Item 8: every "Why" line now splits the HHP base number (e.g. "HHP base: he opens about 14% of hands") from the seat widening (a separate line tagged [OUTSIDE SOURCE] config/table-settings.js). Under each change and each what-if option, "Where the numbers come from" lists every strategy number used (fold/continue thresholds, bet and raise frequencies) with its own tag: [HHP] file › section · date plus the quote, or [OUTSIDE SOURCE]. Fixed along the way: a 3-bet from someone who never limped was quoting the brain's limp-reraise line; that quote now only shows after an actual limp. New test: every [HHP] tag on screen names a real brain file and section, and any quote next to it is in that file.

- Item 9: "Copy for coach" is now built from the same feedback object as the screen (js/feedback/coach-report.js): hand facts, then per street the action line, and per decision his class % at the start of the street, each of his actions (combos and class % before → after, plus any unresolved brain-vs-strategy check), his range now, you vs his range, the options weighed with EVs, your action with its ✅/⚠️/❌ and reason, the verdict with its source tag, conflicts (not graded) and leak tags; then result, takeaway, hand leak tags (repeats flagged) and your known leak. Typical length 3-5k characters. New test checks each decision in the text has range, options, action, verdict (with its source) and leak tags, and only your 18 tags. In History, the text sits behind "Show the coach text" so the screen isn't a wall of monospace.

- Item 10, batch 0: Settings › Brain now shows how many postflop playbook topics the matcher covers and lists the rest. Coverage before any new rules: 13 of 74 topics.

- Item 10, batch 1 (playbook-postflop.md): 31 rules and 7 conflict pointers, every quote checked against the brain (0 stale). New spot features the rules needed: flop checked through, villain double-barreled, four to a flush, and your exact line (bet small/big). Coverage 13 → 24 of 74 topics. Side effect over 300 simulated hands: decisions with a matching ⚖ conflict (shown both ways, not graded) went from about 12% to 17%. One duplicate pointer dropped (the rec-river-check jam conflict is logged in two files; the existing pointer covers it).

- Item 10, batch 2 (playbook-postflop-weakness-and-position.md): 51 rules and 9 conflict pointers, 0 stale quotes. I tightened the drafts where the conditions only approximated the text: "flop checked through" now uses the real feature instead of "capped", "a bluffer" uses his postflop style (aggro caller) instead of his preflop type, a donk-lead rule lost its verdict power because "weak range" was only approximated, and three conflict pointers were narrowed (single-raised pots only; ace-high "board good for us"; ~100bb means under 150bb effective) so they don't leave half the flops ungraded. Coverage 24 → 43 of 74. Decisions with a matching ⚖ conflict (not graded): about 22% of postflop decisions over 300 hands. Known gap: one "⚖ CONFLICT ... extends the existing table" marker sits mid-line in a [2025-03-11 HHP] bullet in part 2, so the brain parser doesn't pick it up as its own conflict (the table it extends is covered).

- Item 10, batch 3 (playbook-postflop-bluffs-and-rivers.md): 70 rules and 1 conflict pointer, plus one more pointer for the "⚖ CONFLICT: Joan to decide" bullet about leading the turn after the flop checks through (it needed the new flop-checked-through feature). 0 stale quotes. Coverage 43 → 59 of 74. The 15 uncovered topics are listed in Settings › Brain with a reason each: 5 ⚖ side-by-side tables without a CONFLICT marker (a rule would apply one side), 4 live-tell topics, 2 section intros, practice advice, a dollar-size answer, and the c-bet size answer that hangs on ♣ OPEN #2. New test: every topic is covered or has a reason.
- Found while merging batch 3: new rules sometimes point at a different line than an existing rule in the same spot (e.g. vs a whale in a 3-bet pot: "he over-bluffs: over-call" vs "fish don't bluff big 3-bet-pot barrels: fold"). Before, whichever rule was defined first silently decided the verdict. Now, when matching rules disagree, none decides: the math does, and the screen and coach text say "Brain lines disagree here (no ⚖)" and list both with sources. About 8 of 523 decisions in a 300-hand run. Ungraded (⚖) decisions after batch 3: about 23%.

- Item 11: new villain type "Reg / pro" at 1/3 (weight 6) and 2/5 (weight 12), never at 1/2. When a pro opens, you're graded against the 2024 PRO charts (both ACTIVE, no 2026 equivalent): [EP VS PRO OPEN] (exact for EP vs an EP pro) and [BTN VS CO PRO OPEN] (exact for BTN vs a CO pro); other seats get the closer one as an [OUTSIDE SOURCE] stand-in, blinds keep the BB charts. BTN vs a CO pro with a fish still to act behind hits the logged "⚖ CONFLICT: Joan to decide" (value 3-bet QQ/JJ/AQs/AK vs flat the middle): not graded, both views shown. JJ/AQs in position vs a pro's 3-bet is ♣ OPEN #3: not graded. Along the way, preflop "Also from the brain" now matches every preflop decision you made (it only looked at the first one, so rules about facing a 3-bet or 4-bet, like your 5-bet-AA-only rule, never showed on the later decision). Pro reads are brain quotes from the 40+ tells video (tops up to the max, $1k chips from a pocket, buys in with $100 chips).

- Item 12: the 100bb LJ open chart [2025-02-18 HHP] is compiled from playbook-preflop.md section 3 (36 hands: no A2s or suited connectors below T9s; ATo, KJo, QJo come in) and used for an LJ open when the effective stack (your stack vs the biggest stack still to act) is under 150bb. It's rare in the current deal (about 4 of 266 LJ opens in a 4,000-hand sample) because you always sit with about 200bb and someone behind is usually deep. The pro still opens the 200bb LJ chart.

- Item 13: every heads-up what-if that goes to the next street (your call, a check-through, his check-back, his call of your bet) now deals the card that actually came and shows what his continuing range does there (his real strategy on that card: bet %, what his bets are made of) and what you'd do next (bet for value, check, call or fold his bet by pot odds, raise for value). It's in the expanded option and one line per option in Copy for coach. Multiway pots and river options have no lookahead. A full sample of every possible next card was about 1 second per decision in the test runner (several seconds on a phone), so it uses the one real card; feedback still builds in about 70ms per hand on average (worst about 320ms) in tests and 150-500ms in the phone-size browser run.

- Item 14: new Menu → Rulings tab with every ⚖ conflict (43) and ♣ open question (3) the brain parser finds. It opens with a summary line (how many ruled vs undecided), then each item collapsed: title, file › section · dates, one button per view (View A / View B / ... read from the conflict's own title; open questions use their (a)/(b)/(c) options), Both stand (All stand for 3+ views) and Undecided, plus the full brain text. The default is Undecided. Rulings are saved on the device and survive a reload. "Copy rulings for your brain session" gives a paste-ready list. The feedback screen and Copy for coach show "Your ruling: …" on a matching conflict, but nothing is applied or graded: the grading code never reads rulings (a test checks it).

- Final pass: 40 hands played in the browser at iPhone 13 size across the Random, Big pots, Blinds, Limpers and 3-bet drills, opening feedback every hand. Automated checks each hand: no sideways scroll on the table or the feedback sheet, no "undefined"/"NaN"/"null" text, no [HHP] tag without a source, no console or page errors. All clean. Feedback opened in 103ms median, 256ms at the 90th percentile, 423ms worst. Device storage after 40 hands was about 384K characters (replay data and full coach text are kept for the last 50 hands only). One layout fix from reading the screenshots: villain labels in the Hands cards were cut off with "…" on the phone ("Tight · pa…"); they now wrap. Nothing else looked wrong in the screenshots or the sampled full text.

- Item 14's deploy run went red: the item 12 LJ test picked a random LJ open, and about 1 time in 70 that hand is short-stacked, so it (correctly) used the 100bb chart while the test still expected the 200bb source tag. The deploy step was skipped, so the live site stayed on item 13's build and never broke. Fixed by making that test pick a deep LJ open (the 100bb chart has its own test); the suite ran clean 5 times in a row before the push.

## Decisions for Joan

(defaults picked while you were away; each is [OUTSIDE SOURCE] or "default, Joan to review")

1. The table no longer shrinks below its normal size (that was only for the prediction panel, now removed).
2. Range claims (what an action means per the brain) are turned into checks with my thresholds: "mostly sets and two pair" = at least 50% strong value after a flop raise; "much stronger" / "not weak" / "too strong" / "telegraph" = strong-value share goes up after the action; the whale's stabs "keep air" = at least 15% air; a passive folder "gives up draws on the river" = at most 15% air in his river bets. [OUTSIDE SOURCE] thresholds, default, Joan to review.
3. Where his strategy and a brain claim disagree (e.g. whale stabs with little air left), the app shows both and resolves nothing. The fix is a recompile of the whale's numbers or a ruling: Joan to review.
4. "Your hand vs his range right now" compares made hands on the current board (before more cards). The equity line next to it includes the cards to come.
5. The range change "why" line names the strategy numbers behind the action; when those numbers are [OUTSIDE SOURCE] defaults it says so, and quotes the brain line that sets the direction when there is one.
6. Seven-class sorting rules (the brain gives examples, not cut-offs): CPFS = sets, trips, two pair using both hole cards, straights, flushes and up. Thick = overpairs and top pair with the best or second-best kicker still available. Thin = top pair with a weaker kicker. Showdown value = second pair and lower, underpairs, AK/AQ-high. High-equity draws = 8+ outs (flush draws, open-enders, combos). Low-equity draws = 4-7 outs (gutshots). Air = the rest. Default, Joan to review.
7. Tiebreak for hands in two classes: the higher class in the brain's order ("can play for stacks > thick value > thin value > draws > showdown value > air"), so a weak pair with a flush draw is a high-equity draw, and top pair with a draw stays thick/thin value. Default, Joan to review.
8. Weak ace-high (A2-AJ without a pair or draw) is air, not showdown value; only AK/AQ-high count as showdown value (the brain's example is "AK-high"). Default, Joan to review.
9. Trips made with one hole card on a paired board count as CPFS, whatever the kicker. Default, Joan to review.
10. Out-of-position equity realization = 80% on the flop and turn, not applied on the river (no later street to lose equity on). Applied to every EV in the math, whether or not a brain rule decides the verdict. [OUTSIDE SOURCE] in config/outside-source.js.
11. "Math only, close" = the math-best line beats your action by less than 5% of the pot, when no brain rule or sizing rule decided the verdict. [OUTSIDE SOURCE] in config/outside-source.js.
12. Preflop card marks: chart play ✅; a mixed (non-situational) chart cell where you picked one of the mixed actions ✅ (it counts as correct in your stats too); situational cell ⚠️ (Mark's rule decides, not graded either way); off chart ❌; [OUTSIDE SOURCE] bracket opens: good ✅, borderline ⚠️, mistake ❌. Default, Joan to review.
13. Known-leak line: sentences addressed to a coach (mentioning "she", "Bring this up", "Treat...", "keep tracking") are dropped; the rest is rewritten to "you". It still shows only on 1/3 and 2/5 hands that had a leak or an off-chart preflop play. Default, Joan to review.
14. Seat widening multipliers (how much wider than HHP's base open % he plays from each seat) are [OUTSIDE SOURCE] in config/table-settings.js and are shown as their own line, never folded into the HHP number. Default, Joan to review.
15. Storage: the full coach review is kept for the same last 50 hands that keep replay data; older hands fall back to the short hand history (stakes, seats, action, result). "See full feedback" from History rebuilds the full text anyway while the replay exists. Default, Joan to review.
16. Coverage unit for item 10: a "topic" is one bold-headed paragraph in a numbered section of the three postflop playbooks, plus the bullets under it (or a section's bullets before its first bold paragraph): 74 topics. A topic counts as covered when a matcher entry (a rule or a conflict/open-question pointer) quotes a line inside it. Default, Joan to review.
17. New matcher rules only decide the verdict ("recommend") when the quote is a direct instruction for exactly that spot; everything else shows as advice under "Also from the brain". Where two brain lines give opposite advice in the same spot without a ⚖ mark, neither decides the verdict. Default, Joan to review.
18. "About 100bb" in the matcher (and for the LJ chart in item 12) = effective stack under 150bb, the midpoint between 100bb and 200bb. [OUTSIDE SOURCE] cut-off, default, Joan to review.
19. Two brain lines can show together under "Also from the brain" with opposite advice where the playbook itself disagrees without a ⚖ mark (e.g. fold showdown value to a big turn double barrel vs float the turn because live players under-triple-barrel). Neither decides the verdict; Joan to review whether those deserve a ⚖.
20. When two matching brain rules recommend different lines in the same spot and the playbook has no ⚖ for it, the verdict falls back to the math ([OUTSIDE SOURCE]) and both lines are shown. It's graded, unlike a ⚖ conflict, because the playbook didn't flag it. Default, Joan to review; these spots may deserve a ⚖ in the brain.
21. The 6 ⚖ side-by-side tables without a "⚖ CONFLICT: Joan to decide" marker (the small river lead, the multiway flop checking through, the multiway c-bet, the 3x raise, the big turn donk, raising air vs a polar bet) aren't matched at all, so neither side is applied. Default, Joan to review; they could get CONFLICT markers so they show up as ungraded side-by-sides.
22. The pro opens like HHP's own RFI charts (EP chart for UTG/UTG+1, the compiled LJ chart, HJ, BTN); CO and SB, which have no HHP chart, open his top 22% times the seat factor (CO about 30%). His other preflop numbers are [OUTSIDE SOURCE] except "rarely cold-calls a 3-bet" (HHP: "The regs play 4-bet-or-fold and rarely cold-call", read as a tenth of his normal calling). Postflop he's always an aggressive style ("More aggressive, thin value bets, empties the clip with bluffs"), 55% aggro folder / 45% aggro caller. Default, Joan to review.
23. Table mix: reg/pro weight 6 at 1/3 and 12 at 2/5 (about 1 in 17 and 1 in 9 seats). [OUTSIDE SOURCE] in config/table-settings.js, default, Joan to review.
24. "Fish behind" (for the BTN vs CO pro conflict) = a rec, passive player or whale still to act after you preflop. Default, Joan to review.
25. Effective stack for choosing the LJ chart = your stack vs the biggest stack still to act behind you; under 150bb uses the 100bb chart. Default, Joan to review. (Your own stack stays 190-210bb, so short-stack LJ spots are rare; say if you want a short-stack drill.)
26. Lookahead plan rule: with 65%+ equity vs his range on the next card, the plan is "bet for value" (or "raise for value" vs his bet); below that, check, and call his bet only with the pot odds. [OUTSIDE SOURCE] in config/outside-source.js, default, Joan to review. The lookahead uses the one card that actually came, not an average over all cards.
27. Rulings are records, not switches: a ruling made on the phone doesn't change grading or ranges. It shows on the conflict box and goes to your brain session via Copy rulings; once the brain itself is updated, the app follows the brain. Default, Joan to review (the alternative is to apply rulings on the device right away).
28. View labels on the rulings screen come from each conflict's title ("X vs Y", "A, or B"); where the title doesn't split, the buttons say "View A: the first view in the text" and so on. Default, Joan to review.

---

# Voice-layer run (2026-10-02)

Goal: the feedback reads like an HHP hand review. Same content, same grading, new delivery. One step per commit; full suite before every push; every push deployed green.

## Checklist

| Step | What | Status | Commit(s) | Tests |
|---|---|---|---|---|
| pre | Fix the red deploy left by the batch 13 brain push | Done | b6d31e4 | 63 pass |
| 0 | Read the code; 15 varied fixture hands + a fixed 40-hand set with "before" snapshots (tests/fixtures/hands.json) | Done | a14cd88 | 64 pass |
| 1 | Voice guide docs/hhp-voice.md (brain phrasing + a style-only transcript pass) | Done | fdc9c03 (examples refreshed in e60e120) | 64 pass |
| 2 | Voice layer (js/feedback/voice.js + voice-render.js), seeded phrase picks, Coach / Plain switch (default Coach) | Done | 682d275 | 68 pass |
| 3a | Hand opener | Done | 006c8e8 | 69 pass |
| 3b | His range at each decision, through the seven buckets | Done | f17d74e | 69 pass |
| 3c | What-ifs, option by option, each class's response | Done | 8422a9c | 69 pass |
| 3d | Your action graded (close calls + the 80% OOP note) | Done | b0bd49b | 69 pass |
| 3e | Sourced verdict + a quick take of every grade up top | Done | 95ca52c | 69 pass |
| 3f | Also from the brain → "something else worth remembering" | Done | ba5ba54 | 69 pass |
| 3g | Known-leak card, [YOUR LOG] | Done | 3d8e26c | 69 pass |
| 3h | Preflop card | Done | fd7b34e | 70 pass |
| 3i | Conflict displays: neutral, every view, dates, no winner | Done | 84e6aab | 72 pass |
| 3j | End-of-hand takeaway + leak tags | Done | 3e52a8f | 72 pass |
| 3k | Copy for coach in the voice, with the hand data | Done | 8a657dd | 73 pass |
| 4 | Tests (content, conflict, tag, repetition) + phone-size pass | Done | 682d275 … 8a657dd, f07e589 | 73 pass |
| 5 | Polish pass (10+ reviews read end to end) | Done | e60e120 | 74 pass |

Grading, math, range narrowing, the matcher and rulings were not touched. brain/, preflop-ranges.csv and config/brain-files.json were not touched. No transcripts were read in this session or stored in the repo (a subagent read a few and returned a ~500-word paraphrased style description).

## How it's built

- **js/feedback/voice.js**: phrase pools and sentence builders. Each builder gets the engine's data and passes every number, size, %, date, mark and tag through unchanged; glue phrases carry no strategy. Picks are seeded by the deal (same hand, same words; a History rebuild reads the same).
- **js/feedback/voice-render.js**: the coach-voice screen and Copy for coach, built from the same feedback object as the plain view. Grids, class tables, option math and "where the numbers come from" are the same pieces, one tap away.
- **Plain view** = the old structured format, unchanged (a snapshot test proves it while the brain is the same). Switch: Coach / Plain at the top of the feedback sheet, or Menu → Settings → Feedback. Copy for coach follows the switch.
- Engine change (additive only): the two range paragraphs also expose their parts (`pt.para`); `LINE_LABEL` is exported. The plain strings are byte-identical.
- New tests (tests/voice.test.mjs, 11): plain view + plain coach text unchanged vs snapshot; every $, %, bb, date, ✅/⚠️/❌/⚖/♣ and source tag of the plain view is in the voice view (count-strict) and the same for Copy for coach; determinism; five steps in order; ≤25% for any opener over the fixed 40 hands (and ≥6 different openers); every ⚖/♣ box lists every view + the dated playbook text and its own words name no winner; [YOUR LOG] never becomes [HHP] and [OUTSIDE SOURCE] counts never drop; the voice coach text has the per-decision structure; no coach named in app text; a ⚖ spot never gets "the play" in its verdict.
- Dev tools: `node tools/voice-sample.mjs 0,3,6 [--plain] [--coach] [--forty]` prints reviews; `tools/phone-check.html?n=40&view=voice` (served locally) is the phone-size pass; `node tools/make-fixtures.mjs` rebuilds the fixtures.

## Phone-size pass (375×812)

40 random hands per run (Random, Big pots, Blinds, Limpers, 3-bet, Multiway), every collapsed section opened, checked for sideways scroll, ellipsis cut-offs, elements sticking out, undefined/NaN/null text and [HHP] tags without a source. Coach voice: 0 problems in each of 3 runs (the final one after the polish). Plain: 0 problems. The quick take (every verdict) ended at most 532px down, so it's always on the first screen. Render time: median 50-99ms, 90th percentile 161-204ms, worst 269ms. Also played a real hand in the app at phone size and switched Coach ↔ Plain: no console errors.

## Notes

- Before starting, the live deploy was red: the batch 13 brain push (47a0c3f) added a postflop topic ("OUT of position as the preflop RAISER, the flop default") with no matcher rule and no reason, so the coverage test failed and the deploy was skipped (the live site stayed on acb65ce; never broken). Fixed with a reason in config/matcher-uncovered.js (no brain/ change, no matcher change). Also fixed a Windows-only path bug in the "every browser file parses" test.
- Step 0: the preflop card builder moved from app.js into js/feedback/preflop-card.js (same output). tools/make-fixtures.mjs played 2,500 hands and greedily picked 15 covering every street, every hero line, ✅/⚠️/❌/⚖, close calls, OOP realization, ⚖ conflicts and ♣ open questions, split brain lines, sized verdicts, lookaheads, the known-leak card and all 7 villain types; plus 40 more. The snapshot test only compares while the brain hash matches, so a brain push skips it instead of turning the deploy red; the plain-vs-voice content tests always run.
- The content test caught one of my own polish edits (I had de-duplicated "Raise to $35. Raise to $35 has the best EV", which dropped one "$35"). Reverted: content wins over smoothness.

## Decisions for Joan (voice run)

1. **No coach names in app text.** "Mark's rule" → "HHP's rule" everywhere the app writes it, and the CSV chart notes' "SITUATIONAL (Mark)" now *display* as "SITUATIONAL (HHP)" in both views and Copy for coach (the CSV is unchanged; the snapshot test allows exactly that relabel). Brain quotes and source tags that contain a name (e.g. a villains tag "(Marc, *Exploit Any Player…*)", section "12. How Marc says to practice") are left exactly as the brain has them, because rule 6 says tags are copied exactly. Joan to review.
2. **Default is Coach voice**; the switch is remembered per device. Copy for coach follows the switch, so with Coach on, the copied text is the voice review plus all the hand data and the labeled lines (His range / Options weighed / Your action / Verdict / Leak tags). Joan to review.
3. **Collapsed by default in the coach view:** range grids, option details (class by class, math), "where the numbers come from", conflict boxes, whole-hand villain notes. The plain view is unchanged. Joan to review.
4. **Quick take at the top** (one line per decision: grade, what you did, the verdict) so every verdict is visible without scrolling. It repeats what the steps say. A math-only close call shows "X, by a hair (math only)". Joan to review.
5. **Who says "I"**: "Here's what I'd do / Here's the play" only on [HHP] verdicts. Math verdicts say the math decides; when the math picks betting and the brain's sizing rule picks the size, it says exactly that. On ⚖ spots the verdict line is "for reference only (the ⚖ below is still open)". Joan to review.
6. **Reactions** ("Love it.", "Hold on, hold on.", "I don't like it.", "Yeah, no.", "We have to talk about this one.") are paraphrased style, never in quote marks, never tied to a video. The ✅ follow-up names what was right from the verdict's source ("Exactly the line the brain gives here" / "Line and size both match the brain's sizing rule" / "The math agrees with you"). Joan to review.
7. **The 80% OOP note** is added to a close-call grade only when the engine actually applied the realization (out of position before the river). Joan to review.
8. **Conflict boxes** list the views as View A / B / C read from the conflict's title (the same parser as the Rulings screen; generic labels where the title doesn't split), then the playbook's full text with its dates. Joan to review.
9. **Known-leak card** adds one line from the hand itself ("This hand is at $1/$3, the stakes your log flags"). Joan to review.
10. **Opener**: the "main guy" is the preflop villain; everyone else in the pot gets a short "(type)". Joan to review.
11. History → hand detail (the old preflop-only cards) stays in the plain card format. Joan to review.
12. The batch 13 topic got an "uncovered" reason instead of a matcher rule, because this run couldn't touch the matcher. A future matcher run could add it. Joan to review.
13. The content test is count-strict for $, %, bb, dates, marks and source tags (an altered duplicate fails), set-only for bare numbers. Joan to review.

## Things that read a little off, or I wasn't sure about

- Math verdicts repeat the title ("Raise to $35. The numbers: Raise to $35 has the best EV: $51."), because every number of the plain view must survive exactly. A little redundant, kept on purpose.
- Engine sentences kept word for word sometimes read mechanical inside the voice ("Bet an in-between size is close (about $2.8 worse), but check is the line").
- The engine still computes a verdict on ⚖ spots; the voice now labels it reference only, but it's still on screen (same as the plain view).
- "(some numbers are [OUTSIDE SOURCE] defaults, listed below)": "below" is the collapsed "Where the numbers come from".
- One fixture hand grades a turn raise ⚠️ with "Fold is the line" while the raise's own EV is higher (a brain rule decides). That's grading, not voice, so untouched; worth a look in a rulings session.
- The coach view is longer: about 1.7× the plain text when every section is expanded (median 33k vs 19k characters in one run). Collapsed, the first screen is the opener + quick take.
- The engine's existing takeaways carry the jokes ("Free cards are for charity", "Hero call, zero hero"); the voice adds light glue humor only, never in the advice.

## Before / after (3 samples)

**1. Fixture #7, flop K♣ K♠ 8♠, quads, you call an $11 bet (❌)**

Before (plain):
> What is SB's range? … SB bet big $11 (69% pot): Showdown value 29% → 91%. Mostly showdown value (91%) and cpfs (5%); 26 weighted combos left.
> ❌ You: Call. Call costs about $24 vs raise.
> Verdict: Raise to $35. Raise to $35 has the best EV: $51. [OUTSIDE SOURCE] math vs his real range (one-street EV)
> Also from the brain: Nothing else in the brain covers this spot.

After (coach voice):
> What's SB's range? After SB bet big $11 (69% pot), the big mover is showdown value: 29% → 91%. Bottom line, he's mostly showdown value (91%) and can-play-for-stacks hands (5%), with 26 weighted combos left. … Bucket by bucket, he's 5% CPFS, 1% high-equity draws, 91% showdown value, 3% air. Where do you stand right now? You beat 100% of his range, lose to 0%, chop 0%.
> Okay, let's play it out. … If you raise to $35: he calls 96%, folds 3%, raises 1%. EV +$51. Upside: The hands that call are worse: you have 100% vs them.
> ❌ We have to talk about this one. You called. Call costs about $24 vs raise. The verdict right below says why.
> The verdict: No brain rule for this one, so we go with the math: Raise to $35. The numbers: Raise to $35 has the best EV: $51. [OUTSIDE SOURCE] math vs his real range (one-street EV)
> Something else worth remembering: Nothing more from the brain here.

**2. Fixture #9, flop 5♥ Q♣ 3♣, A♦A♣, you bet $59 into $99 (⚠️ sizing)**

Before (plain):
> ⚠️ You: Bet an in-between size ($59). Right idea (bet), wrong size: bet small here. In-between sizes are the worst of both.
> Verdict: Bet small ($35, 35% pot). Betting beats checking: best bet $111 vs check $78. [OUTSIDE SOURCE] math vs his real range (one-street EV)
> Size: his range is uncapped (16% of his range is strong value). "Uncapped: go small, with value AND bluffs, or just call." [HHP] playbook-postflop.md › 2. Bet sizing: small or big, never in between · 2026-08-04
> The math alone would pick bet big ($75, 76% pot) ($111 vs $96) [OUTSIDE SOURCE]; the brain decides.

After (coach voice):
> ⚠️ Close, but the size is off. You bet an in-between size ($59). Right idea (bet), wrong size: bet small here. In-between sizes are the worst of both.
> The verdict: The math says bet, and the brain's sizing rule picks the size: Bet small ($35, 35% pot). The numbers: Betting beats checking: best bet $111 vs check $78. [OUTSIDE SOURCE] math vs his real range (one-street EV)
> And the size? His range is uncapped (16% of his range is strong value). The brain's sizing rule: "Uncapped: go small, with value AND bluffs, or just call." [HHP] playbook-postflop.md › 2. Bet sizing: small or big, never in between · 2026-08-04
> For the record: the math alone would pick bet big ($75, 76% pot) ($111 vs $96) [OUTSIDE SOURCE]; the brain decides.
> Also worth keeping in your back pocket: Small or big, never in between. "In-between is the worst of both: better hands call and your targets fold." [HHP] playbook-postflop.md › 2. Bet sizing: small or big, never in between

**3. Fixture #2, flop 9♥ 7♥ 6♣ multiway, you check (⚖ not graded)**

Before (plain):
> ⚖ You: Check. Not graded: this spot is an open ⚖ conflict / ♣ question in your playbook. Both views are below.
> Verdict: Check. "He over-calls: under-bluff." [HHP] playbook-postflop-bluffs-and-rivers.md › 9. Adjust by player type
> ⚖ CONFLICT (not graded, both views): Likely-stabbed flop as the raiser: bet thick value, or check it all?

After (coach voice):
> ⚖ This one doesn't get a grade. You checked. Not graded: this spot is an open ⚖ conflict / ♣ question in your playbook. Both views are below.
> The verdict: No grade, and the ⚖ below stays open. For reference only, the verdict line: Check. The brain says "He over-calls: under-bluff." [HHP] playbook-postflop-bluffs-and-rivers.md › 9. Adjust by player type
> ⚖ The playbook keeps two views here, side by side (not graded): Likely-stabbed flop as the raiser: bet thick value, or check it all?
> Both views, side by side: View A: [2025-04-01 HHP] is on the right-hand ("check the ENTIRE range") side of the table above,… / View B: [2025-08-12] in a multiway SRP
> The playbook's own text, dated 2025-04-01, 2025-08-12: (the full ⚖ CONFLICT text follows, unchanged)
