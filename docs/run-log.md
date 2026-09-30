# Run log

Autonomous run (started 2026-09-30). One item per commit; tests + phone/laptop browser run before every push.

## Status

| # | Item | Status | Commit | Tests |
|---|------|--------|--------|-------|
| 1 | Remove the prediction step | Done | b256886 (+ test fix) | 48 pass |

## Notes and open issues

- Item 1's first deploy went red: a random-sample calibration test (rec open % sampled at 2.6% vs a 3% floor) was flaky. The deploy step was skipped, so the live site stayed on the previous version. Fixed by computing each type's open % exactly from its strategy instead of sampling.

## Decisions for Joan

(defaults picked while you were away; each is [OUTSIDE SOURCE] or "default, Joan to review")

1. The table no longer shrinks below its normal size (that was only for the prediction panel, now removed).
