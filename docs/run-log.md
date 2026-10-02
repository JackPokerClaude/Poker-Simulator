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

# Voice-layer run (started 2026-10-02)

Goal: the feedback reads like an HHP hand review. Same content, same grading, new delivery. One step per commit; full suite before every push.

## Status

| Step | What | Status | Commit | Tests |
|---|---|---|---|---|
| pre | Fix the red deploy left by the batch 13 brain push | Done | b6d31e4 | 63 pass |
| 0 | Read the code, 15 varied fixture hands + a fixed 40-hand set (tests/fixtures/hands.json) | Done | a14cd88 | 64 pass |
| 1 | Voice guide docs/hhp-voice.md (brain phrasing + style-only transcript pass) | Done | fdc9c03 | 64 pass |
| 2 | Voice layer: js/feedback/voice.js (seeded phrase picks, HTML/text formatters) + voice-render.js; Coach / Plain switch (default Coach) | Done | (this commit) | 68 pass |

## Notes

- Before starting, the live deploy was red: the batch 13 brain push (47a0c3f) added a postflop topic ("OUT of position as the preflop RAISER, the flop default") with no matcher rule and no reason, so the coverage test failed and the deploy step was skipped (the live site stayed on acb65ce, never broken). Fixed by adding a reason in config/matcher-uncovered.js (no brain/ change, no matcher change). Also fixed a Windows-only path bug in the "every browser file parses" test (it passed on GitHub's Linux runner).
- Step 0: the preflop card builder moved out of app.js into js/feedback/preflop-card.js (same output) so tests can render it. tools/make-fixtures.mjs plays 2,500 random hands and greedily picks 15 that cover every street, every hero line, ✅/⚠️/❌/⚖, close calls, OOP realization, ⚖ conflicts and ♣ open questions, split brain lines, sized verdicts, lookaheads, the known-leak card and all 7 villain types; plus 40 more for the repetition test. Each is stored as a replay with its plain screen text and Copy for coach text. The snapshot test compares only while the brain hash matches, so a later brain push skips it instead of turning the deploy red.

## Decisions for Joan (voice run)

1. App-written labels no longer name a coach: "Mark's rule" → "HHP's rule" (preflop card, marks, Stats note), done before the snapshot. Brain quotes and source tags that contain a coach's name (e.g. a section title "12. How Marc says to practice", or CSV notes starting "SITUATIONAL (Mark)") are left exactly as the brain has them, because hard rule 6 says tags are copied exactly and the [HHP] test checks quotes against the brain. Joan to review.
