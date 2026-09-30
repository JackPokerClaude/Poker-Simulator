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
// board (aceHigh, paired, monotone, wet, dry), potType, villainAction, heroAction, deep, limperPos,
// betSize ('small' | 'inbetween' | 'big'). recommend: the line the rule points to (used for the verdict).
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
rule('sdv', { title: 'Showdown value: just get to showdown', when: { street: ['turn', 'river'], facing: false, heroBucket: ['medium'] }, recommend: 'check' }, PF1("Showdown value's only goal is to REACH showdown"));
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
