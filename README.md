# HHP Hand Simulator

A mobile-first live NLHE cash simulator: 8-handed, $1/2, $1/3 and $2/5, about 200bb deep. Preflop decisions are graded against the Hungry Horse Poker charts in `data/preflop-ranges.csv`. Postflop goes to your coach with one tap.

No server and no API keys. Everything runs in the browser, and it works offline once it's installed.

## Put it on your phone

1. Open the GitHub Pages URL (`https://jackpokerclaude.github.io/Poker-Simulator/`) on your phone.
2. **iPhone (Safari):** tap Share, then **Add to Home Screen**.
   **Android (Chrome):** tap ⋮, then **Install app** (or **Add to Home screen**).
3. Launch it from the home-screen icon. After the first load it works with no signal.

Hands are saved on the device only. Use **History → Export CSV** to back them up, and **Import CSV** to restore or move them to another device.

## What it does

- **Dealing:** a real 52-card shuffle (crypto RNG). Stakes are random (60% $1/2, 25% $1/3, 15% $2/5), and so is your seat. You get about 200bb; villains get 80-400bb.
- **Live preflop action before you:** folds, limps, opens at live sizes ($10-25 at $1/2, scaled up for bigger games), isos, 3-bets and cold calls.
- **Only chart hands:** you're only dealt hands the chart plays (aggressive % or call % above 0) in the matching spot:
  | Spot | Chart family |
  |---|---|
  | Folded to you | RFI |
  | Limpers ahead | ISO |
  | Open ahead | vs-open |
  | Open + caller(s) | SQZ |
  | Open + 3-bet | COLD 4B |
  | You opened, got 3-bet | IP/OOP vs 3-bet |
  | You 3-bet, got 4-bet | CONTINUING vs 4B |

  Seat mapping: UTG and UTG+1 = EP, LJ = MP. When there's no exact chart for your seat or the villain's type, the closest one is used and tagged **no exact HHP chart**.
- **Villains:** hidden types (Passive, Aggressive, Thinking player, Whale, Loose-passive rec). You only see a live-style read, and the real type is revealed after the hand. They act on their type plus their actual hand strength and draws, and multiway pots are common.
- **Feedback:**
  - Chart grade for every preflop decision. Situational cells show Mark's rule instead of "wrong".
  - Your rule is enforced: only 5-bet AA.
  - HHP sizing checks: iso = 6x + 1bb per limper IP (7x OOP); 4-bet = ~2.5x IP or 3-3.5x OOP, and under 27.5% of the effective stack.
- **Copy for coach:** the full hand in the exact coach template, with the villains' real types.
- **History and stats:** tap any hand to re-copy it. See preflop accuracy by scenario, most-missed spots, and CSV export/import.
- **Drills:** Random, Multiway pots, 3-bet pots, Vs limpers, Blind defense, Big pots.

## Tweak it

- **Villain tendencies:** `config/villains.js`. Every number is in this one file: open/limp/3-bet ranges, postflop bet/raise/call behavior, table mix per stake, open sizes, and the read text.
- **Charts:** edit `data/preflop-ranges.csv`, then run `node tools/csv2json.mjs` to rebuild `data/ranges.json`.

## Develop

```bash
npx http-server -c-1 .          # or any static server, then open http://localhost:8080
node --test tests/*.test.mjs    # engine, side pots, grading, coach format, CSV
node tests/sim.mjs 500          # simulation report per drill
```

Showdowns use [pokersolver](https://github.com/goldfire/pokersolver) (MIT, vendored in `js/vendor/`). The villain AI uses a fast built-in evaluator, and the tests check that it agrees with pokersolver.

## Deploy

`.github/workflows/pages.yml` runs the tests and then publishes to GitHub Pages on every push. One-time setup: the repo must be public (or on a paid plan), and **Settings → Pages → Source** must be set to **GitHub Actions**.
