# The HHP voice (feedback screen and Copy for coach)

The feedback reads like an HHP coach going through your hand with you. The voice is **delivery only**: every claim, number, size, percentage, date, grade and source tag comes from the feedback engine or the brain, exactly as the plain view has it. The code is `js/feedback/voice.js` (phrase pools, deterministic per hand) and `js/feedback/voice-render.js` (screen + coach text). Menu → Settings → Feedback (or the switch at the top of the feedback screen) flips between **Coach voice** (default) and **Plain**.

Built from two sources:
1. **The brain playbooks**, which are already distilled HHP notes. They set the vocabulary and the questions: "What's his range?", "What happens if I check / bet / raise?", "Is he capped or uncapped?", "Do I want to play for it all?", "Where are the bluffs coming from?". Ranges come in buckets (the seven classes), players are types with habits (over-stabs, telegraphs, under-bluffs, calls too much), and mistakes are named plainly with the reason next to them.
2. **A style-only pass over HHP transcripts**, done by a subagent that returned a ~500-word paraphrased description and no transcript text (nothing stored in the repo). Summary below.

## How he sounds (style pass, paraphrased)

- Conversational, not a lecture. Short punchy lines mixed with longer ones that stack clauses; tag questions ("right?") pull you along; a conclusion, then a one-word follow-up ("Cool.").
- Opens a hand by setting the scene in one breath: stakes, who's who, who did what.
- Praise is quick, then specific: he names what was right (the thinking, the read, sticking to a plan), and cares about the reasoning more than the result.
- Mistakes: direct but friendly. A short verdict first, then the questions that lead to the fix.
- Close spots: relaxed about saying they're close, then names what tips it.
- Talks about the **player** at least as much as the cards: the type, the habits, what this guy does.
- "We" for the hero's actions, "you" when talking to the student, "I" for opinions.
- Humor shows up often in short bits, then straight back to the point.

## Tone rules

1. **Same content, new words.** The voice may reorder words inside a step and add glue ("Okay, his range."), never add or drop a claim. Every number, $ size, %, date, ✅/⚠️/❌/⚖/♣ and [HHP] / [OUTSIDE SOURCE] / [YOUR LOG] tag is copied character for character. A test fails the build if one goes missing.
2. **No invented advice.** Glue phrases carry no strategy: no "punish him", "empty the clip", "go big", "slow down" unless the engine's own line says it. Humor never touches the advice.
3. **No fake quotes.** Quote marks only ever hold brain text, with its [HHP] tag next to it. The coach voice is never written as a quote, and no coach is named anywhere in the app: everything is [HHP].
4. **Math verdicts aren't "I'd".** When the verdict is `[OUTSIDE SOURCE] math`, the voice says the math picks it ("No HHP line covers this exact spot, so the math decides"). "Here's the play" with "the brain says" is for [HHP] verdicts.
5. **Conflicts stay neutral.** ⚖ and ♣ items: "The videos split on this, here are both." Both views and their dates, no lean, no synthesis, no "but", no "the better one".
6. **[YOUR LOG] stays yours.** The known-leak card talks about *your* pattern, from *your* log, and is never tagged or voiced as HHP.
7. **Five steps, same order**, at every decision: his range → what happens if → your action → the verdict → something else worth remembering.
8. **Phone first.** The quick take (every grade + verdict) sits at the top; grids, math and "where the numbers come from" are tap-to-open.
9. **Varied, not random.** Phrase pools with several openers; the pick is seeded by the hand (same hand, same words), so tests are stable and 40 hands don't all start the same way.

## Vocabulary (terms the brain already uses)

- **The seven classes:** air, low-equity draws, high-equity draws, showdown value, thin value, thick value, can play for stacks (CPFS).
- **Range words:** capped / uncapped, elastic / inelastic, polar, merged, range-bet, his range narrows, "what's left".
- **Player words:** rec, reg, pro, whale, nit, passive / aggro, caller / folder, over-stabs, telegraphs, under-bluffs, over-bluffs, overfolds, calls too much.
- **Actions:** c-bet, stab, donk, check-raise, iso, squeeze, 3-bet, 4-bet, float, hero call, thin value, bet small / bet big, "small or big, never in between".
- **Grades:** ✅ the line, ⚠️ close / right idea wrong size, ❌ costs you, ⚖ not graded.

## Do

- Ask the questions he asks, then answer them with the engine's numbers: "So what's he got?", "What happens if you bet?", "Do you even want the calls?".
- Talk about the player: "a loose-passive rec", "a passive caller", "he limped, so...".
- Praise the specific thing: the line, the size, the read.
- Call out a ❌ plainly, with the cost in $ the engine gives.
- Say "this was close" on a math-only ⚠️, and that out of position the math only counts about 80% of your equity [OUTSIDE SOURCE] when the engine applied it.

## Don't

- Don't add a size, a frequency or a line the engine didn't produce.
- Don't round, reformat or "tidy" a number ($24 stays $24, 69% pot stays 69% pot).
- Don't name coaches, put words in quote marks, or say a video says something the brain doesn't.
- Don't lean on a ⚖ conflict, a ♣ open question, a "brain vs his strategy" check or a "brain lines disagree" split.
- Don't call [YOUR LOG] HHP, or [OUTSIDE SOURCE] math HHP.
- Don't be cruel. Blunt is fine; mean isn't.

## Tone examples (generated by the app from the fixture hands in tests/fixtures/hands.json)

These are real step-3 lines the voice layer produced (`node tools/voice-sample.mjs <n>`). After the mark and the reaction, the sentence is the engine's own grade text, word for word; the last sentence comes from the verdict's source or the engine's data.

### ✅

1. *(varied #9, turn, A♦A♣, you bet $194)* "✅ Clean. You bet small ($194). Bet small is the line. Line and size both match the brain's sizing rule."
2. *(varied #7, turn, K♦K♥ on K♣K♠8♠Q♠, you raise to $39)* "✅ Clean. You raised ($39). Raise is the line. The math agrees with you."
3. *(a fold that matches a brain rule)* "✅ Nice. You folded. Fold is the line. Exactly the line the brain gives here."

### ⚠️

1. *(varied #9, flop, you bet $59 into $99)* "⚠️ Close, but the size is off. You bet an in-between size ($59). Right idea (bet), wrong size: bet small here. In-between sizes are the worst of both."
2. *(a math-only close call out of position)* "⚠️ This one's close, so don't lose sleep over it. You called. Math only, close: raise is about $0.8 better, under 5% of the pot. And out of position, every EV here already counts only about 80% of your equity [OUTSIDE SOURCE]."
3. *(varied #2, turn, close to the brain's line)* "⚠️ I don't hate it, but it's not the line. You bet an in-between size ($27). Bet an in-between size is close (about $2.8 worse), but check is the line."

### ❌

1. *(varied #7, flop, you just call with quads)* "❌ We have to talk about this one. You called. Call costs about $24 vs raise. The verdict right below says why."
2. *(varied #7, river, you fold the best hand)* "❌ Okay, this one hurts. You folded. Fold costs about $397 vs raise. Look at the verdict below and you'll see it."
3. *(preflop, off chart)* "❌ Not this one. Chart iso-raises AQo 100% here."
