# Deep-Stack Playbook, 400bb (Hungry Horse Poker)

**Source:** Marc Goone, *If You "Quit While You're Ahead" When Deep Stacked, Watch This*, 2026-09-01. One 400bb spot from *How I Know When to Hero Call*, 2026-07-28, marked **[07-28]**. Deep spots from *Why Huge Crushers Stick It In Slowly*, 2026-06-09 **[06-09]**, and *How I'd Make $100k in 2026, if I Had to Start Over*, 2026-06-30 **[06-30]**. "Very deep" and 500bb spots from *This Blind Spot Keeps Winning Players at Low Stakes*, 2026-01-27 **[01-27]**, and deep spots from *How I'd Exploit Any Player After a Couple Hands*, 2026-02-17 **[02-17]** (stack not stated, "not at 100-150bb"). One 300bb spot from **Gethen Jacobs** (a different HHP coach; Marc hosts), *This Poker Strategy Should Be ILLEGAL (It's Not)*, 2026-04-28 **[04-28]**. **Oldest Marc videos (batch 6, merged 2026-09-29; tags carry the year):** one 400bb hand from *This Mistake Cost Me $1 Million*, 2025-12-16 **[2025-12-16]**; one 400bb hand from *90% of Money Is Won on the River*, 2025-09-30 **[2025-09-30]**; 300bb hands from *The 9 Player Types*, 2025-10-28 **[2025-10-28]**.

**Game assumed:** live NLHE cash, 2/5 and 2/5/10, 400bb unless noted. For 200bb, use `playbook-preflop.md` and the postflop playbook (`playbook-postflop.md` sections 1-3, `playbook-postflop-weakness-and-position.md` sections 4-6 and `playbook-postflop-bluffs-and-rivers.md` sections 7-12; "postflop section N" refers to whichever file holds that number).

*Last merged 2026-09-29 (batch 12 added section 9, the 200bb vs 100bb depth block, and one superseded pointer in section 7), from 14 approved notes. **Section 8 is the villain cheat sheet.***

---

## 1. A common leak Marc teaches: quitting when deep in a soft game
*This is a general HHP lesson, not one of Joan's leaks. Hers live in her claude.ai Project instructions.*
- **The mistake:** racking up to "lock up a win" or to dodge tough spots when you're deep at a soft table.
- **Spot it:** you're up a buy-in or two, 400bb deep with recs, and you catch yourself thinking "time to go" or "I don't want a tough spot."
- **The fix:** stay. Deep plus soft is when your edge and win rate are highest: "the most profitable spot in all of poker." Marc admits he has caught himself doing it too. The 07-07 video says the same: decide to leave on process, not results (see `playbook-game-mindset.md`).

## 2. Preflop at 400bb
- **3-bet more hands that make the nuts:** suited Ax and suited Kx.
- **3-bet less** offsuit broadway (KJo, KQo, KTo, ATo) and small suited connectors (56s-89s). Deep, reverse implied odds kick in: flush over flush, straight over straight.
- **Continue much wider vs 3-bets in position** with suited Ax, suited Kx, suited broadways and pairs. Trash Kxs vs a SB 3-bet is a snap-fold at 200bb but a call at 400bb.
- **Don't 4-bet offsuit hands out of position** at 400bb.
- **BB vs a rec's 9x UTG open, with a cold-caller [2025-12-16]:** at 100-200bb, "always fold" T6cc. At 400bb it's a speculative call (the CSV has T6s as a fold at 200bb; 400bb isn't charted). The huge open is "very telling" (AA, KK, AQ, sometimes QQ). The hand's postflop line and the ⚖ vs 09-01 are in section 6.
- **Facing a 3-bet in position, 4-bet POLAR:**
  - **Tight setup** (e.g. an AQ opener vs a SB 3-bet): 4-bet AA, KK, maybe AKs. Bluff with the worst suited Ax/Kx that would otherwise continue (A5s, A9s, KTs, KJs). **Call** QQ, JJ, TT, AK, AQs and AQ. 4-betting AQ in position is a common mistake.
  - **Wider setup:** add QQ, AKs and AQs for value, and use worse bluffs (A2s, A3s, A6s, K6s-K4s), because A5s and A9s become calls.
  - **Vs a "super passive patty"** who only 3-bets the top: no 4-bet bluffs, only very good hands.
- **Facing a 3-bet out of position, 4-bet LINEAR:** AJs, AQs, ATs, KQs, 99-type hands. That cuts the SPR, and the pool calls 4-bets too wide.
- **Facing a 4-bet:**
  - **Vs competent players:** no 5-bet range. Call AA, KK, AK and JJ, and fold the rest.
  - **Vs a fish:** 5-bet AA and only AA, and don't worry about balance.
  - **5/10 at 500bb vs a good pro [06-30]:** you squeeze AKs and call his 4-bet. The turn checks through, and he'd have kept betting KK. On the river, bet small to price in QQ/JJ, OR check and check-raise jam to fold AA/AK. With QQ facing his turn double barrel: fold (KK, AA, AK).
- *At 200bb, the preflop playbook's in-position polar 4-bet value range is QQ+ and AK. At 400bb it tightens to AA, KK and maybe AKs. That's a depth adjustment, not a conflict.*

## 3. Bluffing deep: block the hands you want to FOLD
- **Monotone flop, you hold the ace of that suit** (ATo with the Ah): small c-bet, bet 3x pot on the turn, jam the river. Villains check-raise their small flushes and sets on monotone flops; the only hand they trap is the nut flush, which you block. "Just butter."
  - **With the K of that suit instead:** go small on the turn. He can still be trapping the Ax flush.
- **Ace-high static dry board, 75cc:** overbet-or-check. Overbet value (AK+, sets, two pair) and add 3-street blocker bluffs: overbet the flop, bet big on the turn, 2x pot on the river. The 7 blocks his traps (A7s, 77). Most 2/5/10 players won't stack one-pair Ax for 400bb.
  - **Don't bluff JT there:** it blocks AJ and AT, the exact hands you want to fold ("blockers to what?"). Check back and bluff the turn if he checks again.
- **Deep vs a passive FOLDER [02-17]** (not at 100-150bb, and not vs sticky players):
  - He check-raises your J92 c-bet: that's J9, 22, AJ, few draws. Float wider in position. On the turn, bet the biggest size that still leaves a river overbet, then jam. He folds even J9/22 "when you tell them twice."
  - You 3-bet 99, flop top set, get check-raised on the turn and call. He bets small on a flush river: jam. Your line looks very strong, and the jam folds his A-high flush. "Care way less about your line making sense." Never show the bluff.
- **BB, the flop checks through, and an ace comes on the turn:** check. When he stabs, make a big check-raise bluff, ideally holding a 9 or a 2 (blocking A9s and A2s, the two pairs that won't fold). On the river, bet about 1.5-1.7x pot to fold AK, AQ and AT.

## 4. The check-raise-then-check tell
- **You call his flop check-raise, the turn completes the flush, and he checks:** he has no flush. Bet nearly 2x pot on the turn, then "empty the clip" on the river. The pool doesn't check-raise draws enough, and players who do keep betting when they hit.
- **If the turn PAIRS the board instead:** don't. Sets and two pair just made full houses and slowed down. Check back, or bet about half pot to keep draws in. Go small on the river.
- *Hold yourself "logically accountable":* if you'd only play a medium pot with a 6-high flush, don't claim he never folds.
- **The same tell at 300bb [06-30]:** bet the turn (the biggest size J9 still calls), then shove the river (about $1,100 into $800). The pool check-raises naked flush draws only about 8-15% (Marc's number). If your pool never folds J9/22 here, check back instead. If the turn pairs: small turn, very small river.
- **The same tell in the oldest video, two more types at 300bb [2025-10-28]:**
  - **Monster-under-the-bed folder:** you float his flop check-raise (lots of room deep) with an open-ender, and he checks the 3s turn. He has 99/22/J9s and no flush (he'd play flushes passively). Bet the turn "really really big" (capped but inelastic), then "empty the clip" on the river: after a check-raise and a turn check this type folds even the top of his range.
  - **"GTO wizard":** he 3-bets, you call a suited connector, the turn brings a flush and he checks it back: "almost never" a flush at this depth, so his range is AA/AK/KQ/KJ and missed draws. On the river check, and if he bets, make a big check-raise as a bluff (he folds AK/AA). Don't lead: it "accomplishes nothing."
- **The 300bb version in the [04-28] guest video** (you range-bet small in position, BB check-raises 4x, you call, the flush turn gets checked). Value and bluffs use DIFFERENT turn sizes:
  - **Value (76ss, the flush):** turn 450-500, so the river SPR pot-commits him, then jam. Folding 22/J9 would take at least 2.5x pot. "Go for gold this deep."
  - **Bluff (KQcc):** turn about pot (300 max), keeping $1,000+ behind so he isn't pot-committed and you have room to jam the river. "OK if I get snap-called 5% of the time."
  - **KK:** check back the turn, bet 250-300 on the river for thin value.
  - Same read as Marc's 06-30 line (the check means no flush). Marc sizes the turn by what J9 still calls. Gethen splits the turn size by hand type. That is a different spot/detail from the same HHP channel, not a ruling.

## 5. Fold more bluff catchers deep
- **A-K board, you overbet top two, and he check-raises the turn:** it's a set. Snap-fold. Marc did, and villain showed 88. A8 and A2 two pair would just call.
- **Fold the second nuts to a river jam at 400bb [2025-06-10 HHP]:** a combo-draw check-raise on the flop, a big turn, the flush on the river: bet half pot (you can't jam for value vs overpairs and sets) and fold to his jam. He under-bluffs, so every bluff catcher is worth more as a fold. Same for trips vs a river jam from an aggressive player with nine value combos (postflop section 7).
- **A river overbet jam after you showed heavy aggression:** fold two pair. Worse value doesn't jam; the pool won't turn weak hands into bluffs.
- When all the money goes in deep, the pool is "way way way under-bluffing," so every bluff catcher is worth more as a fold.
- **"Disrespectful folds" [01-27]:**
  - **Very deep, second-nut flush:** UTG opens, you defend the BB with a monster combo draw, check-raise the flop, make your hand and size down on the turn, then overbet an ace river. He jams: fold. He never jams a worse flush, and the stiff nut-flush-blocker bluff comes from no-pair hands, not from his AT, top set or 77/66.
  - **500bb, set of 4s on a static dry A-high board:** bet big, about 2x pot on the turn, 2x pot on the river (AJ/AT won't fold), then fold to his jam for 700 more. Don't call because the price is good. The pool doesn't bluff here or go thin enough for value.
  - Test: "Are they doing it?" Players don't turn two pair or sets into bluffs.

## 6. Build the biggest pot
- **Out of position, check turns more.** Barreling folds out the hands you crush, and sets or two pair won't fold anyway. Let them stab, then check-raise.
- **3-bet pot with an overpair after two checks:** at 200bb, bet the turn and river for value. At 400bb, check the turn AGAIN and check-raise his bet. He puts you on AK, so his air bluffs and his pairs bet for protection. You may need a smaller river size, because deep he'll fold 8x and 77.
- **400bb 3-bet pot, you range-bet small and get called, then a K turns and he checks [06-09]:** bet about 1/3 pot. He's elastic, and 9x/88/TT/JJ float a small bet but fold to a big one. On the river, a "little baby bet" bluff folds the floats. The most profitable bluff is one that gets called twice, then folds.
- **TPTK is not an 800bb-pot hand out of position** (except vs a wild maniac). Still check-raise high-equity NUT draws. Be careful check-raising non-nut combo draws (76dd, 65dd, T9dd).

**400bb, check-raise and jam a combo draw [09-01, 2025-12-16] (merged: 09-01 is the general caution, 2025-12-16 is the one hand and its test).** Be careful check-raising non-nut combo draws (76dd, 65dd, T9dd); still check-raise high-equity NUT draws [09-01]. Marc's own example [2025-12-16]: BB, no straddle, a rec's 9x UTG open (45), a CO cold-caller, 400bb. UTG c-bets multiway on a combo-draw flop and the CO calls. He check-raises with T6cc (the solver says +$109 EV but assumes unrealistic folds), then on the 4 turn jams about $1,500 into $900 (1.5x pot). Villain: the huge UTG open is "very telling" (AA, KK, AQ, sometimes QQ, JJ, TT); the solver has AA/KK/AQs folding about 68% combined to the flop check-raise, but Marc: "I don't think our opponent's going to be folding top pair and overpairs." The test: with "a mountain of equity" you need little fold equity. His nodelock: if they fold 33% on the flop and 50% on the turn the jam is still profitable but "murky"; if they call 66% on the turn the jam still wins, but checking and realizing equity wins more. **So jam only if he folds AA/KK/AQ 50%+; otherwise check.** Vs "Mr. Sticky" check and check-call. Vs a capable folder "jamming here is going to print."

## 7. River raises: merged vs polar
- **Raise-bluff vs MERGED ranges:**
  - a small bet in position, or
  - a bet after he checked back a turn he'd have bet with a flush.
  Those ranges are AK, AA and KQ, and a raise folds them.
- **Never raise-bluff vs POLAR big bets** (a big bet on an ace-high board in a 3-bet pot, with weak top pair). It folds only his air and gets called by two pair+: "lighting money on fire." Fold most of the time; call only vs an aggressive, capable player.
  - ⚖ **Two views, Joan keeps both (2026-09-28):** the 07-28 and 08-18 videos (and the older 2025-09-30 video, a min-raise with 75cc) min-click PURE AIR vs a polar river bet in single-raised pots (click to 250 over 120; 400-450 over a pot bet, only vs a suspected over-bluffer). All four agree: never raise a bluff catcher vs polar, and jam the nuts. The side-by-side table is in `playbook-postflop-bluffs-and-rivers.md` section 7.
- **Linear range, deep, you hold AA [07-28, 2/5, 2K deep]:** you 3-bet the BTN, he check-raises the flop, barrels the turn, then bets SMALL when the flush completes. His range is sets (and TT that turned top set), few flushes (you hold the Ah; flushes size up), no bluffs. Jam AA as a bluff to fold his sets. "Be logically consistent": if you'd raise AKhh only to 800-900 so 44 calls, you're admitting 44 folds to a jam.
  - **The earlier version of this hand [2025-09-30, 400bb 3-bet pot, CO caller]:** we 3-bet the BTN with an overpair plus a backdoor nut flush draw, he check-raises the small c-bet, we call, he bets a moderate turn, we call, and the heart flush comes. He bets 300 into 947. His range is sets (88/44/22), TT (check-raised for protection, rivered a set), A5, 56, few flushes (players play draws passively in 3-bet pots; aggressive draw players "size up" when they get there), and it's "very very hard for them to be bluffing." A reasonable player may fold 88/44/22/TT to a jam; some never fold a set. The bonus question: if you'd only raise AKhh to 800-1,000 so his sets call, jam the overpair as a bluff to fold "almost everything." If he never folds a set, jam AKhh and fold the overpair. *(Marc calls the hand "the second best hand in poker," and later "aces" [unclear].)*
  - *Older version of the same hand, superseded by the 2025-09-30 video above:* [2024-12-24 HHP] 400bb 3-bet pot, AhKh (or aces), flop 8-4-2 check-raised, flush river, villain bets 300 (about 30% pot). Same range read (mostly sets, a few TT/A5/56s, a sliver of flushes) and the same line (jam the AhKh as a bluff; aces fold vs a sticky set-caller). It adds his hypothesis that sets fold about 65% and straights 20-30% to the jam, and that flush draws get check-raised only 10-15% in live 3-bet pots.
- **With the effective nuts vs a polar lead:** raise "egregiously large," up to all-in. His air never calls and his value never folds.
- **500bb (2,500 effective) river overbet with the nuts [2025-07-01 HHP, the toy game; [OUTSIDE SOURCE] solver run, with the idea credited to a guest on the channel, Gethen Jacobs].** We open, c-bet, overbet the turn, and the river gives us the nuts or second nuts. Marc's toy-game assumptions (not observed): most opponents fold top pair to a very big bet about 80%. In it the calls and folds barely change between 2.5x and 6x pot, so the biggest size wins the most with the nuts (coolers two pair and straights): jam 63s at 5.5-6x pot (he says he wins more at about 2,300 than at either other size). 22 (thick value) does better at about 500 (about $653 EV in the sim, targets AJ/KJ). 87-high as a bluff prefers about 1,000 (2.5x pot), or 100-150. It "may not come up that often." Don't confuse it with the 500bb fold-a-set-to-a-jam spot in section 5: this is the nuts, that one isn't.
- **The block-bet trick:** with thin value out of position after the turn checks through, lead about 1/4 pot. JJ-99 pay a bet they'd have checked back. If AA or AK min-raises greedily, 3-bet jam as a bluff. Marc's stated record: "40 50 plus times," called once. It doesn't work vs super passive players, who just call.

## 8. Villain cheat sheet at 400bb (the general pool, as Marc describes it)
**The big rule:** players fast-play their VULNERABLE strong hands and trap the "invulnerable super nuts."

**Monotone flop, small c-bet**
- *Range:* small flushes and sets check-raise, because they fear a fourth card of the suit. Only the nut flush just calls. What's left after a call is capped but "quite a lot of inelastic hands" (turned pairs, two pair, top pair plus a flush draw).
- *vs a big bet:* those call the turn, then fold "almost everything" to a river jam.
- *Size (holding the nut-suit ace):* bet 3x pot on the turn, then jam.
- *Without the ace:* he can still trap Ax of the suit, so go small on the turn.

**Ace-high static dry board, BTN vs BB**
- *Range:* trapping hands are A7s and 77. One-pair Ax (AJ-A8) and Qx of the suit won't play for 400bb with one pair.
- *vs a big bet:* one-pair Ax calls the flop and turn overbets, then folds to a 2x pot river.

**He check-raises your flop c-bet**
- *Range:* "just value": sets and two pair. The pool rarely check-raises semibluffs. Aggressive players who do keep betting when they hit; passive players never check-raised the draw.
- *vs a big bet:* sets (88, 33) call a nearly-2x-pot turn. At 400bb they fold sets and two pair to a river jam, which they won't do at 100-300bb.
- *Paired turn:* his sets and two pair just made full houses, and he checks to trap.

**You overbet top two on an A-K board**
- *Range:* all his Ax calls, because he "always puts us on AK." A8/A2 two pair check-calls rather than raising.
- *His turn check-raise:* a set ("pocket eights all the time"). The bluffs are hard to find.

**Single-raised pot, you're out of position**
- *Behavior:* he over-stabs, telegraphs strength with his size, and doesn't protect his check-back range.
- *Big river jams are under-bluffed.* Small two pairs get "squeamish" on A-K boards and won't overbet-jam.
- *He won't turn K9-type hands into bluffs.*

**3-bet pot, after you check twice**
- *Range:* he puts you on AK. His air (QJ-type) starts betting, and 8x/77/66 bet "quite a lot for protection."
- *vs a big river bet:* at 200bb, those call or hero-call. At 400bb, he may fold 8x/77.

**The flop checks through and an ace turns**
- *Range:* air stabs, and the Ax that checked the flop starts betting. The only hands that won't fold are A9s/A2s-type two pair.
- *vs your big check-raise, then about 1.5-1.7x pot on the river:* single-pair Ax (AK/AQ/AT) folds.

**River bet sizes tell you his range**
- *Small bet in position:* merged thin value (AK, AA, KQ). Give-ups just check back, so few bluffs.
- *Small bet out of position:* often a cheap bluff.
- *Flushes size bigger, and sets size up when a backdoor flush arrives.*
- *Big bets (over 2/3 pot):* polarized and under-bluffed.

**Your tiny river block bet**
- *JJ-99:* call; they'd have checked back.
- *AA/AK:* often "click it" (min-raise) out of greed, then fold to your 3-bet jam.
- *A "super passive patty":* just calls.

**Rec who opens 9x UTG (45 at 2/5) and c-bets into two players, 400bb** [2025-12-16]
- *Range:* AA, KK, AQ, sometimes QQ; JJ, TT, an occasional suited broadway. "A pretty damn good hand."
- *vs your flop check-raise:* the solver says AA/KK/AQs fold about 68% combined (KK about 70%, AA only 10-20%); on the turn jam, about 50% after a flop nodelock. Marc thinks he doesn't fold top pair or overpairs. ⚖ section 6.

**CO caller of your 3-bet who check-raises your small c-bet, 400bb** [2025-09-30]
- *Range:* sets, TT, A5, 56; few flushes (draws play passively). "Very very hard for them to be bluffing" once the flush comes and he bets small (300 into 947). Some players never fold a set, and some fold sets to a jam. Section 7.

**Preflop, deep**
- *Typical 3-bettors:* call 4-bets too wide (A9s, A5s, 88) and don't find 5-bet bluffs, so 4-bet linear out of position.
- *A fish:* won't notice that you only 5-bet AA.

## 9. What changes with depth: 200bb vs 100bb [2025-02-18 HHP]
*Preflop pieces (LJ open charts, BTN vs SB 3-bet continue range, 4-bet IP polar / OOP linear) live in `playbook-preflop.md`. This is the postflop side. It fits the 400bb lessons above: the deeper you go, the more top pair folds.*
- **The one big adjustment:** at 100bb do NOT try to make villain fold top pair (AJ/KJ/QJ won't fold even to a river jam with about 375 behind, so nobody folds it for $375). Only empty the clip when he can't have top pair, for example he checked back a wet board. At 200bb top pair folds on the river.
- **Flop IP (J92, BB calls):**
  - 200bb: c-bet about half pot (they raise strong and call weak). Call a check-raise even with a naked gutshot: lots of room, an 8 turn coolers two pair and sets, a spade turn slows him.
  - 100bb: open smaller, c-bet about 1/3 pot, and fold the gutshot to a check-raise (only about 400 behind).
- **Flop OOP vs a rec who over-stabs and telegraphs with size:**
  - 200bb: check the whole range. KK check-raises his stab (a two-street game, no egregious sizes). Draws and air just check: a check-back is free bluffs on later streets. Small stab: check-raise QTs. Big stab: just call.
  - 100bb: bet strong hands (bet-bet-bet gets it in, no overbet needed, 9x/TT call). Still check draws, semi-bluffs and air so he caps himself.
- **Turn IP after a small c-bet was called (78s, wet board):**
  - 200bb: bet very large and empty the clip on blank rivers. He is inelastic on the turn (draws and top pair never fold) and elastic on the river (top pair won't play for 200bb, draws snap-fold).
  - 100bb: two options. Bet small to keep his weak range in (88-66, 2x, floats), then a small river bluff of about $40-60 to fold busted draws. Or bet big (draws and top pair still call) and size down on brick rivers. Either way, don't try to fold top pair.
- **Static ace-high dry board, IP with bottom pair:** no range bet, overbet-or-check. 200bb: triple-barrel overbet bluff to fold AQ/AJ/AT by the river (a 4 blocks strong combos). 100bb: essentially no overbet bluffing. Check back, take showdown value or bluff with jack-high after a check, and don't turn bottom pair into a bluff if he bets.
- **OOP after he checks back the flop on a wet board (no top pair, mostly air and 9x/88/77):**
  - 200bb: check flop, check again on the turn (lets him bluff), then a big check-raise and river jam. He folds almost everything.
  - 100bb: overbet the turn and overbet the river, no check-raise (not enough depth to maneuver). Rule holds: empty the clip only when he has no top pair.
- **OOP on a static dry board (A74, JTo, he checks back the flop; he may check back weak top pair A5/A6/AT and still bets 77, 44, A4, A7):**
  - 200bb: check the flop and turn, check-raise the turn and jam the river to fold his weak top pair.
  - 100bb: check the turn again and fold to a bet. If he checks the turn back, overbet the river to fold showdown value (don't blast turn and river).
- **Rivers when he's capped:** 200bb = bigger bluffs (jam, he folds top pair) and smaller value (with 99, about $400-500, not 2x pot). 100bb = small bluffs and larger value. When he's uncapped (the river brings flushes or pairs), go small at 100bb on both sides: they raise strong and call weak.
- *Side by side, no conflict found:* the 200bb OOP "check the range" line is a single-raised-pot flop lesson, and section 6's "bet the turn and river with an overpair at 200bb" is a 3-bet pot after two checks. Different spots.
