#!/usr/bin/env node
// Source of brain-compiled/behavior.json, the compiled layer (see js/brain/compiled.js).
// A "recompile brain" session edits this file, then runs:
//   node tools/build-compiled.mjs && node tools/check-compiled.mjs
// The check fails if any quote below is no longer in the brain file it cites.
//
// Rules: a number with a quote is [HHP] (interp says how words became the number when the
// number itself isn't in the quote). A number without a quote is [OUTSIDE SOURCE] and says why.
// Never compile a value from a ⚖ CONFLICT or ♣ open question: those stay Joan's call.
import { writeFileSync, mkdirSync } from 'node:fs';

const values = {};
const src = (file, section, date) => (quote) => ({ file, section, date, quote });
const hhp = (key, v, s, { fb, interp } = {}) => { values[key] = { v, src: s, ...(fb !== undefined ? { fb } : {}), ...(interp ? { interp } : {}) }; };
const out = (key, v, why) => { values[key] = { v, outside: why }; };

const PRE12 = src('playbook-preflop.md', '12. Player types', '');
const PRE13 = src('playbook-preflop.md', '13. Red flags', '');
const PRE14 = src('playbook-preflop.md', '14. Villain reads', '');
const PRE3 = src('playbook-preflop.md', '3. Opening (RFI), 200bb', '');
const PRE6 = src('playbook-preflop.md', '6. BB defense', '2024-12-31');
const V0217 = src('playbook-villains.md', 'The four player types', '2026-02-17');
const V1028 = src('playbook-villains-oldest-videos.md', 'The 9 live player types', '2025-10-28');
const BR9 = src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '');
const PI = src('project-instructions.md', 'HHP player types', '');

// ---------------------------------------------------------------- preflop, per type
const TYPES = ['passive', 'tight', 'aggressive', 'thinking', 'whale', 'rec'];
const LABELS = { passive: 'Passive', tight: 'Tight', aggressive: 'Aggressive', thinking: 'Thinking player', whale: 'Whale', rec: 'Loose-passive rec' };
for (const t of TYPES) out(`types.${t}.label`, LABELS[t], 'display name');

// Passive: opens 7-8%, 3-bets JJ+/AK.
hhp('types.passive.pre.openPct', 7.5, PRE12('Opens about 7-8%, 3-bets about JJ+ and AK'), { fb: 7.5, interp: 'midpoint of 7-8%' });
hhp('types.passive.pre.threeBet', ['JJ+', 'AK'], PRE12('Opens about 7-8%, 3-bets about JJ+ and AK'), { fb: ['JJ+', 'AK'] });
hhp('types.passive.pre.callVs4bet', ['QQ', 'AK'], PRE14("He won't fold QQ to a 4-bet"), { fb: ['QQ', 'AK'], interp: 'QQ from the quote; AK added as the rest of his 3-bet range that isn\'t a 4-bet' });
out('types.passive.pre.fourBet', ['KK+'], 'no HHP number for a passive player\'s 4-bet');
out('types.passive.pre.fiveBet', ['AA'], 'no HHP number');
out('types.passive.pre.limpPct', 10, 'no HHP number for how much a passive player limps');
out('types.passive.pre.callOpenPct', 20, 'no HHP number');
out('types.passive.pre.continueVs3betPct', 5, 'no HHP number: calls a 3-bet with his top 5% of all hands, about two-thirds of his opens');
out('types.passive.pre.limpCallPct', 70, 'no HHP number');

// Tight (2026 wording): opens about 15%.
hhp('types.tight.pre.openPct', 15, PRE12('Opens about 15%'), { fb: 15 });
out('types.tight.pre.threeBet', ['TT+', 'AQs+', 'AK'], 'HHP gives the tight type\'s open size, not his 3-bet range');
out('types.tight.pre.fourBet', ['KK+'], 'no HHP number');
out('types.tight.pre.callVs4bet', ['QQ', 'AK'], 'no HHP number');
out('types.tight.pre.fiveBet', ['AA'], 'no HHP number');
out('types.tight.pre.limpPct', 4, 'no HHP number');
out('types.tight.pre.callOpenPct', 14, 'no HHP number');
out('types.tight.pre.continueVs3betPct', 8, 'no HHP number');
out('types.tight.pre.limpCallPct', 60, 'no HHP number');

// Aggressive: opens about 30%, 3-bets a lot, light 3-bets that won't fold to a 4-bet.
hhp('types.aggressive.pre.openPct', 30, PRE12('Opens about 30%, 3-bets a lot'), { fb: 30 });
hhp('types.aggressive.pre.threeBetPct', 9, PRE12('Opens about 30%, 3-bets a lot'), { fb: 9, interp: '"3-bets a lot" has no number: top 9% plus the light list below (default, Joan to review)' });
hhp('types.aggressive.pre.threeBetLight', ['KQs', 'A5s', 'ATs', 'KJs', 'QJs', '88'], V0217('wide light 3-bets (KQs, A5s, ATs, KJs, QJs, 88) that won\'t fold to a 4-bet'), { fb: [] });
hhp('types.aggressive.pre.callVs4bet', ['KQs', 'A5s', 'ATs', 'KJs', 'QJs', '88', 'JJ', 'TT', 'AQs', 'AK'], V0217('wide light 3-bets (KQs, A5s, ATs, KJs, QJs, 88) that won\'t fold to a 4-bet'), { fb: ['QQ', 'JJ', 'AK'], interp: 'the light 3-bets from the quote, plus his strong non-4-bet hands (JJ, TT, AQs, AK)' });
out('types.aggressive.pre.fourBetPct', 4, 'no HHP number');
out('types.aggressive.pre.fourBetBluffs', ['A5s', 'A4s'], 'no HHP number');
out('types.aggressive.pre.fiveBet', ['KK+', 'AKs'], 'no HHP number');
out('types.aggressive.pre.limpPct', 2, 'no HHP number');
out('types.aggressive.pre.callOpenPct', 16, 'no HHP number');
out('types.aggressive.pre.continueVs3betPct', 13, 'no HHP number');
out('types.aggressive.pre.limpCallPct', 60, 'no HHP number');
out('types.aggressive.pre.bluff3betPct', 5, 'no HHP number');

// Thinking player: aggressive, but can 3-bet-fold.
hhp('types.thinking.pre.openPct', 30, PRE12('Aggressive but can 3-bet-fold'), { fb: 25, interp: '"aggressive" = the 30% opener from the same table' });
hhp('types.thinking.pre.foldToPressure', 1.35, PRE14('can three bet fold occasionally'), { fb: 1.2, interp: 'folds to a 4-bet about 35% more often than the aggressive type (the number is a default, Joan to review)' });
out('types.thinking.pre.threeBetPct', 10, 'no HHP number ("3-bets a lot")');
out('types.thinking.pre.fourBetPct', 3, 'no HHP number');
out('types.thinking.pre.fourBetBluffs', ['A5s'], 'no HHP number');
out('types.thinking.pre.callVs4betPct', 3, 'no HHP number');
out('types.thinking.pre.fiveBet', ['KK+'], 'no HHP number');
out('types.thinking.pre.limpPct', 0, 'no HHP number');
out('types.thinking.pre.callOpenPct', 12, 'no HHP number');
out('types.thinking.pre.continueVs3betPct', 11, 'no HHP number');
out('types.thinking.pre.limpCallPct', 50, 'no HHP number');
out('types.thinking.pre.bluff3betPct', 4, 'no HHP number');

// Whale: VPIP 70-80%+, isos about 80% of the time, massively underfolds.
hhp('types.whale.pre.vpipPct', 75, V1028('VPIP 70-80%+, isos about 80% of the time'), { fb: 55, interp: 'midpoint of 70-80%' });
hhp('types.whale.pre.isoRaiseFreq', 0.8, V1028('VPIP 70-80%+, isos about 80% of the time'), { fb: 0.5 });
out('types.whale.pre.openPct', 20, 'HHP gives his VPIP, not his raise-first-in share');
hhp('types.whale.pre.callVs4betPct', 14, src('playbook-preflop.md', '14. Villain reads', '')('"massively underfolding" to 4-bets'), { fb: 8, interp: '"massively underfolding": calls a 4-bet with his top 14% (the number is a default, Joan to review)' });
hhp('types.whale.pre.callVs5bet', ['KK', 'QQ', 'AK'], PRE14("Fish and recs don't fold KK, AK or QQ to a 5-bet"), { fb: ['KK', 'QQ', 'AK'] });
out('types.whale.pre.threeBetPct', 6, 'no HHP number');
out('types.whale.pre.fourBetPct', 3, 'no HHP number');
out('types.whale.pre.fiveBet', ['QQ+', 'AK'], 'no HHP number');
out('types.whale.pre.callOpenPct', 45, 'no HHP number (his VPIP above drives most of it)');
out('types.whale.pre.continueVs3betPct', 30, 'no HHP number');
out('types.whale.pre.limpCallPct', 95, 'no HHP number');
out('types.whale.pre.bluff3betPct', 3, 'no HHP number');

// Loose-passive rec (calling station): raises the top 5-7%, limps pairs/suited broadways/suited Ax.
hhp('types.rec.pre.openPct', 6, PRE14("When he raises, it's the top 5-7%."), { fb: 6, interp: 'midpoint of 5-7%' });
hhp('types.rec.pre.limpList', ['22+', 'A2s+', 'KTs+', 'QTs+', 'JTs'], PRE14('limps pairs, suited broadways and suited Ax, and raises only premiums'), { fb: ['22+', 'A2s+', 'KTs+', 'QTs+', 'JTs'], interp: 'pairs, suited Ax, suited broadways (T and up)' });
out('types.rec.pre.limpPct', 22, 'extra limps on top of the list above (live recs also limp offsuit broadways and connectors); no HHP number');
hhp('types.rec.pre.threeBet', ['JJ+', 'AK'], PRE14('Passive rec 3-bettor: JJ+ and AK.'), { fb: ['QQ+', 'AK'] });
hhp('types.rec.pre.coldCall3bet', ['TT', 'JJ', 'QQ', 'AK'], PRE14('cold-calls a 3-bet with JJ, AK, QQ and TT instead of cold 4-betting'), { fb: ['JJ', 'QQ', 'AK'] });
hhp('types.rec.pre.fourBet', ['KK+'], PRE14('often aces and kings, maybe some ace king'), { fb: ['KK+'] });
hhp('types.rec.pre.fourBetPartial', { AK: 0.3 }, PRE14('often aces and kings, maybe some ace king'), { fb: {}, interp: '"maybe some ace king": AK 4-bets 30% of the time (default, Joan to review)' });
hhp('types.rec.pre.fiveBet', ['AA'], PRE13('A rec 5-bets at 200bb+: it\'s AA.'), { fb: ['AA'] });
hhp('types.rec.pre.callVs5bet', ['KK', 'QQ', 'AK'], PRE14("Fish and recs don't fold KK, AK or QQ to a 5-bet"), { fb: ['KK', 'QQ', 'AK'] });
hhp('types.rec.pre.callVs4bet', ['QQ', 'AK'], PRE14("He won't fold QQ to a 4-bet"), { fb: ['QQ', 'AK'], interp: 'the passive rec 3-bettor keeps QQ (and AK) vs a 4-bet' });
hhp('types.rec.pre.bbDefendPct', 37.5, PRE6('a rec BB defends about 37-38%'), { fb: 30, interp: 'midpoint of 37-38%' });
hhp('types.rec.pre.callOpenPct', 30, PRE12('Calls everything'), { fb: 30, interp: '"Calls everything": flats an open with his top 30% (the number is a default, Joan to review)' });
out('types.rec.pre.continueVs3betPct', 5, 'no HHP number');
hhp('types.rec.pre.limpCallPct', 90, PRE12('Calls everything'), { fb: 90, interp: 'calls a raise after limping 90% of the time' });
out('types.rec.pre.isoFactor', 0.7, 'no HHP number');

// Shared preflop rules (every type).
hhp('pool.limpReraise', ['AA', 'KK', 'AKs'], PRE13('A limp-reraise: AA, KK, AKs, maybe QQ, with no bluffs'), { fb: ['QQ+', 'AK'] });
hhp('pool.limpReraisePartial', { QQ: 0.5 }, PRE13('A limp-reraise: AA, KK, AKs, maybe QQ, with no bluffs'), { fb: {}, interp: '"maybe QQ": QQ limp-reraises half the time' });
hhp('pool.bigOpenPremiums', ['JJ+', 'AK'], PRE14('JJ or AK ("I don\'t want to see a flop") or AA/KK (greed)'), { fb: ['QQ+', 'AK'] });
hhp('pool.bigOpenMult', 1.4, PRE13('An unusually large open (30-35 when normal is 20-25): a stronger range.'), { fb: 1.4, interp: '30-35 vs 20-25 is about 1.4x the normal open' });
out('pool.bigOpenPremiumFreq', 0.5, 'how often a rec/passive/whale opens his premiums big; HHP says big opens are strong, not how often (default, Joan to review)');
out('pool.bigOpenOtherFreq', 0.04, 'how often a non-premium gets the big open (default, Joan to review)');
out('pool.bigOpenTypes', ['rec', 'passive', 'whale', 'tight'], 'which types give the big-open tell (HHP describes recs); default, Joan to review');
hhp('pool.normalOpen25', [20, 25], PRE3('he calls a normal rec open 20-25'), { fb: [20, 25] });
hhp('pool.blindsNo3betSuitedConnectors', true, PRE14("From the SB/BB they still don't 3-bet suited connectors"), { fb: false });

