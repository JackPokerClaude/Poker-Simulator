# Compiled layer

`behavior.json` holds the numbers the villains play by that the brain only says in words
(how wide a passive player opens, how often a whale stabs, which live clues each type shows,
the LJ open chart from `playbook-preflop.md` section 3). Every value either quotes the brain
file it came from ([HHP]) or says why it has no source ([OUTSIDE SOURCE]).

- The app checks every quote against the current `brain/` files each time it opens. If a
  playbook update removed the quoted text, that value is **stale**: the app uses its
  [OUTSIDE SOURCE] fallback and Menu → Settings → Brain lists it.
- To fix stale values, or to pick up new playbook content, open a session and say
  **"recompile brain"**. That session edits `tools/build-compiled.mjs` (the readable source
  of this file), then runs `node tools/build-compiled.mjs && node tools/check-compiled.mjs`.
- Conflicts (⚖ CONFLICT: Joan to decide) and open questions (♣) are never compiled.

Don't edit `behavior.json` by hand; it is generated.
