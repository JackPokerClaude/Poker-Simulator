// =====================================================================
//  VILLAIN CONFIG: every villain tendency lives in this one file.
//  Edit numbers here to change how the table plays. Percentages are 0-100.
// =====================================================================
//
// Preflop ranges use "top X%" of hands (by playability) unless a type lists
// explicit hands (e.g. the passive 3-bet range "JJ+, AK" from HHP).
//
// Postflop, each villain rates its real hand (made-hand strength vs the board
// plus draw outs) and picks an action from the frequencies below.

export const VILLAIN_CONFIG = {
  // How often each type sits at the table, per stake.
  tableMix: {
    '1/2': { rec: 34, passive: 24, whale: 12, aggressive: 18, thinking: 12 },
    '1/3': { rec: 30, passive: 25, whale: 11, aggressive: 20, thinking: 14 },
    '2/5': { rec: 22, passive: 26, whale: 10, aggressive: 22, thinking: 20 },
  },

  // Live open sizes in dollars (picked at random). Isos add ~1 bb per limper on top.
  openSizes: {
    '1/2': [10, 10, 12, 15, 15, 15, 20, 25],
    '1/3': [12, 15, 15, 15, 20, 20, 25, 30],
    '2/5': [20, 20, 25, 25, 30, 30, 35, 40],
  },

  // Seat multipliers applied to open / limp ranges (live players loosen up late).
  // Tuned so each type's average open rate lands near its openPct below.
  positionFactor: { 'UTG': 0.85, 'UTG+1': 0.9, 'LJ': 1.0, 'HJ': 1.1, 'CO': 1.35, 'BTN': 1.6, 'SB': 1.05, 'BB': 1.2 },

  types: {
    passive: {
      label: 'Passive',
      desc: 'HHP passive: opens ~7-8%, 3-bets only JJ+/AK, calls a lot, raises only strong hands.',
      preflop: {
        openPct: 7.5,          // raise-first-in range
        limpPct: 10,           // extra hands limped on top of the open range
        isoFactor: 0.8,        // share of open range used to raise over limpers
        callOpenPct: 20,       // flat range vs an open (after removing 3-bets)
        threeBet: ['JJ+', 'AK'],
        continueVs3betPct: 12, // call range vs a 3-bet
        fourBet: ['KK+'],
        callVs4bet: ['QQ', 'AK'],
        fiveBet: ['AA'],
        limpCallPct: 70,       // % of limped hands that call a raise
        bluff3betPct: 0,
      },
      postflop: {
        // chance to bet when checked to, by hand class
        bet: { monster: 55, strong: 55, medium: 20, draw: 10, air: 4 },
        cbetBonus: 10,         // extra bet% when this villain was the preflop raiser
        sizing: [0.33, 0.5, 0.6],
        // chance to raise when facing a bet
        raise: { monster: 40, strong: 5, draw: 3, air: 0 },
        respect: 0.8,          // 0 = ignores bet size, 1 = folds a lot to big bets
        stickiness: 0.05,      // lowers the equity needed to call
        riverBluffCatch: 0.1,  // chance to hero-call a river with weak showdown value
      },
    },

    aggressive: {
      label: 'Aggressive',
      desc: 'HHP aggressive: opens ~30%, 3-bets a lot, bets and bluffs often.',
      preflop: {
        openPct: 30, limpPct: 2, isoFactor: 1.0, callOpenPct: 16,
        threeBetPct: 12, continueVs3betPct: 16, fourBetPct: 4,
        fourBetBluffs: ['A5s', 'A4s', 'KQs'], callVs4betPct: 5, fiveBet: ['KK+', 'AKs'],
        limpCallPct: 60, bluff3betPct: 5,
      },
      postflop: {
        bet: { monster: 75, strong: 72, medium: 45, draw: 65, air: 42 },
        cbetBonus: 20, sizing: [0.5, 0.66, 0.75, 1.0],
        raise: { monster: 65, strong: 25, draw: 25, air: 8 },
        respect: 0.55, stickiness: 0.05, riverBluffCatch: 0.2,
      },
    },

    thinking: {
      label: 'Thinking player',
      desc: 'HHP thinking player: aggressive 3-bettor who can fold to pressure.',
      preflop: {
        openPct: 22, limpPct: 0, isoFactor: 1.0, callOpenPct: 12,
        threeBetPct: 10, continueVs3betPct: 10, fourBetPct: 3,
        fourBetBluffs: ['A5s'], callVs4betPct: 3, fiveBet: ['KK+'],
        limpCallPct: 50, bluff3betPct: 4, foldToPressure: 1.35,
      },
      postflop: {
        bet: { monster: 65, strong: 68, medium: 38, draw: 55, air: 33 },
        cbetBonus: 18, sizing: [0.33, 0.5, 0.75],
        raise: { monster: 60, strong: 18, draw: 20, air: 6 },
        respect: 1.05, stickiness: 0, riverBluffCatch: 0.12,
      },
    },

    whale: {
      label: 'Whale',
      desc: 'HHP whale: massively underfolds and calls down wide.',
      preflop: {
        openPct: 16, limpPct: 38, isoFactor: 0.9, callOpenPct: 45,
        threeBetPct: 6, continueVs3betPct: 30, fourBetPct: 3, callVs4betPct: 8,
        fiveBet: ['QQ+', 'AK'], limpCallPct: 95, bluff3betPct: 3,
      },
      postflop: {
        bet: { monster: 65, strong: 55, medium: 40, draw: 40, air: 22 },
        cbetBonus: 5, sizing: [0.3, 0.5, 0.75, 1.0, 1.3],
        raise: { monster: 45, strong: 22, draw: 15, air: 5 },
        respect: 0.15, stickiness: 0.2, riverBluffCatch: 0.55,
        callAnyPair: true, callAnyDraw: true,
      },
    },

    rec: {
      label: 'Loose-passive rec',
      desc: 'Live rec: limps a lot, calls a lot, rarely raises without the goods.',
      preflop: {
        openPct: 6, limpPct: 30, isoFactor: 0.7, callOpenPct: 30,
        threeBet: ['QQ+', 'AK'], continueVs3betPct: 20, fourBet: ['KK+'],
        callVs4bet: ['QQ', 'AK'], fiveBet: ['AA'], limpCallPct: 90, bluff3betPct: 0,
      },
      postflop: {
        bet: { monster: 50, strong: 45, medium: 25, draw: 18, air: 5 },
        cbetBonus: 5, sizing: [0.25, 0.33, 0.5],
        raise: { monster: 35, strong: 8, draw: 3, air: 0 },
        respect: 0.5, stickiness: 0.06, riverBluffCatch: 0.3,
        callAnyPair: true,
      },
    },
  },

  // Live-style reads. One or two are shown per villain; the type label never is.
  // {n} is replaced by a small number.
  reads: {
    passive: [
      'Has only raised once in the last hour',
      'Showed down QQ after just calling three streets',
      'Folds to most c-bets, calls when connected',
      'Tight, stacks chips neatly, rarely in a pot',
      'Just called a flop raise, turned over a set',
      'Limped and called, showed top pair weak kicker',
      'Took forever to call a small river bet with top pair',
    ],
    aggressive: [
      'Raised {n} of the last 8 pots',
      '3-bet the button twice this orbit',
      'Fired three barrels and showed a busted draw',
      'Opens to $20+ whenever it folds around',
      'Check-raised the flop and bet every street',
      'Stacks are all over the place, always in the mix',
    ],
    thinking: [
      'Hoodie, headphones, talks about ranges',
      '3-bets a lot, folded to a 4-bet last orbit',
      'Folded top pair face up to a big river overbet',
      'Adjusts sizes, notices who is limping',
      'Has been 3-betting the loose players light',
      'Opened the button, folded to a check-raise',
    ],
    whale: [
      'Called a river overbet with third pair',
      'Rebought twice already, still smiling',
      'Called $150 on the turn with a gutshot',
      'Limp-called $25 with J4 offsuit and showed it',
      'Straddles every time on the button',
      'Called down with ace-high and won',
    ],
    rec: [
      'Limped {n} times this orbit',
      'Called a river bet with third pair',
      'Limp-calls almost every raise',
      'Chatty, on vacation, playing lots of pots',
      'Checks and calls with any piece of the board',
      'Overlimped behind two players with K7 suited',
    ],
  },
};