// Which postflop style each preflop type plays ([02-17]: passive/aggressive x caller/folder).
out('types.passive.styleMix', { passiveCaller: 55, passiveFolder: 45 }, 'HHP gives both passive styles, not how common each is');
hhp('types.tight.styleMix', { passiveCaller: 70, passiveFolder: 30 }, V0217('Tight preflop players tend to be callers.'), { fb: { passiveCaller: 50, passiveFolder: 50 }, interp: '"tend to be callers": 70/30 (default, Joan to review)' });
hhp('types.aggressive.styleMix', { aggroCaller: 70, aggroFolder: 30 }, V0217('Loose players fold more rivers as a share of their range (though plenty are still stations).'), { fb: { aggroCaller: 70, aggroFolder: 30 }, interp: 'some loose players fold rivers (the folder share), plenty are stations (the caller share)' });
hhp('types.thinking.styleMix', { aggroFolder: 70, aggroCaller: 30 }, V0217('Rare and the toughest.'), { fb: { aggroFolder: 50, aggroCaller: 50 }, interp: 'the rare, tough aggro folder mostly plays like the thinking player' });
out('types.whale.styleMix', { whale: 100 }, 'the whale has his own style below');
hhp('types.rec.styleMix', { passiveCaller: 80, passiveFolder: 20 }, PRE12('Calls everything'), { fb: { passiveCaller: 70, passiveFolder: 30 } });

// ---------------------------------------------------------------- postflop styles
// bet: chance to bet when checked to, by hand class. big: share of those bets that go big.
// raise: chance to raise facing a bet. need: hand strength (0-1) he needs to continue, by
// street; sizeSens: how much more he needs per pot-sized bet. streetAir: bluff multiplier.
const STYLES = {
  passiveCaller: 'Passive caller', passiveFolder: 'Passive folder', aggroCaller: 'Aggro caller', aggroFolder: 'Aggro folder', whale: 'Whale',
};
for (const [k, l] of Object.entries(STYLES)) out(`styles.${k}.label`, l, 'display name');

const setStyle = (k, o) => { for (const [path, rec] of Object.entries(o)) values[`styles.${k}.${path}`] = rec; };
const O = (v, why = 'number is a default; HHP gives only the direction, if anything (Joan to review)') => ({ v, outside: why });
const H = (v, s, interp, fb) => ({ v, src: s, fb: fb ?? v, ...(interp ? { interp } : {}) });

// Aggro folder: "no exploits given", so it's the balanced default the others are compared to.
setStyle('aggroFolder', {
  'bet.monster': O(0.7), 'bet.strong': O(0.7), 'bet.medium': O(0.35), 'bet.draw': O(0.5), 'bet.air': O(0.3),
  cbet: O(0.15), 'streetAir.flop': O(1), 'streetAir.turn': O(0.8), 'streetAir.river': O(0.6),
  'big.monster': O(0.6), 'big.strong': O(0.5), 'big.medium': O(0.3), 'big.draw': O(0.45), 'big.air': O(0.5),
  'raise.monster': O(0.6), 'raise.strong': O(0.15), 'raise.draw': O(0.15), 'raise.air': O(0.05),
  'need.flop': O(0.4), 'need.turn': O(0.48), 'need.river': O(0.55),
  'sizeSens.flop': O(0.1), 'sizeSens.turn': O(0.12), 'sizeSens.river': O(0.15),
  riverSpaz: O(0), callAnyPair: O(false), 'sizes.small': O(0.33), 'sizes.big': O(0.75),
});

setStyle('passiveCaller', {
  'bet.monster': O(0.55), 'bet.strong': O(0.45),
  'bet.medium': H(0.1, V0217("Won't value-bet thin or bluff enough."), 'rarely bets medium hands for thin value'),
  'bet.draw': H(0.12, src('playbook-preflop.md', '14. Villain reads', '')('play draws passively'), 'rarely bets draws'),
  'bet.air': H(0.04, V0217("Won't value-bet thin or bluff enough."), 'almost never bluffs'),
  cbet: O(0.08),
  'streetAir.flop': O(1),
  'streetAir.turn': H(0.6, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-02-25')('Fish under-double- and under-triple-barrel bluffs and don\'t bet thin for value.'), 'fewer bluffs each street'),
  'streetAir.river': H(0.4, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-02-25')('Fish under-double- and under-triple-barrel bluffs and don\'t bet thin for value.'), 'fewer bluffs each street'),
  'big.monster': H(0.75, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-01-07')('recs telegraph with size'), 'big bets are mostly strong hands'),
  'big.strong': H(0.6, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-01-07')('recs telegraph with size'), 'big bets are mostly strong hands'),
  'big.medium': O(0.1), 'big.draw': O(0.1), 'big.air': O(0.1),
  'raise.monster': O(0.3),
  'raise.strong': H(0.02, V0217("Trips won't raise and bricked draws won't spaz."), 'strong hands just call'),
  'raise.draw': H(0.02, BR9('The pool under-check-raises semibluffs.'), 'draws almost never raise'),
  'raise.air': O(0),
  'need.flop': O(0.3),
  'need.turn': O(0.36),
  'need.river': H(0.42, V0217("Just because they're not raising doesn't mean they're ever folding."), 'continues with any decent pair'),
  'sizeSens.flop': O(0.03),
  'sizeSens.turn': H(0.03, V0217("sticky. Won't fold top pair or an overpair in a 3-bet pot."), 'big bets barely move him'),
  'sizeSens.river': H(0.04, V0217("sticky. Won't fold top pair or an overpair in a 3-bet pot."), 'big bets barely move him'),
  riverSpaz: H(0, V0217("Trips won't raise and bricked draws won't spaz."), 'busted draws never spaz'),
  callAnyPair: H(true, PRE12('Calls everything'), 'calls with any pair on the flop and turn'),
  'sizes.small': O(0.33), 'sizes.big': O(0.7),
});

setStyle('passiveFolder', {
  'bet.monster': O(0.6), 'bet.strong': O(0.5), 'bet.medium': O(0.12),
  'bet.draw': H(0.45, V0217('Double-barrels draws, then gives them up on the river.'), 'bets his draws on the flop and turn'),
  'bet.air': O(0.05), cbet: O(0.1),
  'streetAir.flop': O(1),
  'streetAir.turn': H(0.9, V0217('Double-barrels draws, then gives them up on the river.'), 'keeps betting draws on the turn'),
  'streetAir.river': H(0.05, V0217('Double-barrels draws, then gives them up on the river.'), 'gives up on the river'),
  'big.monster': H(0.7, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-01-07')('recs telegraph with size'), 'big bets are mostly strong hands'),
  'big.strong': O(0.6), 'big.medium': O(0.1), 'big.draw': O(0.3), 'big.air': O(0.2),
  'raise.monster': O(0.45), 'raise.strong': O(0.05),
  'raise.draw': H(0.02, V0217('His check-raises have few draws (J9, 22, AJ).'), 'his raises are rarely draws'),
  'raise.air': O(0),
  'need.flop': H(0.34, V0217('he folds least early in the hand'), 'continues fairly wide early'),
  'need.turn': O(0.42),
  'need.river': H(0.62, V0217('folds most on the RIVER, once aces, straights or flushes can come.'), 'folds a lot of his range on the river'),
  'sizeSens.flop': O(0.06), 'sizeSens.turn': O(0.1),
  'sizeSens.river': H(0.25, V0217('folds most on the RIVER, once aces, straights or flushes can come.'), 'big river bets fold him'),
  riverSpaz: O(0), callAnyPair: O(false), 'sizes.small': O(0.33), 'sizes.big': O(0.7),
});

setStyle('aggroCaller', {
  'bet.monster': O(0.75), 'bet.strong': O(0.75),
  'bet.medium': H(0.5, V0217('Value-bets thin and keeps bluffing if given rope.'), 'bets thin value'),
  'bet.draw': O(0.65),
  'bet.air': H(0.4, V0217('Value-bets thin and keeps bluffing if given rope.'), 'bluffs often'),
  cbet: O(0.2),
  'streetAir.flop': O(1),
  'streetAir.turn': H(0.9, V0217('Value-bets thin and keeps bluffing if given rope.'), 'keeps bluffing'),
  'streetAir.river': H(0.8, V0217('Value-bets thin and keeps bluffing if given rope.'), 'keeps bluffing'),
  'big.monster': O(0.6), 'big.strong': O(0.5), 'big.medium': O(0.4), 'big.draw': O(0.5), 'big.air': O(0.5),
  'raise.monster': O(0.65), 'raise.strong': O(0.25), 'raise.draw': O(0.25), 'raise.air': O(0.08),
  'need.flop': O(0.32),
  'need.turn': H(0.36, V0217('his turn hands are inelastic. On the river trips call and busted draws fold.'), 'rarely folds the turn'),
  'need.river': H(0.48, V0217('his turn hands are inelastic. On the river trips call and busted draws fold.'), 'made hands call the river, busted draws fold'),
  'sizeSens.flop': O(0.06),
  'sizeSens.turn': H(0.03, V0217('his turn hands are inelastic. On the river trips call and busted draws fold.'), 'turn size barely matters'),
  'sizeSens.river': O(0.1),
  riverSpaz: H(0.25, V0217('trips put in more money; busted draws may check-raise and spaz.'), 'busted draws raise a small river bet 25% of the time'),
  callAnyPair: O(false), 'sizes.small': O(0.4), 'sizes.big': O(0.8),
});

setStyle('whale', {
  'bet.monster': O(0.7), 'bet.strong': O(0.6), 'bet.medium': O(0.45), 'bet.draw': O(0.55),
  'bet.air': H(0.45, V1028('over-stabs the flop and turn, then usually gives up the river'), 'stabs a lot'),
  cbet: O(0.05),
  'streetAir.flop': H(1, V1028('over-stabs the flop and turn, then usually gives up the river'), 'stabs the flop'),
  'streetAir.turn': H(1, V1028('over-stabs the flop and turn, then usually gives up the river'), 'stabs the turn'),
  'streetAir.river': H(0.25, V1028('over-stabs the flop and turn, then usually gives up the river'), 'usually gives up the river'),
  'big.monster': O(0.6), 'big.strong': O(0.5), 'big.medium': O(0.5), 'big.draw': O(0.5), 'big.air': O(0.5),
  'raise.monster': O(0.5), 'raise.strong': O(0.25), 'raise.draw': O(0.2), 'raise.air': O(0.06),
  'need.flop': H(0.1, V1028('floats "incredibly way too wide"'), 'continues with almost anything on the flop'),
  'need.turn': H(0.16, V1028('He floats weak Tx, 99 and A-high for two streets, then folds them to a small river bet.'), 'floats weak hands on the turn'),
  'need.river': H(0.45, V1028('He floats weak Tx, 99 and A-high for two streets, then folds them to a small river bet.'), 'folds weak pairs and A-high on the river'),
  'sizeSens.flop': O(0.02), 'sizeSens.turn': O(0.02),
  'sizeSens.river': H(0.05, src('playbook-villains-oldest-videos.md', 'The 9 live player types', '2025-10-28')("won't fold strong hands"), 'big bets don\'t fold his strong hands'),
  riverSpaz: O(0.05),
  callAnyPair: H(true, V1028('Top pair can be a stack-off hand for him.'), 'calls with any pair on the flop and turn'),
  'sizes.small': O(0.4), 'sizes.big': O(0.85),
});

// ---------------------------------------------------------------- range buckets
hhp('buckets.order', ['strong', 'medium', 'draws', 'air'],
  src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2026-08-18')('can play for stacks > thick value > thin value > draws > showdown value > air'),
  { fb: ['strong', 'medium', 'draws', 'air'], interp: 'Strong = can play for stacks + thick value; Medium = thin value + showdown value; Draws; Air' });

// ---------------------------------------------------------------- reads (live clues; never the type label)
// group = the type or style whose players can show the clue.
const read = (group, n, text, s) => hhp(`reads.${group}.${n}`, text, s, { fb: null });
read('passive', 0, 'Very neat chip stacks', V0217('very neat chip stacks'));
read('passive', 1, 'Waits for the BB instead of posting', V0217('waits for the BB to post'));
read('passive', 2, 'Complains the game is too tight', V0217('complains the game is too tight'));
read('passive', 3, 'A rules nit', V0217('a rules nit'));
read('passive', 4, 'Flatted JJ preflop and showed it down', V0217('flats TT/JJ/AK preflop'));
read('passive', 5, 'Checked back a clear thin value bet at showdown', V0217('checks back clear thin value'));
read('passive', 6, 'Gave up with 7-high on the river', V0217('gives up 6-high/7-high on the river'));
read('aggressive', 0, 'Messy chip piles', V0217('messy piles'));
read('aggressive', 1, 'Plays lots of pots', V0217('plays lots of pots'));
read('aggressive', 2, 'Posted or straddled instead of waiting', V0217('posts or straddles instead of waiting'));
read('aggressive', 3, 'Says "I usually play bigger"', V0217('"I usually play bigger."'));
read('aggressive', 4, '3-bet suited connectors and showed them', V0217('3-bets suited connectors (weak clue)'));
read('aggressive', 5, 'Kept betting two pair when the draw came in', V0217('keeps betting two pair when the draw comes in'));
read('aggressive', 6, 'Turned third pair into a bluff at showdown', V0217('turns second or third pair into a bluff (the strongest clue)'));
read('passiveCaller', 0, 'Paid off the table nit with a weak hand', V0217('a "non-believer" who pays off the table nit'));
read('aggroCaller', 0, 'Paid off the table nit with a weak hand', V0217('a "non-believer" who pays off the table nit'));
read('passiveFolder', 0, 'Flashed top pair and mucked it', V0217('flashes top pair and mucks it'));
read('aggroFolder', 0, 'Flashed top pair and mucked it', V0217('flashes top pair and mucks it'));
read('passiveFolder', 1, '"I folded a flush, I knew I was behind"', V1028('"I folded a flush, I knew I was behind."'));
read('whale', 0, '"Dealer, can I bet this?" (holding up a car key)', V1028('"Dealer, can I bet this [Bentley key]?"'));
read('whale', 1, 'Half the room is on the list for his table', V1028('half the casino is on the table-change list for his table'));
read('whale', 2, 'In almost every pot', V1028('VPIP 70-80%+, isos about 80% of the time'));
read('tight', 0, 'Waits for the bad-beat jackpot', V1028('waits for the bad-beat jackpot'));
read('tight', 1, 'Says "back in my day"', V1028('"back in my day."'));
read('tight', 2, 'Very neat chip stacks', V0217('very neat chip stacks'));
read('rec', 0, 'Limps pairs and suited hands, raises only premiums', PRE14('limps pairs, suited broadways and suited Ax, and raises only premiums'));
read('rec', 1, 'Limps a lot from early position', PRE14('Habitual EP limper: limps suited broadways and small pairs.'));
read('rec', 2, 'Here to have a good time', V1028('Donker ("here to have a good time")'));
read('thinking', 0, 'Has 3-bet a lot, folded to a 4-bet once', PRE14('can three bet fold occasionally'));
read('thinking', 1, 'Plays lots of pots', V0217('plays lots of pots'));

// ---------------------------------------------------------------- compiled charts
hhp('charts.LJ OPEN - 200BB', {
  name: 'LJ OPEN - 200BB (2025-02-18 HHP)', heroPosition: 'LJ', scenario: 'open', seat: 'LJ',
  source: 'playbook-preflop.md › 3. Opening (RFI), 200bb · 2025-02-18 HHP (compiled)', date: '2025-02-18',
  opens: ['AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'AA', 'AKo', 'AQo', 'AJo',
    'KK', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'KQo', 'QQ', 'QJs', 'QTs', 'Q9s', 'Q8s', 'JJ', 'JTs', 'J9s', 'J8s',
    'TT', 'T9s', 'T8s', '99', '98s', '88', '87s', '77', '76s', '66', '65s'],
}, src('playbook-preflop.md', '3. Opening (RFI), 200bb', '2025-02-18')('200bb LJ (44 hands): all suited aces A2s-AKs; AA, AKo, AQo, AJo; KK, KQs-K7s, KQo; QQ, QJs-Q8s; JJ, JTs-J8s; TT, T9s, T8s; 99, 98s; 88, 87s; 77, 76s; 66, 65s.'),
{ fb: null });

// ---------------------------------------------------------------- "Also from the brain" rules
// Each rule shows its own quote, and only when its conditions match the spot (js/feedback/match.js).
// when keys: street, spot, facing, heroBucket, villainType, villainStyle, multiway, heroIP, heroPFR,
// board (aceHigh, paired, monotone, fourFlush, wet, dry), potType, villainAction, heroAction, deep, limperPos,
// betSize ('small' | 'inbetween' | 'big': the bet you face), heroLine (bet-small / bet-big / bet-inbetween / check / call / fold / raise),
// flopCheckedThrough, turnCheckedThrough, villainDoubleBarreled, capped, shallow (<150bb). recommend: the line the rule points to (used for the verdict).
const rule = (id, v, s) => hhp(`rules.${id}`, v, s, { fb: null });
const PRE1 = src('playbook-preflop.md', '1. Before any chart: think first', '');
const PRE4 = src('playbook-preflop.md', '4. Limpers', '');
const PRE5 = src('playbook-preflop.md', '5. Facing an open (not from the BB)', '');
const PRE8 = src('playbook-preflop.md', '8. Facing a 3-bet', '');
const PF1 = src('playbook-postflop.md', '1. Read his range first', '');
const PF2 = src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '');
const BR10 = src('playbook-postflop-bluffs-and-rivers.md', '10. Strong hands', '2026-08-11');
const DS5 = src('playbook-deep-stacks.md', '5. Fold more bluff catchers deep', '');
const DS6 = src('playbook-deep-stacks.md', '6. Build the biggest pot', '');

