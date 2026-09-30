# Run log

Autonomous run (started 2026-09-30). One item per commit; tests + phone/laptop browser run before every push.

## Status

| # | Item | Status | Commit | Tests |
|---|------|--------|--------|-------|
| 1 | Remove the prediction step | Done | b256886 (+ test fix efb582b) | 48 pass |
| 2 | Range chart at every decision, narrowed by what he did | Done | e7c75f2 | 50 pass |
| 3 | HHP's seven hand classes | Done | b72b81e | 51 pass |
| 4 | Every decision in the five-step order | Done | (this commit) | 51 pass |

## Notes and open issues

- Item 1's first deploy went red: a random-sample calibration test (rec open % sampled at 2.6% vs a 3% floor) was flaky. The deploy step was skipped, so the live site stayed on the previous version. Fixed by computing each type's open % exactly from its strategy instead of sampling.

- Item 2: range-claim check over 400 simulated hands: whale stabs keep less than 15% air in 20 of 63 cases (the brain says he over-stabs). Shown in-app as "⚖ Brain vs his strategy", not resolved. Other claims: poolCheckRaise 6/7 agree, multiwayDonk 36/37, recTelegraph 31/31, bigMultiwayCbet 11/11, passiveFolderRiver 6/6, smallDryCbet 4/4.

- Item 3, your A-Q-J question: the old colors used a cut-off at the 88th percentile of hands vs random cards, which is why A5-A9 fell on one side and A4 on the other. It had no brain basis and is gone. Now on A-Q-J: AK and AT are thick value (top pair with the best or second-best kicker still available: K, then T), and A9 through A2 are all thin value (top pair, weaker kicker), per "TPTK, an overpair" (thick) and "KQ, AQ, weaker queens" (thin).
- Item 3: claim re-check with the seven classes (400 hands): whale stabs keep >=15% air in 32 of 45 cases; aggro folder flop raises reached 49% strong value (claim says 50%+) in 1 of 5.

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
