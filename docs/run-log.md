# Run log

Autonomous run (started 2026-09-30). One item per commit; tests + phone/laptop browser run before every push.

## Status

| # | Item | Status | Commit | Tests |
|---|------|--------|--------|-------|
| 1 | Remove the prediction step | Done | b256886 (+ test fix efb582b) | 48 pass |
| 2 | Range chart at every decision, narrowed by what he did | Done | (this commit) | 50 pass |

## Notes and open issues

- Item 1's first deploy went red: a random-sample calibration test (rec open % sampled at 2.6% vs a 3% floor) was flaky. The deploy step was skipped, so the live site stayed on the previous version. Fixed by computing each type's open % exactly from its strategy instead of sampling.

- Item 2: range-claim check over 400 simulated hands: whale stabs keep less than 15% air in 20 of 63 cases (the brain says he over-stabs). Shown in-app as "⚖ Brain vs his strategy", not resolved. Other claims: poolCheckRaise 6/7 agree, multiwayDonk 36/37, recTelegraph 31/31, bigMultiwayCbet 11/11, passiveFolderRiver 6/6, smallDryCbet 4/4.

## Decisions for Joan

(defaults picked while you were away; each is [OUTSIDE SOURCE] or "default, Joan to review")

1. The table no longer shrinks below its normal size (that was only for the prediction panel, now removed).
2. Range claims (what an action means per the brain) are turned into checks with my thresholds: "mostly sets and two pair" = at least 50% strong value after a flop raise; "much stronger" / "not weak" / "too strong" / "telegraph" = strong-value share goes up after the action; the whale's stabs "keep air" = at least 15% air; a passive folder "gives up draws on the river" = at most 15% air in his river bets. [OUTSIDE SOURCE] thresholds, default, Joan to review.
3. Where his strategy and a brain claim disagree (e.g. whale stabs with little air left), the app shows both and resolves nothing. The fix is a recompile of the whale's numbers or a ruling: Joan to review.
4. "Your hand vs his range right now" compares made hands on the current board (before more cards). The equity line next to it includes the cards to come.
5. The range change "why" line names the strategy numbers behind the action; when those numbers are [OUTSIDE SOURCE] defaults it says so, and quotes the brain line that sets the direction when there is one.