rule('neverLimp', { title: 'Never open-limp', when: { street: ['preflop'], spot: ['RFI'], heroAction: ['limp'] } }, PRE4("Never open-limp unless it's a special game (a bounty or a 7-2 game). Play raise or fold."));
rule('epLimper', { title: 'Vs an EP limper', when: { street: ['preflop'], spot: ['ISO'], limperPos: ['EP'] } }, PRE4('EP limpers are stronger, because people "don\'t limp to limp-fold."'));
rule('lateLimper', { title: 'Vs a late limper', when: { street: ['preflop'], spot: ['ISO'], limperPos: ['late'] } }, PRE4('Late limpers just want a cheap flop.'));
rule('isoSize', { title: 'Iso size', when: { street: ['preflop'], spot: ['ISO', 'BB_LIMP'], heroAction: ['raise'] } }, PRE4('Iso size: 6x + 1bb per limper in position, about 7x + 1bb per limper out of position.'));
rule('anyTwoLimper', { title: 'Vs a limper who calls any two', when: { street: ['preflop'], spot: ['ISO'], villainType: ['whale'] } }, PRE4('Vs a limper who calls ANY two preflop: iso LINEAR, not trash'));
rule('threeBetOrFold', { title: 'Facing an open: 3-bet or fold', when: { street: ['preflop'], spot: ['VS_OPEN'], heroPos: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'SB'] } }, PRE5('Default: 3-bet or fold. Calls are mainly for the BTN (absolute position) and the BB (closing the action).'));
rule('passive3bet', { title: 'Vs a passive 3-bet', when: { street: ['preflop'], spot: ['VS_3BET'], villainType: ['passive', 'rec', 'tight'] } }, PRE8("Vs a passive rec: fold a lot. That's the exploit: they under-3-bet, so overfold. Never 4-bet bluff them, in any position."));
rule('ask4bet', { title: 'Ask before you 4-bet a 3-bettor', when: { street: ['preflop'], spot: ['VS_3BET', 'COLD4B'] } }, PRE14('how deep, what range he 3-bets, is he 3-bet-or-fold from the SB, is his range too strong or too weak, does he barrel or play fit-or-fold, does he call or fold too much vs a 4-bet'));
rule('thinking4bet', { title: 'The thinking player', when: { street: ['preflop'], spot: ['VS_3BET', 'COLD4B'], villainType: ['thinking'] } }, PRE14("He's the only one worth 4-bet bluffing."));
rule('whale4bet', { title: 'Vs an aggressive whale', when: { street: ['preflop'], spot: ['VS_3BET', 'COLD4B', 'VS_4BET'], villainType: ['whale'] } }, PRE14('Stay linear, and size up your nutted hands.'));
rule('aaOnly', { title: 'Your rule: 5-bet AA only', when: { street: ['preflop'], spot: ['VS_4BET'] } }, src('project-instructions.md', 'Preflop chart file', '')("Joan's rule: she only 5-bets AA."));
rule('bigOpen', { title: 'Red flag: an unusually large open', when: { street: ['preflop'], villainAction: ['raise-big'] } }, PRE13('An unusually large open (30-35 when normal is 20-25): a stronger range.'));
rule('limpReraise', { title: 'Red flag: a limp-reraise', when: { street: ['preflop'], villainAction: ['limp-reraise'] } }, PRE13('A limp-reraise: AA, KK, AKs, maybe QQ, with no bluffs. Overfold massively.'));
rule('bb3betEp', { title: 'Red flag: a BB 3-bet vs an EP open', when: { street: ['preflop'], spot: ['VS_3BET'], heroPos: ['UTG', 'UTG+1', 'LJ'], villainPos: ['BB'] } }, PRE13('A BB 3-bet vs an EP open: massively under-bluffed. Overfold.'));
rule('rec5bet', { title: 'Red flag: a rec 5-bets', when: { street: ['preflop'], facingLevel: [5], villainType: ['rec', 'passive', 'tight', 'whale'] } }, PRE13("A rec 5-bets at 200bb+: it's AA."));
rule('readPlayer', { title: 'Read the player, not the seat', when: { street: ['preflop'], spot: ['VS_OPEN', 'SQZ'] } }, PRE1('How wide they open matters more than where they sit.'));

rule('inBetween', { title: 'Small or big, never in between', when: { street: ['flop', 'turn', 'river'], heroAction: ['bet', 'raise'], betSize: ['inbetween'] } }, PF2('In-between is the worst of both: better hands call and your targets fold.'));
rule('multiwayCbet', { title: 'Multiway c-bets', when: { street: ['flop'], multiway: true, facing: true, villainPFR: true } }, PF1('A big multiway c-bet is "too strong," so overfold, even top pair. A small multiway c-bet is too weak, so attack it with low-equity draws and backdoors.'));
rule('multiwayDonk', { title: 'Multiway donks', when: { street: ['flop', 'turn'], multiway: true, facing: true, villainAction: ['donk'] } }, PF1('A multiway donk is "much, much stronger" than a heads-up donk.'));
rule('tightConfig', { title: 'Tight configs have little air', when: { street: ['flop', 'turn', 'river'], potType: ['3bet', '4bet'], tightConfig: true } }, PF1('Early vs early 3-bet pots and 4-bet pots have few bluffs and few flush combos.'));
rule('smallDryCbet', { title: 'A small c-bet on a dry board', when: { street: ['flop'], facing: true, villainPFR: true, betSize: ['small'], board: { dry: true } } }, PF1('A small c-bet on a bone-dry static board is NOT weak.'));
rule('sdv', { title: 'Showdown value: just get to showdown', when: { street: ['turn', 'river'], facing: false, heroClass: ['sdv'] }, recommend: 'check' }, PF1("Showdown value's only goal is to REACH showdown"));
rule('poolCheckRaise', { title: 'Flop check-raises from the pool', when: { street: ['flop'], facing: true, villainAction: ['raise'], villainStyle: ['passiveCaller', 'passiveFolder', 'aggroFolder'] } }, BR9('Flop check-raises are mostly sets and two pair'));
rule('whaleBigValue', { title: 'Vs a whale: bet big', when: { street: ['flop', 'turn', 'river'], facing: false, villainType: ['whale'], heroBucket: ['strong'] }, recommend: 'bet-big' }, BR9('Bet big and overbet [08-25] | Whales love to call.'));
rule('fishJam', { title: 'Vs fish: go big on the river', when: { street: ['river'], facing: false, villainType: ['rec'], heroBucket: ['strong'] }, recommend: 'bet-big' }, BR9('Go big and jam rivers more [08-25] | More weak Ax than you expect'));
rule('stationTwoStreets', { title: 'Vs a passive calling station', when: { street: ['flop', 'turn'], facing: false, villainStyle: ['passiveCaller'], heroBucket: ['strong'] }, recommend: 'bet' }, BR9('Put the money in over two streets [09-15]'));
rule('underBluffer', { title: 'He under-bluffs: over-fold', when: { street: ['turn', 'river'], facing: true, villainStyle: ['passiveCaller', 'passiveFolder'], heroBucket: ['medium', 'air'] }, recommend: 'fold' }, BR9('He under-bluffs: over-fold.'));
rule('overBluffer', { title: 'He over-bluffs: over-call', when: { street: ['flop', 'turn', 'river'], facing: true, villainStyle: ['aggroCaller', 'whale'], heroBucket: ['medium'] }, recommend: 'call' }, BR9('He over-bluffs: over-call.'));
rule('overCaller', { title: 'He over-calls: under-bluff', when: { street: ['flop', 'turn', 'river'], facing: false, villainStyle: ['passiveCaller', 'whale'], heroBucket: ['air'] }, recommend: 'check' }, BR9('He over-calls: under-bluff.'));
rule('fastPlayFish', { title: 'Vs fish, fast-play', when: { street: ['flop', 'turn'], facing: false, villainType: ['rec', 'whale'], heroBucket: ['strong'] }, recommend: 'bet' }, BR9('Vs fish, fast-play strong hands; slowplaying gains nothing.'));
rule('inverse', { title: 'On the river: the inverse', when: { street: ['river'] } }, PF1('On the river add "what would I do with the inverse?"'));
rule('riverBuckets', { title: 'River range in buckets', when: { street: ['river'] } }, PF1('A bucket only counts if it is more than about 10% of his range.'));
rule('topPairElastic', { title: 'Top pair on the river is elastic', when: { street: ['river'], potType: ['srp'], villainStyle: ['passiveFolder', 'aggroCaller', 'aggroFolder'] } }, BR9("Most live players in 2025 won't stack off with top pair on the river in a normal SRP (elastic, so bluff big, value smaller)."));
rule('fishInelastic', { title: "A fish who can't fold top pair", when: { street: ['river'], villainStyle: ['whale', 'passiveCaller'] } }, BR9('Vs a fish who never folds it (inelastic), flip it: value 2.5x pot, bluff small just to fold ace-high and king-high draws.'));
rule('neverBluffing', { title: "Pot odds don't matter if he's never bluffing", when: { street: ['turn', 'river'], facing: true, villainAction: ['raise'], villainStyle: ['passiveCaller', 'passiveFolder'] }, recommend: 'fold' }, BR10("Pot odds don't matter if he's never bluffing"));
rule('deepFold', { title: 'Deep: fold more bluff catchers', when: { street: ['river'], facing: true, deep: true, heroBucket: ['medium', 'strong'] } }, DS5('When all the money goes in deep, the pool is "way way way under-bluffing," so every bluff catcher is worth more as a fold.'));
rule('deepOop', { title: 'Deep, out of position: check turns more', when: { street: ['turn'], deep: true, heroIP: false, facing: false, heroBucket: ['strong'] } }, DS6('Out of position, check turns more.'));

// Batch 1 (item 10): playbook-postflop.md, part 1 of the postflop playbook.
rule('sdvOopStab', { title: 'Showdown value OOP: check-call the stab, don\'t lead', when: { street: ['turn'], facing: true, heroIP: false, heroPFR: false, heroClass: ['sdv'], flopCheckedThrough: true } }, src('playbook-postflop.md', '1. Read his range first', '2026-05-12')('Out of position after the flop checks through, check-call a stab (44, BB vs BTN).'));
rule('thickVsOverBluffer', { title: 'Thick value vs a bluffer: check-call it', when: { street: ['flop', 'turn', 'river'], facing: true, heroIP: false, heroClass: ['thick'], villainStyle: ['aggroCaller', 'whale'] } }, src('playbook-postflop.md', '1. Read his range first', '2026-08-18')('"Thick value" depends on the villain: raise or donk it vs an under-bluffer, check-call it vs someone who bluffs enough or over-bluffs.'));
rule('thickVsUnderBluffer', { title: 'Thick value vs an under-bluffer: raise or lead it', when: { street: ['flop', 'turn', 'river'], heroIP: false, heroClass: ['thick'], villainStyle: ['passiveCaller', 'passiveFolder'] } }, src('playbook-postflop.md', '1. Read his range first', '2026-08-18')('"Thick value" depends on the villain: raise or donk it vs an under-bluffer, check-call it vs someone who bluffs enough or over-bluffs.'));
rule('passiveFolderRiverLead', { title: 'He gives up rivers: lead your value big', when: { street: ['river'], facing: false, heroIP: false, heroPFR: false, villainStyle: ['passiveFolder'], heroClass: ['cpfs'] }, recommend: 'bet-big' }, src('playbook-postflop.md', '3. Value-bet thinner and bigger', '2025-05-20')('Vs a passive player who bets half pot and gives up rivers: DONK-LEAD your value BIG'));
rule('turnCallsRiverBluff', { title: 'Turn calls depend on his river bluffing', when: { street: ['turn'], facing: true, heroBucket: ['medium'] } }, src('playbook-postflop.md', '1. Read his range first', '2025-06-24')('Turn calls depend on his river bluffing.'));
rule('blockersAlone', { title: 'Blockers alone don\'t make a call', when: { street: ['river'], facing: true, heroBucket: ['medium', 'air'] } }, src('playbook-postflop.md', '1. Read his range first', '2025-06-24')("Great blockers alone don't make a call"));
rule('bigWetStabNoBluff', { title: 'A big stab on a wet board: don\'t bluff it', when: { street: ['flop'], facing: true, villainAction: ['bet-big'], board: { wet: true }, heroBucket: ['air'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-07-15')("Don't bluff that range."));
rule('gutshotBigTurnFold', { title: 'A gutshot vs a big turn barrel: fold', when: { street: ['turn'], facing: true, betSize: ['big'], heroClass: ['lowDraw'] }, recommend: 'fold' }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-03-04')('A live player over-stabs the flop, then "under double-barrels massively": A5hh with a gutshot folds to a big turn barrel.'));
rule('sdvTightConfig', { title: 'A cold 4-bettor\'s turn bet: one pair has no showdown value', when: { street: ['turn'], facing: true, potType: ['4bet'], villainPFR: true, heroClass: ['thick', 'thin', 'sdv'] } }, src('playbook-postflop.md', '1. Read his range first', '2026-07-07')("Tight ranges (a cold 4-bettor bets the turn): QQ doesn't."));
rule('poolTurnCheckRaise', { title: 'The pool under-bluffs a turn check-raise', when: { street: ['turn'], facing: true, heroIP: true, villainAction: ['raise'], heroClass: ['thick', 'thin'] } }, src('playbook-postflop.md', '1. Read his range first', '2025-12-16')('a turn check-raise vs your small top-pair bet (the pool finds AxJ/AxQ with the nut-flush blocker, not 76s/86s/64s)'));
rule('oopPfrCheckWet', { title: 'OOP as the raiser on a wet board: check your range', when: { street: ['flop'], facing: false, heroPFR: true, heroIP: false, potType: ['srp'], multiway: false, board: { wet: true } } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-04-08')('check the whole range when the board is likely to get stabbed'));
rule('oopPfrDryValueBet', { title: 'OOP as the raiser on a dry board: bet your value', when: { street: ['flop'], facing: false, heroPFR: true, heroIP: false, potType: ['srp'], multiway: false, deep: false, board: { dry: true }, heroBucket: ['strong'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-04-01')('SPR under 15 (100bb): bet-bet-bet with CPFS and thick value'));
rule('monotoneTurnBluffCheck', { title: 'Four to a flush on the turn: check the bluff back, bet small if he checks the river', when: { street: ['turn'], facing: false, heroPFR: true, heroIP: true, villainAction: ['check'], board: { fourFlush: true }, heroClass: ['air'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-02-04')('the bluff (JT) checks the turn back, then bets small ($50-60, pot $82) if he checks the river too'));
rule('foldEquityCappedDeep', { title: 'Fold equity needs capped AND deep', when: { street: ['turn', 'river'], facing: false, capped: false, heroBucket: ['air'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2024-10-01')('Fold equity is high only when he is capped AND you are deep.'));
rule('aggroCallerTurnNuts', { title: 'Vs an aggro caller: big turn with the nuts', when: { street: ['turn'], facing: false, villainStyle: ['aggroCaller'], heroClass: ['cpfs'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2026-02-17')('nuts on the turn = 2-2.5x pot (his hands are inelastic)'));
rule('threeBetIpCbet', { title: '3-bet pot in position: c-bet small', when: { street: ['flop'], facing: false, potType: ['3bet'], heroPFR: true, heroIP: true } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-10-21')("c-bet your WHOLE range small, about 1/3 to 40% pot (in an SRP it's half to 2/3)"));
rule('threeBetBluffFoldToRaise', { title: '3-bet pot c-bet bluff gets raised: fold', when: { street: ['flop'], facing: true, potType: ['3bet'], heroPFR: true, heroIP: true, villainAction: ['raise'], board: { wet: true }, heroBucket: ['air'] }, recommend: 'fold' }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-07-15')('With a bluff, fold to a raise cheaply.'));
rule('threeBetIpCheckMarginalTurn', { title: '3-bet pot in position: check back marginal turns', when: { street: ['turn'], facing: false, potType: ['3bet'], heroPFR: true, heroIP: true, heroBucket: ['medium'] }, recommend: 'check' }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-04-08')('check back marginal turns (his AK float can be a bluff), then call the river bet'));
rule('aceHighTurnLead3bet', { title: 'A turn lead in a 3-bet pot on an ace-high board is strong', when: { street: ['turn'], facing: true, potType: ['3bet'], heroPFR: true, villainAction: ['donk'], board: { aceHigh: true } } }, src('playbook-postflop.md', '1. Read his range first', '2024-10-08')('A turn lead in a 3-bet pot on an ace-high board, after you showed two aggressive actions (3-bet, small c-bet), is strong'));
rule('tightConfigRiverFold', { title: 'Early vs early 3-bet pot: fold one pair to a big river bet', when: { street: ['river'], facing: true, potType: ['3bet'], tightConfig: true, betSize: ['big'], board: { wet: true }, heroClass: ['thick', 'thin', 'sdv'] } }, src('playbook-postflop.md', '1. Read his range first', '2026-06-30')('Fold QQ to a river bet over 60% pot in an EP vs EP 3-bet pot once the draws got there.'));
rule('fourBetAceTinyCbet', { title: '4-bet pot, dry A-high flop: tiny c-bet', when: { street: ['flop'], facing: false, potType: ['4bet'], heroPFR: true, board: { aceHigh: true, dry: true } }, recommend: 'bet-small' }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2026-06-09')('Flop: a tiny c-bet (about 10%, "very, very small").'));
rule('fourBetAceTurnCheck', { title: '4-bet pot, dry A-high turn: check your range', when: { street: ['turn'], facing: false, potType: ['4bet'], heroPFR: true, board: { aceHigh: true, dry: true } }, recommend: 'check' }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2026-06-09')('Turn: check the whole range'));
rule('multiwayCbetThickOnly', { title: 'Multiway: c-bet only thick value and strong draws', when: { street: ['flop'], facing: false, multiway: true, heroPFR: true, heroClass: ['sdv', 'air', 'lowDraw'] }, recommend: 'check' }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-03-04')('multiway, c-bet only thick value and very strong draws'));
rule('multiwayWetCbet', { title: 'Multiway wet flop: c-bet about 1/3 pot', when: { street: ['flop'], facing: false, multiway: true, heroPFR: true, board: { wet: true } } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2025-07-01')('about 1/3 pot or a bit smaller multiway ($70 into 200 with five players; the next-to-act player raises less)'));
rule('topPairMultiwayBet', { title: 'Top pair multiway, checked to you: bet', when: { street: ['flop', 'turn', 'river'], facing: false, multiway: true, villainAction: ['check'], heroClass: ['thick', 'thin'] }, recommend: 'bet' }, src('playbook-postflop.md', '3. Value-bet thinner and bigger', '2026-09-15')('Top pair multiway, checked to you: bet (30-40, not $10).'));
rule('fishBetsMultiway', { title: 'A fish betting into the field is weaker', when: { street: ['flop', 'turn'], facing: true, multiway: true, villainType: ['rec', 'whale', 'passive'] } }, src('playbook-postflop.md', '1. Read his range first', '2026-06-30')('A fish betting into 3 players is weaker than a pro doing it. Call.'));
rule('nextToActUncapped', { title: 'Multiway callers next to act are uncapped', when: { street: ['turn', 'river'], facing: false, multiway: true } }, src('playbook-postflop.md', '1. Read his range first', '2026-08-04')("Next-to-act callers multiway are uncapped, because that's where players trap."));
rule('multiwayCappedTurnLead', { title: 'Capped multiway field: lead the turn big with top pair', when: { street: ['turn'], facing: false, multiway: true, heroIP: false, capped: true, flopCheckedThrough: true, heroClass: ['thick', 'thin'] } }, src('playbook-postflop.md', '3. Value-bet thinner and bigger', '2026-08-04')('Capped + inelastic multiway after the flop checks through: lead the turn big with top pair.'));
rule('roundRiverBluffsUp', { title: 'Round river bluffs up', when: { street: ['river'], facing: false, heroBucket: ['air'], heroAction: ['bet'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2026-04-28')('Size for the hand you want to fold, then leave margin: "10% too small is much more costly than 10% too big."'));
rule('recDoubleBarrelCheck', { title: 'A rec bets, bets, then checks the river: he\'s strong', when: { street: ['river'], facing: false, villainAction: ['check'], villainDoubleBarreled: true, villainType: ['rec', 'passive', 'whale'], heroClass: ['cpfs'] } }, src('playbook-postflop.md', '3. Value-bet thinner and bigger', '2026-08-11')("A rec who double-barreled, then checks the river: he's check-calling a strong range."));
rule('valueRaiseNonBeliever', { title: 'Two pair vs a non-believer\'s big river bet: raise', when: { street: ['river'], facing: true, betSize: ['big'], villainStyle: ['aggroCaller'], heroClass: ['cpfs'] }, recommend: 'raise' }, src('playbook-postflop.md', '3. Value-bet thinner and bigger', '2026-04-14')('Two pair vs a sticky, aggressive "non-believer" betting 80% on the river: value-raise'));

// Batch 2 (item 10): playbook-postflop-weakness-and-position.md, part 2.
rule('oopCallerCpfs', { title: 'Can play for stacks vs his c-bet: check-raise', when: { street: ['flop'], facing: true, heroPFR: false, heroIP: false, villainPFR: true, heroClass: ['cpfs'] }, recommend: 'raise' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Check-raise. Pile money in now'));
rule('oopCallerThin', { title: 'Thin value vs his c-bet: check-call', when: { street: ['flop'], facing: true, heroPFR: false, heroIP: false, villainPFR: true, heroClass: ['thin'] }, recommend: 'call' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Thin value | Check-call | Check-call'));
rule('oopCallerDrawsWeak', { title: 'Vs a weak range, check-raise all your draws', when: { street: ['flop'], facing: true, heroPFR: false, heroIP: false, villainPFR: true, capped: true, heroBucket: ['draws'] }, recommend: 'raise' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Check-raise ALL draws, even a gutshot'));
rule('oopTurnStrongCpfs', { title: 'Vs a big double barrel, check-raise only stack hands', when: { street: ['turn'], facing: true, heroPFR: false, heroIP: false, villainPFR: true, betSize: ['big'], heroClass: ['cpfs'] }, recommend: 'raise' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Vs strong (he double-barrels big): check-raise ONLY can-play-for-stacks hands.'));
rule('oopTurnStrongFold', { title: 'Vs a big double barrel, fold showdown value and air', when: { street: ['turn'], facing: true, heroPFR: false, heroIP: false, betSize: ['big'], heroClass: ['sdv', 'air'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Fold showdown value and air.'));
rule('oopTurnDrawsXR', { title: 'Draws vs a small turn bet: check to check-raise', when: { street: ['turn'], facing: true, heroPFR: false, heroIP: false, betSize: ['small', 'inbetween'], heroBucket: ['draws'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Draws check to check-raise a small or medium bet.'));
rule('oopRiverCallBluffer', { title: 'Big river bet from a bluffer: call your value', when: { street: ['river'], facing: true, heroPFR: false, heroIP: false, betSize: ['big'], villainStyle: ['aggroCaller'], heroClass: ['thick', 'thin', 'sdv'] }, recommend: 'call' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Call thick, thin and showdown value vs a bluffer'));
rule('oopRiverFoldUnderBluffer', { title: 'Big river bet from an under-bluffer: fold your value', when: { street: ['river'], facing: true, heroPFR: false, heroIP: false, betSize: ['big'], villainStyle: ['passiveCaller', 'passiveFolder'], heroClass: ['thick', 'thin', 'sdv'] }, recommend: 'fold' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('fold them vs an under-bluffer'));
rule('oopRiverDonkWeak', { title: 'Vs a weak range on the river, donk your strong hands', when: { street: ['river'], facing: false, heroPFR: false, heroIP: false, capped: true, heroBucket: ['strong'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Vs weak (his turn doubled the flop bet): donk-lead strong hands.'));
rule('cappedTurnStabXR', { title: 'He stabs the turn while capped: big boy check-raise', when: { street: ['turn'], facing: true, heroIP: false, capped: true, flopCheckedThrough: true, heroBucket: ['strong', 'draws', 'air'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-18')('Blank turn, he\'ll stab and he\'s capped: "big boy" check-raise your strong hands, thick value, all draws and air.'));
rule('oopSdvCheck', { title: 'Showdown value out of position: check', when: { street: ['flop'], facing: false, heroIP: false, heroClass: ['sdv'] }, recommend: 'check' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-08-25')('Default with showdown value: check, let them over-stab, and give credit if they keep firing'));
rule('bbThinVsCo', { title: 'Thin top pair vs a wide CO c-bet: just call', when: { street: ['flop'], facing: true, heroPos: ['BB'], villainPos: ['CO'], villainPFR: true, heroClass: ['thin'] }, recommend: 'call' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-09-15')('Exception: thin top pair vs a wide CO c-bet from the BB. Just call.'));
rule('oopFloatTurnBottomPair', { title: 'Float his turn barrel with bottom pair', when: { street: ['turn'], facing: true, heroIP: false, heroPFR: false, villainPFR: true, heroClass: ['sdv'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-06-10')('live players "massively under triple barrel," so call the turn and let him give up.'));
rule('oop3betVsRecCheck', { title: "3-bet pot OOP vs a rec: don't c-bet a wet flop", when: { street: ['flop'], facing: false, potType: ['3bet'], heroPFR: true, heroIP: false, villainType: ['rec', 'passive', 'whale'], board: { wet: true } } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-01-07')("3-bet pot OOP, don't c-bet vs a rec who slow-plays in position"));
rule('wetSmallCbetXR', { title: 'A small c-bet on a wet board is too weak', when: { street: ['flop'], facing: true, villainPFR: true, heroIP: false, betSize: ['small'], board: { wet: true }, heroBucket: ['draws', 'air'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-06-10')('a small size = a too-weak range: check-raise everything with no showdown value'));
rule('oopPfrBigStabFold', { title: 'Big stab as the OOP raiser: fold showdown value', when: { street: ['flop'], facing: true, potType: ['srp'], heroPFR: true, heroIP: false, multiway: false, betSize: ['big'], heroClass: ['sdv', 'lowDraw'] }, recommend: 'fold' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-04-01')('XF = showdown value (AJ-high, 55, 77) and low-equity draws.'));
rule('oopPfrSmallWetStabXR', { title: 'Small stab on a wet board: check-raise wide', when: { street: ['flop'], facing: true, potType: ['srp'], heroPFR: true, heroIP: false, multiway: false, betSize: ['small'], board: { wet: true }, heroClass: ['cpfs', 'thick', 'highDraw', 'lowDraw'] }, recommend: 'raise' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-04-01')('XR = CPFS (66), combo draws (87dd), thick value, high-equity draws (A3dd) AND low-equity draws (89hh).'));
rule('oopPfrTurnBigFold', { title: 'Double barrel after a big stab: fold showdown value', when: { street: ['turn'], facing: true, potType: ['srp'], heroPFR: true, heroIP: false, multiway: false, betSize: ['big'], heroClass: ['sdv', 'lowDraw'] }, recommend: 'fold' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-04-01')('XF = showdown value and low-equity draws. T9hh (thin value on the flop) drops to showdown value here: fold.'));
rule('regValueXRFlop', { title: 'Vs a reg, check-raise value on the flop', when: { street: ['flop'], facing: true, heroIP: false, villainType: ['thinking', 'aggressive'], heroBucket: ['strong'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-01-28')('With VALUE check-raise the FLOP big'));
rule('oopRiverXRSmallBet', { title: 'His small river bet after checking back the turn: check-raise all-in', when: { street: ['river'], facing: true, potType: ['3bet'], heroIP: false, turnCheckedThrough: true, betSize: ['small'], heroClass: ['thin', 'sdv'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-06-10')("River, we're OOP vs a SMALL bet after he checked back the turn (3-bet pot, K-high board, we hold a showdown hand like A10s): check-raise ALL-IN."));
rule('oop3bettorBigStabFold', { title: 'Big stab in your 3-bet pot: fold showdown value', when: { street: ['flop'], facing: true, potType: ['3bet'], heroPFR: true, heroIP: false, betSize: ['big'], heroClass: ['sdv', 'lowDraw'] }, recommend: 'fold' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-10-21')('FOLD showdown value (99) and low-equity draws (the chart).'));
rule('oop3bettorSmallWetXR', { title: 'Small stab on a wet board in your 3-bet pot: check-raise wide', when: { street: ['flop'], facing: true, potType: ['3bet'], heroPFR: true, heroIP: false, betSize: ['small'], board: { wet: true }, heroClass: ['cpfs', 'thick', 'highDraw', 'lowDraw'] }, recommend: 'raise' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-10-21')('Check-raise wide: CPFS (99), thick value (QQ), combo (KQss), high-equity draws (A5ss), even low-equity draws (KQdd).'));
rule('oop3bettorSmallDryCall', { title: 'Small stab on a dry board in your 3-bet pot: mostly check-call', when: { street: ['flop'], facing: true, potType: ['3bet'], heroPFR: true, heroIP: false, betSize: ['small'], board: { dry: true }, heroClass: ['thick', 'thin', 'sdv', 'lowDraw'] }, recommend: 'call' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-10-21')('Check-call thick value (AK), thin value, high- and low-equity draws (JTs at a good price) and showdown value.'));
rule('oop3betRiverJamAir', { title: '3-bet pot, turn checked through, no showdown value: jam', when: { street: ['river'], facing: false, potType: ['3bet'], heroIP: false, turnCheckedThrough: true, riverPairs: false, heroBucket: ['air'] }, recommend: 'bet-big' }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-04-28')('A5dd (no showdown value vs his range): jam the river as a bluff.'));
rule('lag3betRiverXR', { title: 'A LAG bets small after the turn checks through: check-raise', when: { street: ['river'], facing: true, potType: ['3bet'], heroIP: false, turnCheckedThrough: true, betSize: ['small'], villainType: ['aggressive'], heroClass: ['thick', 'thin'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-06-09')("3-bet pot, top pair, he's a LAG: the flush-completing turn checks through, and he bets small on the river. Check-raise all-in."));
rule('bluffLooseNotTight', { title: 'Bluff the loose player, not the tight one', when: { street: ['river'], facing: false, potType: ['3bet'], heroBucket: ['air'], villainType: ['tight'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-06-17')('River jam bluff vs the LOOSE player beats the TIGHT player.'));
rule('bluffAggroNotPassive', { title: 'Bluff the aggressive player, not the passive one', when: { street: ['river'], facing: false, potType: ['3bet'], heroBucket: ['air'], villainType: ['aggressive', 'passive'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-06-17')('River 2x-pot jam bluff vs the AGGRESSIVE player beats the PASSIVE one.'));
rule('turnXRJamVsAggro3bettor', { title: 'Turn check-raise jam bluff vs the aggro 3-bettor', when: { street: ['turn'], facing: true, potType: ['3bet'], heroPFR: false, heroIP: false, villainType: ['aggressive'], heroBucket: ['draws', 'air'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-06-17')("Reverse spot (you're the preflop caller in a 3-bet pot): a turn check-raise JAM bluff works vs the aggro 3-bettor"));
rule('multiwayCheckWeakDraws', { title: 'Multiway: check weak draws', when: { street: ['flop'], multiway: true, facing: false, heroClass: ['lowDraw'] }, recommend: 'check' }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-08-12')('Check the crappy gutshot and weak flush draws (65 of spades) multiway.'));
rule('multiwayPfrBluff', { title: 'Multiway bluffs: dry boards, big, several streets', when: { street: ['flop', 'turn', 'river'], multiway: true, heroPFR: true, facing: false, heroBucket: ['air'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-08-12')('PFR bluff multiway: only on boards unlikely to be stabbed, over multiple streets and BIG'));
rule('multiwayBigTurnDonk', { title: 'Multiway: a flop call, then a big turn donk', when: { street: ['turn'], multiway: true, facing: true, villainAction: ['donk'], betSize: ['big'], heroClass: ['thick', 'thin', 'sdv'] }, recommend: 'fold' }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-08-12')('A flop call followed by a big turn donk says "my hand greatly improved or was very strong." Fold KK happily.'));
rule('twoCappedTurn', { title: 'Both players capped on the turn: check-raise', when: { street: ['turn'], multiway: true, facing: true, heroIP: false, villainAction: ['bet-small'], betSize: ['small'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2026-08-04')('Two players both capped on the turn (one checked, one bet small into two): check-raise'));
rule('smallXRMultiway', { title: 'Small check-raise vs a multiway monkey c-bet', when: { street: ['flop'], facing: true, multiway: true, villainPFR: true, heroIP: false, betSize: ['small'], heroAction: ['raise'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2026-04-14')('The small raise keeps JJ/TT/99 in so you can barrel them off.'));
rule('smallRiverBetIP', { title: 'His small river bet in position: thin value', when: { street: ['river'], facing: true, heroIP: false, betSize: ['small'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2026-09-01')('A small river bet in position is usually under-bluffed thin value.'));
rule('smallRiverBetOOP', { title: 'His small river bet out of position: often a bluff', when: { street: ['river'], facing: true, heroIP: true, betSize: ['small'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2026-09-01')('A small bet out of position is often a cheap bluff.'));
rule('bigRiverBet', { title: 'River bets over 2/3 pot are under-bluffed', when: { street: ['river'], facing: true, betSize: ['big'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2026-09-01')('River bets over 2/3 pot are under-bluffed.'));
rule('riverAirBluff', { title: 'No showdown value on the river: bluff, pick the size', when: { street: ['river'], facing: false, heroBucket: ['air'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2026-07-07')('No showdown value on the river: almost always bluff. The question is size, not whether'));
rule('riverScalpel', { title: 'Vs a strong range: the scalpel', when: { street: ['river'], facing: false, heroBucket: ['air'], capped: false } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2026-07-07')('Vs a strong range, "the scalpel": a small "baby bet" folds his draws and A/K/Q-high'));
rule('rangeFoldTest', { title: 'Bluffing with showdown value: can you get a range fold?', when: { street: ['river'], facing: false, heroClass: ['sdv'], heroAction: ['bet'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2026-09-15')('The test: "Can I get a range fold?" If not, check back'));
rule('uncappedLowFoldEquity', { title: 'Uncapped: little fold equity', when: { street: ['flop', 'turn', 'river'], facing: false, heroBucket: ['air'], capped: false } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2024-10-01')("it is low when he is uncapped or you're shallow."));
rule('cappedDeepBluff', { title: 'Capped and deep: bet big, then empty the clip', when: { street: ['turn'], facing: false, capped: true, deep: true, heroClass: ['air', 'lowDraw'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2024-10-01')('bet BIG with air and low-equity draws (54dd) on the turn, then jam the river at about 2.5x pot ("empty the clip")'));
rule('recDoubleBarrelAir', { title: 'Double-barrel air vs recs', when: { street: ['turn'], facing: false, heroPFR: true, heroBucket: ['air'], villainType: ['rec'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2024-12-10')('Double-barrel turns with air vs recs even with no equity'));
rule('emptyClipWeakRange', { title: 'His range is weak at the river: empty the clip', when: { street: ['river'], facing: false, heroBucket: ['air'], capped: true } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-05-06')('if he arrives WEAK and is only "supposed to" call weak pairs, empty the clip.'));
rule('riverXRJamBluff', { title: 'Check-raise all-in as a river bluff', when: { street: ['river'], facing: true, heroIP: false, villainPFR: true, turnCheckedThrough: true, heroBucket: ['air'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-08-05')('his best hands are weak Ax/Kx that fold to big river raises (no flush, no 99).'));
rule('tripsBetSmall', { title: 'Paired board, trips: bet small', when: { street: ['turn'], facing: false, board: { paired: true }, heroClass: ['cpfs'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-08-05')('With trips, bet small: it keeps underpairs and Kx in and gets slowplaying 8x to start check-raising.'));
rule('crippledBlockers', { title: 'Vs a crippled range, blockers barely matter', when: { street: ['river'], facing: false, heroBucket: ['air'], capped: true, heroAction: ['bet'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-02-25')('"Blocking or unblocking is nearly irrelevant" vs a crippled range live.'));
rule('tightConfigGiveUp', { title: 'Tight config: a bluff needs him to fold strong hands', when: { street: ['river'], facing: false, heroBucket: ['air'], tightConfig: true } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-03-11')('give up ("bluffs only work if he folds strong-looking hands")'));
rule('ipSmallRiverCapped', { title: 'In position vs a capped villain: bet the river small', when: { street: ['river'], facing: false, heroIP: true, capped: true, heroBucket: ['medium'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-06-10')('IP vs a capped villain, bet SMALL on the river, for thin value (one pair) and as a small bluff to fold missed draws.'));
rule('riverDonkNutsPassive', { title: 'Vs passive players, donk the river with the nuts', when: { street: ['river'], facing: false, heroIP: false, heroPFR: false, heroClass: ['cpfs'], villainType: ['passive'] }, recommend: 'bet' }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '2025-06-10')('Donk the river with the nuts vs passive players who check back everything'));
rule('repeatSmallBets', { title: 'Repeat small bets mean a weak range', when: { street: ['turn', 'river'], facing: true, villainAction: ['bet-small'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2026-08-25')('Repeat small bets mean a weak range (77, 88, 9x). Raise big and take it'));
rule('recDoubleBarrelBig', { title: 'A rec double-barrels big: he has it', when: { street: ['turn'], facing: true, villainType: ['rec', 'passive', 'whale'], villainAction: ['bet-big'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2026-04-14')('A rec double-barrels BIG: he has it. With trips, check-raise the turn'));

// Batch 3 (item 10): playbook-postflop-bluffs-and-rivers.md, part 3.
rule('bbVsBtnMissedDraws', { title: 'BB vs a BTN opener: his range is full of missed draws', when: { street: ['river'], facing: true, heroPos: ['BB'], villainPos: ['BTN'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')('when his range is wide and full of missed draws (BTN open vs your BB defend)'));
rule('pfrCheckBackTurnRaise', { title: 'He checked back the flop, then raised your turn bet', when: { street: ['turn'], facing: true, villainAction: ['raise'], villainPFR: true, heroIP: false, heroBucket: ['medium', 'strong'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('PFR check-back on the flop, then a turn raise ("massively under-bluffed": aggressive air would have bet the flop, and fear pushes the traps in now). Fold JJ-type hands.'));
rule('aceTurnChicken', { title: 'Ace-x turn: he double-barrels too much', when: { street: ['turn'], facing: true, villainPFR: true, board: { aceHigh: true }, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('he double barrels too much, "play fifth street chicken" (call the turn, he gives up the river a lot).'));
rule('oopCheckRangeStab', { title: 'Checked your range out of position: call the stab', when: { street: ['flop'], facing: true, heroIP: false, heroPFR: true, multiway: false, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('check the entire range OOP to most live players and call the stab with showdown value.'));
rule('blankTurnCheckTwice', { title: 'Blank turn out of position: check twice, then check-raise', when: { street: ['turn'], facing: false, heroIP: false, heroPFR: false, potType: ['srp'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('check twice with value AND bluffs, then check-raise (5-high, for example)'));
rule('donkRiverYourself', { title: 'Leading the river yourself', when: { street: ['river'], facing: false, heroIP: false, heroPFR: false, heroBucket: ['strong'], villainType: ['rec', 'passive', 'whale'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2024-11-12')("When you donk the river yourself (OOP): strong hands on nut-changing rivers, only vs fish who won't bet thin and massively under-bluff."));
rule('maniacNoDonk', { title: "Vs a maniac: don't lead your strong hands", when: { street: ['flop', 'turn', 'river'], facing: false, heroPFR: false, heroIP: false, villainPFR: true, villainStyle: ['aggroCaller'], heroBucket: ['strong'] }, recommend: 'check' }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2026-08-18')("Don't donk strong hands; check them [08-18]"));
rule('bigCbetOverfold', { title: 'A pot-size c-bet: overfold', when: { street: ['flop'], facing: true, villainPFR: true, betSize: ['big'], multiway: false, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('A pot-size flop c-bet: overfold, even an overpair to the board (55) or second pair.'));
rule('fishHugeCbet', { title: "Overfold a fish's huge c-bet", when: { street: ['flop'], facing: true, villainPFR: true, betSize: ['big'], villainType: ['rec', 'passive', 'whale'], heroBucket: ['medium', 'air'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-02-25')("Fish exploit number one: overfold a fish's huge c-bet, especially in 3-bet pots"));
rule('smallCbetCall', { title: 'A small c-bet range is too weak: call with showdown value', when: { street: ['flop'], facing: true, villainPFR: true, betSize: ['small'], multiway: false, board: { dry: false }, heroBucket: ['medium'] }, recommend: 'call' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('a small c-bet range is "a little bit too weak" (he throws paper 40% too often): call every time with showdown value'));
rule('smallCbetWetCheckRaise', { title: 'Small c-bet on a wet board: check-raise your non-showdown hands small', when: { street: ['flop'], facing: true, villainPFR: true, betSize: ['small'], heroIP: false, board: { wet: true }, heroBucket: ['air', 'draws'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('check-raise non-showdown hands with a small size on wet boards'));
rule('huSmallDonk', { title: "A heads-up small donk: call, don't raise", when: { street: ['flop'], facing: true, villainAction: ['donk'], betSize: ['small'], multiway: false, heroPFR: true, potType: ['srp'], heroBucket: ['strong', 'medium', 'draws'] }, recommend: 'call' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')("call with value AND bluffs (76, QT). Don't raise, you don't want the garbage to fold."));
rule('ipSmallTurnStab', { title: 'Small turn stab after you checked back an ace-high flop', when: { street: ['turn'], facing: true, heroIP: true, heroPFR: true, betSize: ['small'], board: { aceHigh: true }, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('call linear (9x, 8x, 7x, even 66 beat K-high/J-high), and continue vs a river half pot.'));
rule('bestLineTurn', { title: '"The best line in all of poker"', when: { street: ['turn'], facing: false, heroIP: true, heroPFR: true, heroClass: ['sdv'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('"The best line in all of poker": c-bet small on the flop, check back the turn with showdown value, bluff-catch the river.'));
rule('thinValueCheckBack', { title: 'Thin value in position: check back the turn', when: { street: ['turn'], facing: false, heroIP: true, multiway: false, heroClass: ['thin'] }, recommend: 'check' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')('Thin value in position: check back the turn [07-28].'));
rule('turnRaiseBrick', { title: 'He raised your turn bet on a brick', when: { street: ['turn'], facing: true, villainAction: ['raise'], heroIP: false, potType: ['srp'], board: { wet: false } } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-01-20')('The flop checks through, you bet the turn, he raises in position: still "massively under-bluffed" on a brick turn.'));
rule('turnRaiseWet', { title: 'He raised your turn bet on a wet board', when: { street: ['turn'], facing: true, villainAction: ['raise'], heroIP: false, potType: ['srp'], board: { wet: true } } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-01-20')('On a wet turn (lots of new draws), especially with a 3x raise, you can start picking them off.'));
rule('pairingTurnFloat', { title: "A pairing turn: bluff-catch a rec's barrel", when: { street: ['turn'], facing: true, heroPFR: true, board: { paired: true, wet: true }, villainType: ['rec', 'passive', 'whale'], heroBucket: ['medium', 'draws'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-01-20')("Float a rec's wet-board flop check-raise and bluff-catch the pairing-turn barrel."));
rule('turnCheckRaiseTopPair', { title: 'A turn check-raise vs your top-pair bet', when: { street: ['turn'], facing: true, villainAction: ['raise'], heroIP: true, heroClass: ['thin', 'thick'], villainType: ['passive', 'tight', 'rec', 'whale'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-12-16')('Under-bluffed: a river check-raise after your triple barrel, a turn check-raise vs your small top-pair bet.'));
rule('passiveFolderTurnCall', { title: 'Vs a passive folder: call the turn wider', when: { street: ['turn'], facing: true, villainStyle: ['passiveFolder'], betSize: ['big'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-02-17')('Vs a passive FOLDER who double-barrels draws but gives up rivers: call the turn wider (99 vs a big double barrel)'));
rule('nit3betCbet', { title: "A nit 3-bettor's huge c-bet: you can fold", when: { street: ['flop'], facing: true, potType: ['3bet'], villainPFR: true, betSize: ['big'], villainType: ['tight', 'passive'], heroClass: ['thick', 'thin', 'sdv'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-02-17')("Vs a passive caller / nit 3-bettor's huge c-bet in a 3-bet pot: TT can fold."));
rule('fish3betBarrels', { title: "Fish don't bluff big 3-bet-pot barrels", when: { street: ['turn', 'river'], facing: true, potType: ['3bet'], betSize: ['big'], villainType: ['rec', 'passive', 'whale'], heroBucket: ['medium', 'air'] }, recommend: 'fold' }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-08-19')('fish under-bluff big 3-bet-pot stabs and barrels: overfold'));
rule('wideCbet3betCheckRaise', { title: 'Wide-vs-wide 3-bet pot: check-raise his range c-bet', when: { street: ['flop'], facing: true, potType: ['3bet'], villainPFR: true, heroIP: false, tightConfig: false, heroBucket: ['air', 'draws'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('check-raise pretty much any two cards without showdown value, even a small 3x.'));
rule('recTurnRaise3bet', { title: 'A rec raises your tiny turn bet in a 3-bet pot', when: { street: ['turn'], facing: true, villainAction: ['raise'], potType: ['3bet'], villainPFR: true, heroIP: false, board: { aceHigh: true }, villainType: ['rec', 'thinking'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-01-28')('The plan is to call, then jam river blanks (Q, J, T, 3, not K or A) to target Kx'));
rule('pairedTurn88', { title: 'Underpair facing a 3-bet-pot river jam on a paired board', when: { street: ['river'], facing: true, potType: ['3bet'], heroPFR: false, board: { paired: true }, betSize: ['big'], heroClass: ['sdv'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')('Only "consider" the call vs the right player: it\'s a spot where "less and less of the pool will bluff."'));
rule('tightConfigDrawsGotThere', { title: 'Tight config and the draws got there', when: { street: ['river'], facing: true, tightConfig: true, potType: ['3bet'], heroClass: ['thick', 'thin', 'sdv'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-05-12')('A tight config where the draws got there (EP vs EP 3-bet pot, QQ)'));
rule('recRiverJam3betAceHigh', { title: "A rec's big river jam in a 3-bet pot on an A-high board", when: { street: ['river'], facing: true, potType: ['3bet'], board: { aceHigh: true }, betSize: ['big'], villainType: ['rec', 'passive', 'whale'], heroClass: ['thin', 'thick'] }, recommend: 'fold' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-03-04')("top pair vs a REC's big 3-bet-pot river jam on an A-high board (a rec, not a reg: under-bluffs)"));
rule('ip3betTurnCheckedRiverBet', { title: '3-bet pot in position, turn checked back, he bets the river', when: { street: ['river'], facing: true, potType: ['3bet'], heroIP: true, heroPFR: true, turnCheckedThrough: true, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-04-08')('3-bet pot in position, small c-bet, turn checked back, he bets the river: call [2025-04-08 HHP].'));
rule('ag4betJam', { title: "An aggressive BTN 4-bettor's river jam", when: { street: ['river'], facing: true, potType: ['4bet'], villainPFR: true, villainPos: ['BTN'], villainType: ['aggressive'], turnCheckedThrough: true, betSize: ['big'], heroClass: ['sdv'] }, recommend: 'call' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-06-30')("An aggressive BTN 4-bettor's river jam after the turn checks through: it's air (A5, A6, Kxs)."));
rule('cold4betBluff', { title: 'Cold 4-bet pot vs a pro: a small river bluff', when: { street: ['river'], facing: false, potType: ['4bet'], heroPFR: true, turnCheckedThrough: true, villainType: ['thinking', 'aggressive'], heroClass: ['sdv'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-06-30')('A cold 4-bet pot vs a pro, TT, turn checks through: bet about 1/3 pot as a bluff.'));
rule('aa3betDry', { title: 'AA in a 3-bet pot on a dry board: bet, bet, bet', when: { street: ['flop', 'turn', 'river'], facing: false, potType: ['3bet'], heroPFR: true, board: { dry: true }, heroClass: ['thick'] }, recommend: 'bet' }, src('playbook-postflop-bluffs-and-rivers.md', '10. Strong hands', '2026-08-25')('AA in a 3-bet pot on a dry, static board: bet, bet, bet [08-25, 08-11].'));
rule('multiwayUnderBluffed', { title: 'Multiway pots are under-bluffed', when: { street: ['turn', 'river'], facing: true, multiway: true, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-09-30')('more heads-up (multiway pots are "massively" under-bluffed)'));
rule('multiwaySmallStab', { title: 'A small river stab after it checks through multiway', when: { street: ['river'], facing: true, multiway: true, turnCheckedThrough: true, betSize: ['small'], heroBucket: ['medium', 'air'] }, recommend: 'fold' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('A small river stab after it checks through multiway (AK, two callers, the BB stabs $35): fold every time.'));
rule('multiwayDonkOverfold', { title: 'A multiway flop donk: overfold', when: { street: ['flop'], facing: true, multiway: true, villainAction: ['donk'], heroBucket: ['medium'] }, recommend: 'fold' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('(JJ/QQ/KK "all the time"): overfold, TT included.'));
rule('multiwayBigRiver', { title: 'A big river bet into several players', when: { street: ['river'], facing: true, multiway: true, betSize: ['big'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-08-11')('A big river bet into 3 players after the draw came in [08-11].'));
rule('multiwayWetSet', { title: 'Multiway, wet board, a set: get it in now', when: { street: ['flop', 'turn'], facing: true, multiway: true, betSize: ['big'], board: { wet: true }, heroClass: ['cpfs'] }, recommend: 'raise' }, src('playbook-postflop-bluffs-and-rivers.md', '10. Strong hands', '2026-08-04')('Multiway on a wet board, bottom set, overbet plus a call: get it all in now.'));
rule('nextToActCheckRaise', { title: 'A check-raise from next to act with a player behind', when: { street: ['flop', 'turn', 'river'], facing: true, multiway: true, villainAction: ['raise'] } }, src('playbook-postflop-bluffs-and-rivers.md', '10. Strong hands', '2026-09-15')('Facing a check-raise from next to act with a player behind: sets and two pair.'));
rule('checklistRiver', { title: 'Bluff-catching: think about his range', when: { street: ['river'], facing: true, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-09-30')("Bluff-catching is about HIS range, not your hand's strength, so you'll call some weak hands and fold some strong ones."));
rule('giveRope', { title: 'Did you give rope?', when: { street: ['river'], facing: true, turnCheckedThrough: true, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')('Did we give rope? (We bet small, checked back, or checked out of position as the PFR.)'));
rule('underBluffLead', { title: 'Vs an under-bluffer, fold bluff catchers', when: { street: ['river'], facing: true, villainType: ['tight'], heroBucket: ['medium', 'strong'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2024-10-08')('"If a player massively under-bluffs, every bluff catcher is better as a fold than a call."'));
rule('tightRecCheckRaise', { title: "A tight rec's river check-raise", when: { street: ['river'], facing: true, villainAction: ['raise'], villainType: ['tight'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2024-12-17')('"call is the worst, then fold, so shove."'));
rule('riverDonkAfterStrength', { title: 'A big river donk after you showed only strength', when: { street: ['river'], facing: true, villainAction: ['donk'], betSize: ['big'], heroPFR: true, villainType: ['rec', 'passive', 'whale'], heroBucket: ['medium'] }, recommend: 'fold' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2024-11-12')('He donks, and we showed only strength (3-bet, small c-bet, small turn bet): it is almost never a bluff.'));
rule('riverSmallDonk', { title: 'A small river donk', when: { street: ['river'], facing: true, villainAction: ['donk'], betSize: ['small'], heroPFR: true } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('A small (25-33%) donk is Kx showdown value, "still probably under-bluffed."'));
rule('flushRiverDonkGreedy', { title: 'A fish donks the river after you c-bet and overbet', when: { street: ['river'], facing: true, villainAction: ['donk'], heroPFR: true, villainType: ['rec', 'passive', 'whale'], heroClass: ['cpfs'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-08-11')('A donk on a flush-completing river after you c-bet and overbet: "fish getting greedy"'));
rule('riverRaiseAfterFlopCheckBack', { title: 'Flop check-back, turn call, river raise', when: { street: ['river'], facing: true, villainAction: ['raise'], heroIP: false, heroBucket: ['medium', 'strong'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-06-16')('A flop check-back, turn call, then a river raise: "one of the most under-bluffed lines in poker"'));
rule('checkRaiseAfterAggression', { title: 'A river check-raise after you showed only aggression', when: { street: ['river'], facing: true, villainAction: ['raise'], heroIP: true, heroPFR: true, villainType: ['passive', 'tight', 'rec', 'whale'], heroBucket: ['strong', 'medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')('"we can easily throw aces into the muck."'));
rule('aHighTripleBarrel', { title: 'An A-high triple barrel', when: { street: ['river'], facing: true, villainPFR: true, board: { aceHigh: true }, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-03')("he bets AK/AQ/AT thin (solvers check them back) and doesn't find the unintuitive bluffs (6x, K7hh, K5dd)."));
rule('fishBigBluffRare', { title: "A fish's big river bet", when: { street: ['river'], facing: true, betSize: ['big'], villainType: ['rec', 'passive', 'whale'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-09-30')("Many players who can make a small bluff can't make a big one."));
rule('potSizeAfterCheckBack', { title: 'A pot-size river bet after you checked back the turn', when: { street: ['river'], facing: true, turnCheckedThrough: true, heroIP: true, potType: ['srp'], betSize: ['big'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-04-28')('Pot size after you checked back the turn: 77 in an SRP. The pool under-bluffs this size [04-28]'));
rule('gethenUnderTwoThirds', { title: 'Bets under 2/3 pot are good bluff-catch spots', when: { street: ['river'], facing: true, betSize: ['small', 'inbetween'], heroIP: true, turnCheckedThrough: false, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-04-28')('The pool is "not good at betting thinly for value," so bets under 2/3 pot are good bluff-catch spots.'));
rule('noRaiseBluffCatcherTrips', { title: "Don't raise a bluff catcher into trips", when: { street: ['river'], facing: true, heroAction: ['raise'], board: { paired: true }, heroBucket: ['medium'] }, recommend: 'call' }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-04-28')("Don't raise a bluff catcher into trips or flushes [04-28]."));
rule('polarNeverRaiseBC', { title: 'Vs a polar bet, never raise a bluff catcher', when: { street: ['river'], facing: true, heroAction: ['raise'], betSize: ['big'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')('Call or fold, never raise [all four]'));
rule('polarJamValue', { title: 'Vs a polar bet, jam your value', when: { street: ['river'], facing: true, betSize: ['big'], heroClass: ['cpfs'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')("Jam. Don't min-raise: his value never folds [all four]"));
rule('topOfRangePassiveJam', { title: "Top of range doesn't matter vs a passive player's jam", when: { street: ['river'], facing: true, betSize: ['big'], villainType: ['passive', 'tight'], heroBucket: ['strong'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2025-06-24')('"It doesn\'t matter that we are top of range if our opponent is only jamming this river with the nut flush"'));
rule('deepLinearJam', { title: 'Deep vs a linear range: turn the overpair into a bluff', when: { street: ['river'], facing: true, deep: true, betSize: ['small'], heroClass: ['thick'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-07-28')('AA facing a small river bet at 2/5, 2K deep, after he check-raised and barreled: jam as a bluff to fold his sets.'));
rule('recCheckedRiverThin', { title: 'A capped rec checks the river: value thin and small', when: { street: ['river'], facing: false, villainAction: ['check'], capped: true, villainType: ['rec', 'passive', 'whale'], heroBucket: ['strong'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2024-11-12')('Value bet thin and small, about 125 into 400 (30% pot), even with strong hands like the nut flush, because JJ/TT/9x call it.'));
rule('overfolderJam', { title: 'Vs a river overfolder: jam your no-showdown hands', when: { street: ['river'], facing: false, villainStyle: ['passiveFolder', 'aggroFolder'], heroBucket: ['air'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-01-21')('jam every no-showdown-value hand vs a player who folds A6 to a shove, even with bad blockers'));
rule('thinValueNit', { title: 'The tight "thin value" reg: bluff him a lot', when: { street: ['turn', 'river'], facing: false, villainType: ['tight'], heroBucket: ['air'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2024-12-10')('The "thin value" player under-bluffs (the tight nit whose bet means he has it and who believes you): bluff him a lot.'));
rule('bigBoyBluffsReg', { title: 'The "big boy bluffs" reg: go super thin', when: { street: ['river'], facing: false, villainType: ['aggressive'], heroClass: ['thin', 'thick'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2024-12-10')('The "big boy bluffs" player never goes thin and stations too much (he thinks everyone plays like him): go super thin for value.'));
rule('tryingRecBluff', { title: 'Trying recs are great to bluff', when: { street: ['turn', 'river'], facing: false, villainType: ['thinking'], heroBucket: ['air'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-01-28')('Trying recs are some of the best players to bluff'));
rule('stickyStillBluff', { title: 'Sticky does not mean never bluff', when: { street: ['turn', 'river'], facing: false, villainStyle: ['aggroCaller'], heroBucket: ['air'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2026-04-14')('Sticky villains don\'t mean "never bluff" [04-14].'));
rule('superStickyThin', { title: 'Vs a super sticky player: go huge for thin value', when: { street: ['river'], facing: false, villainStyle: ['passiveCaller', 'whale'], heroClass: ['thin'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2026-08-11')('Go "unbelievably large" for thin value, don\'t bluff [08-11]'));
rule('aggroCallerRope', { title: 'Vs an aggro caller: give rope with two pair', when: { street: ['turn', 'river'], facing: false, villainStyle: ['aggroCaller'], heroClass: ['cpfs'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '2026-02-17')('Give rope with medium-strong hands like two pair [02-17]'));
rule('overFolderBluff', { title: 'He over-folds: bluff', when: { street: ['turn'], facing: false, villainStyle: ['passiveFolder', 'aggroFolder'], heroBucket: ['air'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2025-04-08')("he over-folds (wide configs vs capped top pair, huge bets for the game's size, when up on the day): bluff."));
rule('regUnderBluffAceHigh', { title: 'Regs under-bluff A-high boards', when: { street: ['turn', 'river'], facing: true, villainType: ['aggressive', 'thinking'], board: { aceHigh: true }, heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '')('Regs under-bluff tight configs, A-high boards and 4-bet pots, and over-bluff wide configs, double-broadway boards and SRPs.'));
rule('setOnA72Passive', { title: 'Middle set on A72 vs a passive player: bet', when: { street: ['flop'], facing: false, board: { aceHigh: true, dry: true }, heroClass: ['cpfs'], villainType: ['passive'] }, recommend: 'bet' }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2026-06-23')("Middle set on A72: vs a passive player, bet, since he won't bet his Ax for you."));
rule('setOnA72Stabber', { title: 'Middle set on A72 vs a stabber: check-raise', when: { street: ['flop'], facing: true, heroIP: false, board: { aceHigh: true, dry: true }, heroClass: ['cpfs'], villainType: ['aggressive', 'whale'] }, recommend: 'raise' }, src('playbook-postflop-bluffs-and-rivers.md', '9. Adjust by player type', '2026-06-23')('Vs a stabber, check-raise.'));
rule('aceHighPolar', { title: 'Ace-high boards: play polarized', when: { street: ['flop', 'turn'], facing: false, heroPFR: true, board: { aceHigh: true, dry: false } } }, src('playbook-postflop-bluffs-and-rivers.md', '8. Ace-high boards: overbet or check', '2026-09-15')('Play polarized [09-15, 08-04]. Overbet very strong value and strong draws, plus bottom-pair bluffs.'));
rule('aceHighPairingRiver', { title: 'Ace-high board, pairing river: value under pot', when: { street: ['river'], facing: false, riverPairs: true, board: { aceHigh: true }, heroBucket: ['strong'] } }, src('playbook-postflop-bluffs-and-rivers.md', '8. Ace-high boards: overbet or check', '2026-08-04')("On a pairing river he's elastic: value-bet under about pot [08-04]."));
rule('utgLimpCallerAx', { title: 'UTG limp-callers are mostly Ax', when: { street: ['flop', 'turn'], facing: false, heroPFR: true, villainPFR: false, villainPos: ['UTG', 'UTG+1'], board: { aceHigh: true } } }, src('playbook-postflop-bluffs-and-rivers.md', '8. Ace-high boards: overbet or check', '2026-09-15')('UTG limp-callers are mostly Ax that check-calls.'));

// ---------------------------------------------------------------- conflicts and open questions that can come up
// Never compiled into a verdict: shown side by side with dates, not graded. find = text in the
// conflict's title (as parsed from the playbook) so the app shows the live playbook block.
const conflict = (id, v, s) => hhp(`conflicts.${id}`, v, s, { fb: null });
conflict('a72', { title: 'A72 as the preflop raiser: c-bet the range or check back?', find: 'A72 rainbow', open: 'open-2', when: { street: ['flop'], heroPFR: true, facing: false, board: { aceHigh: true, dry: true } } },
  src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('Range-bet the flop? (Joan hasn\'t ruled)'));
conflict('cappedRecTurn', { title: 'A capped rec who checked the turn: size up, or bet tiny?', find: 'A capped rec who checked the turn', when: { street: ['turn'], facing: false, villainAction: ['check'], villainType: ['rec', 'passive', 'tight', 'whale'], capped: true } },
  src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '')('A capped rec who checked the turn: size UP, or bet TINY?'));
conflict('riverJam2x', { title: "Jam ~2x pot into a rec's river check with no showdown value?", find: "Jam ~2x pot into a rec's river CHECK", when: { street: ['river'], facing: false, villainAction: ['check'], villainType: ['rec', 'passive', 'whale'], heroBucket: ['air'] } },
  src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '')("Jam ~2x pot into a rec's river CHECK with no showdown value"));
conflict('pairedRiverBluff', { title: 'A big river bluff when the river pairs the board?', find: 'A big river bluff when the river PAIRS the board', when: { street: ['river'], facing: false, heroBucket: ['air'], riverPairs: true } },
  src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '')('A big river bluff when the river PAIRS the board'));
conflict('setCheckRaise', { title: 'Check-raise size with a set vs a stab', find: 'Check-raise size with a set', when: { street: ['flop', 'turn'], facing: true, heroBucket: ['strong'], heroIP: false } },
  src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('Check-raise size with a set (or strong hand) vs a stab'));
conflict('thickBigStab', { title: 'Thick value facing a big stab', find: 'Thick value facing a BIG stab', when: { street: ['flop', 'turn'], facing: true, heroBucket: ['strong'], betSize: ['big'], villainAction: ['bet-big'] } },
  src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('Thick value facing a BIG stab (KQ on Q-8-4)'));
conflict('open05-12', { title: 'A half-pot river lead after the turn checks through, weak A-high', find: 'Where does [05-12] go', open: 'open-1', when: { street: ['river'], facing: true, turnCheckedThrough: true, betSize: ['small', 'inbetween'], heroBucket: ['air', 'medium'] } },
  src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '')('Where does [05-12] go?'));
conflict('kkIso', { title: 'KK (and AK) small or big in the CO 3-bet iso vs a fish', find: 'KK (and AK) small or big', when: { street: ['preflop'], spot: ['VS_OPEN'], heroPos: ['CO'], villainType: ['whale', 'rec'], heroCodes: ['KK', 'AKs', 'AKo'] } },
  src('playbook-preflop.md', '5. Facing an open (not from the BB)', '')('KK (and AK) small or big in the CO 3-bet iso vs a fish\'s open, with 2+ regs behind'));
conflict('abc3bet', { title: 'The "even at 15%" HJ vs LJ 3-bet chart', find: 'The "even at 15%" HJ vs LJ 3-bet chart', when: { street: ['preflop'], spot: ['VS_OPEN'], heroPos: ['HJ'], villainType: ['tight'] } },
  src('playbook-preflop.md', '5. Facing an open (not from the BB)', '')('The "even at 15%" HJ vs LJ 3-bet chart: CSV vs [2025-03-04 HHP] (CSV unchanged).'));

// Batch 1 (item 10): playbook-postflop.md.
conflict('fourBetAceRiver', { title: '4-bet pot, A-high board: river value and bluff sizes', find: '4-bet pot, A-high board, RIVER sizes', when: { street: ['river'], facing: false, potType: ['4bet'], board: { aceHigh: true } } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('4-bet pot, A-high board, RIVER sizes: [undated HHP] vs [06-09] vs [04-28] vs [2025-07-15].'));
conflict('riverBluff942K', { title: '3-bet pot river bluff after small, small: big or small?', find: 'River BLUFF size after small, small in the 3-bet pot', when: { street: ['river'], facing: false, potType: ['3bet'], heroPFR: true, heroIP: true, board: { dry: true }, heroBucket: ['air'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('River BLUFF size after small, small in the 3-bet pot on 9-4-2 with a K turn: [2025-02-04 HHP] BIG vs [undated HHP] small.'));
conflict('smallRiverBluffCapped', { title: 'River bluff vs a capped range: small or 1.5-2x pot?', find: 'A small river bluff vs a capped range', when: { street: ['river'], facing: false, capped: true, heroBucket: ['air'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('A small river bluff vs a capped range: [undated HHP] 125-150 vs [2025-07-15] 1.5-2x pot.'));
conflict('smallRiverValue', { title: 'Small river value: vs passive, aggressive or capped-elastic?', find: 'Small river VALUE: [undated HHP]', when: { street: ['river'], facing: false, villainAction: ['check'], capped: true, heroClass: ['thick', 'thin'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('Small river VALUE: [undated HHP] (small vs an aggressive player, BIG vs a passive one) vs [08-04] (capped and elastic: bet small to induce).'));
conflict('nutFlushRiverPassive', { title: 'Nut flush river, he checks: tiny or huge vs a passive player?', find: 'Nut flush river, he checks: value size vs a passive player', when: { street: ['river'], facing: false, heroIP: true, villainAction: ['check'], villainType: ['passive', 'rec', 'whale'], heroClass: ['cpfs'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('Nut flush river, he checks: value size vs a passive player.'));
conflict('smallTurnVsCheck', { title: 'A small (about 1/3 pot) turn bet: fine or the size to avoid?', find: 'A small turn bet (about 1/3 pot) vs a check', when: { street: ['turn'], facing: false, villainAction: ['check'], capped: false, heroLine: ['bet-small'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('A small turn bet (about 1/3 pot) vs a check: [undated HHP] vs the [2025-07-15] "avoid the 1/3-to-pot size on turns and rivers" headline.'));
conflict('pairedTurnBoat', { title: 'A full house on a paired turn after his check-raise: $70 or about pot?', find: 'A full house on a paired turn after his flop check-raise', when: { street: ['turn'], facing: false, villainAction: ['check'], board: { paired: true }, heroClass: ['cpfs'] } }, src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '')('A full house on a paired turn after his flop check-raise: [2025-03-04 HHP] vs [2025-05-20 HHP].'));

// Batch 2 (item 10): playbook-postflop-weakness-and-position.md.
conflict('crFreq3bet', { title: 'How often to check-raise a range c-bettor in a wide 3-bet pot', find: 'How often to check-raise a range c-bettor', when: { street: ['flop'], facing: true, potType: ['3bet'], heroPFR: false, heroIP: false, villainPFR: true, betSize: ['small'] } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '')('How often to check-raise a range c-bettor in a wide 3-bet pot: [01-27] 29% vs [2025-03-11 HHP] 53%.'));
conflict('likelyStabbedPfr', { title: 'Likely-stabbed flop as the raiser: bet thick value, or check it all?', find: 'is on the right-hand', when: { street: ['flop'], heroPFR: true, facing: false, potType: ['srp'], board: { wet: true } } }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '')('[2025-04-01 HHP] is on the right-hand ("check the ENTIRE range") side of the table above, in a heads-up SRP, vs [2025-08-12] in a multiway SRP.'));
conflict('turnDonkOrCheck', { title: 'Turned a strong hand out of position: donk or check?', find: 'Two more oldest videos on the DONK side', when: { street: ['turn'], facing: false, heroIP: false, heroPFR: false, flopCheckedThrough: false, heroBucket: ['strong'] } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('Two more oldest videos on the DONK side of the table above (added 2026-09-29), vs [04-28] on the CHECK side.'));
conflict('ak4ThreeBettor', { title: '3-bettor OOP on a board good for you: c-bet the range, or only strong hands?', find: 'board good for us (A-K-4)', when: { street: ['flop'], facing: false, potType: ['3bet'], heroPFR: true, heroIP: false, board: { aceHigh: true, dry: true } } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('Out of position as the 3-bettor, board good for us (A-K-4): [2025-03-11 HHP] c-bets the ENTIRE range vs [2025-10-21] / [2025-04-01 HHP] bet only CPFS + thick value.'));
conflict('jt92At100bb', { title: 'Wet flop OOP at about 100bb: bet strong hands, or check the range?', find: 'J-9-2 at about 100bb OOP', when: { street: ['flop'], facing: false, heroIP: false, shallow: true, heroBucket: ['strong'], board: { wet: true } } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('J-9-2 at about 100bb OOP: [2025-02-18 HHP] bet strong hands vs [2025-04-01 HHP] check the whole range.'));
conflict('proRec3betBoard', { title: '3-bet pot OOP: range-bet small vs a pro, check vs a rec?', find: 'Extends the A-K-4 table above', when: { street: ['flop'], facing: false, potType: ['3bet'], heroPFR: true, heroIP: false, board: { aceHigh: true } } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('Extends the A-K-4 table above (board good for us, 3-bet pot)'));
conflict('aceTurnAir', { title: 'Ace turn after the flop checks through, holding air', find: 'An Ace turn after the flop checks through', when: { street: ['turn'], heroIP: false, flopCheckedThrough: true, heroPFR: false, heroBucket: ['air'], board: { aceHigh: true } } }, src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('An Ace turn after the flop checks through, we hold air'));
conflict('recFlopXR3bet', { title: 'A rec check-raises your flop top pair: call, or 3-bet?', find: 'The same 2024-12-17 hand vs [06-16]', when: { street: ['flop'], facing: true, villainAction: ['raise'], heroPFR: true, villainType: ['rec', 'passive', 'whale'], heroClass: ['thick', 'thin'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '')('The same 2024-12-17 hand vs [06-16]: CALL his flop check-raise, or 3-bet it?'));
conflict('tightRecRiverXR', { title: "Shove as a bluff into a tight old rec's river check-raise?", find: 'Shove as a bluff into a tight old rec', when: { street: ['river'], facing: true, villainAction: ['raise'], villainType: ['tight', 'rec', 'passive'] } }, src('playbook-postflop-weakness-and-position.md', '6. Bluffing: air vs showdown value', '')("Shove as a bluff into a tight old rec's river check-raise: [2024-12-17 HHP] shove vs [08-04] / [2025-06-10 HHP] don't try to fold flushes."));

// Batch 3 (item 10): playbook-postflop-bluffs-and-rivers.md.
conflict('regTripleBarrel', { title: "A reg's triple barrel in a wide config: call, or give credit?", find: 'Calling a triple barrel vs a REG in a wide config', when: { street: ['river'], facing: true, villainType: ['aggressive', 'thinking'], heroBucket: ['medium'] } }, src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '')('Calling a triple barrel vs a REG in a wide config'));

conflict('flopXXTurnLead', { title: 'Out of position, flop checked through, strong hand: lead the turn or check-raise?', find: 'LEADS the value hand but check-raises the bluff', when: { street: ['turn'], facing: false, heroIP: false, flopCheckedThrough: true, heroBucket: ['strong'] } },
  src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '')('extends the same table: [2025-01-28 HHP] LEADS the value hand but check-raises the bluff.'));

// ---------------------------------------------------------------- preflop questions (feedback step 2)
hhp('questions.six', ["What's the villain's range?", "What's our edge on him?", "What's the effective stack?", 'What size did he use?', "What's the rake?", 'How many players are left to act?'],
  PRE1("Marc's six questions, every hand:"), { fb: null });
hhp('questions.rfi', 'When to open wider or tighter: a bigger postflop edge (fish in the blinds), a passive table, deeper stacks, late position = wider; regs in the blinds, an aggressive table, shallower, early position = tighter.',
  src('playbook-preflop.md', '2. When to open wider or tighter', '')('You have a bigger postflop edge (fish in the blinds) | You have a smaller edge (a table of pros, regs in the blinds)'), { fb: null, interp: 'summary of the table rows' });

// ---------------------------------------------------------------- the sizing rule the verdict uses [08-04]
const PF2S = src('playbook-postflop.md', '2. Bet sizing: small or big, never in between', '2026-08-04');
hhp('sizing.uncapped', 'bet-small', PF2S('Uncapped: go small, with value AND bluffs, or just call.'), { fb: null });
hhp('sizing.cappedInelastic', 'bet-big', PF2S('Capped + inelastic: bet huge, pot to 1.6x.'), { fb: null });
hhp('sizing.cappedElastic', 'bet-small', PF2S('Capped + elastic: go small for value to induce, or use a just-big-enough bluff size.'), { fb: null });
hhp('sizing.cappedDef', 'capped', PF1("Capped = his action already showed his strength: he checked, bet small into several players, or called where he'd raise a big hand."), { fb: null });
out('sizing.cappedStrongShare', 0.15, 'he counts as capped when under 15% of his range is Strong (default, Joan to review)');
out('sizing.elasticPoints', 15, 'his range counts as elastic when a big bet folds 15+ points more of it than a small bet (default, Joan to review)');

// ---------------------------------------------------------------- range claims (checked, never forced)
// What the brain says an action means. The feedback checks his actual strategy against each
// matching claim; a mismatch shows both views and is never resolved in code.
// group: strongValue | value | draws | air (js/range/classes.js). min/max: share after the action;
// direction: up/down vs before the action.
const claim = (id, v, s) => hhp(`claims.${id}`, v, s, { fb: null });
claim('poolCheckRaise', { title: 'Flop raises are mostly sets and two pair', when: { street: ['flop'], villainAction: ['raise'], villainStyle: ['passiveCaller', 'passiveFolder', 'aggroFolder'] }, group: 'strongValue', groupLabel: 'strong value', min: 0.5 }, BR9('Flop check-raises are mostly sets and two pair'));
claim('multiwayDonk', { title: 'A multiway donk is much stronger', when: { street: ['flop', 'turn'], multiway: true, donk: true }, group: 'strongValue', groupLabel: 'strong value', direction: 'up' }, PF1('A multiway donk is "much, much stronger" than a heads-up donk.'));
claim('smallDryCbet', { title: 'A small c-bet on a dry board is not weak', when: { street: ['flop'], villainAction: ['bet-small'], villainPFR: true, board: { dry: true } }, group: 'strongValue', groupLabel: 'strong value', direction: 'up' }, PF1('A small c-bet on a bone-dry static board is NOT weak.'));
claim('bigMultiwayCbet', { title: 'A big multiway c-bet is too strong', when: { street: ['flop'], multiway: true, villainPFR: true, villainAction: ['bet-big'] }, group: 'strongValue', groupLabel: 'strong value', direction: 'up' }, PF1('A big multiway c-bet is "too strong," so overfold, even top pair.'));
claim('whaleStabs', { title: 'The whale over-stabs (his bets keep air)', when: { street: ['flop', 'turn'], villainType: ['whale'], villainAction: ['bet-small', 'bet-big'] }, group: 'air', groupLabel: 'air', min: 0.15 }, V1028('over-stabs the flop and turn, then usually gives up the river'));
claim('passiveFolderRiver', { title: 'A passive folder gives up his draws on the river', when: { street: ['river'], villainStyle: ['passiveFolder'], villainAction: ['bet-small', 'bet-big'] }, group: 'air', groupLabel: 'air', max: 0.15 }, V0217('Double-barrels draws, then gives them up on the river.'));
claim('recTelegraph', { title: 'Recs telegraph with size', when: { street: ['flop', 'turn', 'river'], villainType: ['rec', 'passive'], villainAction: ['bet-big'] }, group: 'strongValue', groupLabel: 'strong value', direction: 'up' }, src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-01-07')('recs telegraph with size'));

// ---------------------------------------------------------------- the seven HHP hand classes
// rule = how the app sorts a hand into the class (the examples come from the quote; the exact
// cut-offs are the app's reading, listed in docs/run-log.md "Decisions for Joan").
const WK4 = src('playbook-postflop-weakness-and-position.md', '4. Pounce on weakness', '2025-08-12');
const WK5 = src('playbook-postflop-weakness-and-position.md', '5. Out of position, as the preflop caller [08-18]', '2025-10-21');
const BR7 = src('playbook-postflop-bluffs-and-rivers.md', '7. Bluff-catching and river raises', '');
const cls = (key, label, rule, s, interp) => hhp(`classes.${key}`, { label, rule }, s, { fb: { label, rule }, interp });
cls('cpfs', 'Can play for stacks (CPFS)', 'Sets, trips, two pair using both your cards, straights, flushes, full houses and better: hands that cooler strong hands.', WK4('CHECK CPFS (can play for stacks, hands that cooler strong hands)'), 'which made hands count is the app\'s reading of "hands that cooler strong hands"');
cls('thick', 'Thick value', 'Overpairs, and top pair with the best or second-best kicker still available.', WK4('BET thick value only (TPTK, an overpair'), 'the second-best kicker counts too (default, Joan to review)');
cls('thin', 'Thin value', 'Top pair with a weaker kicker.', BR7('thin value (KQ, AQ, weaker queens; never sets, two pair or straights with that size)'));
cls('highDraw', 'High-equity draws', 'Flush draws, open-ended straight draws and combo draws (8+ outs), flop and turn only.', WK5('Check-raise wide: CPFS (99), thick value (QQ), combo (KQss), high-equity draws (A5ss), even low-equity draws (KQdd).'), '8+ outs = high equity (default, Joan to review)');
cls('lowDraw', 'Low-equity draws', 'Gutshots and other 4-7 out draws, flop and turn only.', WK4('Check the crappy gutshot and weak flush draws (65 of spades) multiway.'), '4-7 outs = low equity (default, Joan to review)');
cls('sdv', 'Showdown value', 'Second pair and lower, underpairs, and AK / AQ high: hands that want to get to showdown.', WK5('Check-call thin value and showdown value (TT, AK-high).'), 'second pair and underpairs are showdown value; AK/AQ-high count, weaker ace-high doesn\'t (default, Joan to review)');
cls('air', 'Air', 'No pair and no draw (and busted draws on the river).', src('playbook-postflop.md', '1. Read his range first', '2026-08-18')('can play for stacks > thick value > thin value > draws > showdown value > air'));

void PI;
mkdirSync(new URL('../brain-compiled/', import.meta.url), { recursive: true });
const doc = {
  version: 1,
  compiledAt: '2026-09-30',
  note: 'Compiled from brain/ by tools/build-compiled.mjs. Edit that file, not this one.',
  values,
};
writeFileSync(new URL('../brain-compiled/behavior.json', import.meta.url), `${JSON.stringify(doc, null, 1)}\n`);
console.log(`Wrote brain-compiled/behavior.json: ${Object.keys(values).length} values.`);
